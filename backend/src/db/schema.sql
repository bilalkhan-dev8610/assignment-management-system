-- Assignment Management System: PostgreSQL schema.
-- Idempotent: safe to run more than once (npm run db:init).

-- ---------------------------------------------------------------
-- users: students and professors share one table, split by role
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_key       UNIQUE (email),
  CONSTRAINT users_email_lowercase CHECK (email = LOWER(email)),
  CONSTRAINT users_role_check      CHECK (role IN ('student', 'professor'))
);

COMMENT ON COLUMN users.password IS 'bcrypt hash of the password, never the plain text';

-- ---------------------------------------------------------------
-- courses: each course is taught (owned) by one professor.
-- code is unique across all courses; the API stores it in upper case.
-- (the app layer must ensure professor_id belongs to a professor)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  code          VARCHAR(20)  NOT NULL,
  description   TEXT,
  professor_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT courses_code_key UNIQUE (code)
);

-- Upgrade for databases created in Phase 1, where courses had "title" and no
-- "code". Does nothing on a fresh database or when already upgraded.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'courses'
               AND column_name = 'title') THEN
    ALTER TABLE courses RENAME COLUMN title TO name;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'courses'
                   AND column_name = 'code') THEN
    ALTER TABLE courses ADD COLUMN code VARCHAR(20);
    UPDATE courses SET code = 'COURSE-' || id;  -- placeholder for any pre-existing rows
    ALTER TABLE courses ALTER COLUMN code SET NOT NULL;
    ALTER TABLE courses ADD CONSTRAINT courses_code_key UNIQUE (code);
  END IF;
END $$;

-- ---------------------------------------------------------------
-- course_enrollments: join table, students <-> courses (many-to-many)
-- (the app layer must ensure student_id belongs to a student)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_enrollments (
  course_id    INTEGER NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES users (id)   ON DELETE CASCADE,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, student_id)
);

-- ---------------------------------------------------------------
-- assignments: created by a professor for one of their courses.
-- created_by is the professor; the course row already says who owns the course.
-- updated_at is set by the API whenever an assignment is edited.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id        INTEGER NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title            VARCHAR(200) NOT NULL,
  description      TEXT NOT NULL,
  deadline         TIMESTAMPTZ NOT NULL,
  submission_type  VARCHAR(20) NOT NULL,
  created_by       INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assignments_submission_type_check CHECK (submission_type IN ('individual', 'group'))
);

-- Upgrade for databases created before Phase 3, where assignments had
-- "due_date", an optional description and no submission_type, created_by
-- or updated_at. Does nothing on a fresh or already upgraded database.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'assignments'
               AND column_name = 'due_date') THEN
    ALTER TABLE assignments RENAME COLUMN due_date TO deadline;
    UPDATE assignments SET deadline = created_at WHERE deadline IS NULL;
    ALTER TABLE assignments ALTER COLUMN deadline SET NOT NULL;
  END IF;

  UPDATE assignments SET description = '' WHERE description IS NULL;
  ALTER TABLE assignments ALTER COLUMN description SET NOT NULL;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'assignments'
                   AND column_name = 'submission_type') THEN
    ALTER TABLE assignments ADD COLUMN submission_type VARCHAR(20) NOT NULL DEFAULT 'individual';
    ALTER TABLE assignments ALTER COLUMN submission_type DROP DEFAULT;
    ALTER TABLE assignments ADD CONSTRAINT assignments_submission_type_check
      CHECK (submission_type IN ('individual', 'group'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'assignments'
                   AND column_name = 'created_by') THEN
    ALTER TABLE assignments ADD COLUMN created_by INTEGER;
    UPDATE assignments SET created_by = c.professor_id FROM courses c WHERE c.id = assignments.course_id;
    ALTER TABLE assignments ALTER COLUMN created_by SET NOT NULL;
    ALTER TABLE assignments ADD CONSTRAINT assignments_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'assignments'
                   AND column_name = 'updated_at') THEN
    ALTER TABLE assignments ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ---------------------------------------------------------------
-- groups: a group of students formed for one group assignment.
-- leader_id is one of the group's members (see groups_leader_is_member_fkey below).
-- Only students are added to groups; the API checks that, because a foreign
-- key cannot look at a role.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id  INTEGER NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  leader_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- group_members: one row per student in a group.
-- The API allows a student in one group per assignment and fixes the
-- members when the group is created.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id    INTEGER NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT group_members_group_student_key UNIQUE (group_id, student_id)
);

-- Upgrade for databases created before Phase 4. Earlier phases never created a
-- group, so these tables are empty. Does nothing on a fresh or upgraded database.
DO $$
BEGIN
  -- groups: the leader replaces the old group name
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'groups'
               AND column_name = 'name') THEN
    ALTER TABLE groups DROP COLUMN name;  -- also drops its UNIQUE (assignment_id, name)
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'groups'
                   AND column_name = 'leader_id') THEN
    ALTER TABLE groups ADD COLUMN leader_id INTEGER;
    UPDATE groups SET leader_id =
      (SELECT MIN(gm.student_id) FROM group_members gm WHERE gm.group_id = groups.id);
    ALTER TABLE groups ALTER COLUMN leader_id SET NOT NULL;
    ALTER TABLE groups ADD CONSTRAINT groups_leader_id_fkey
      FOREIGN KEY (leader_id) REFERENCES users (id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'groups'
                   AND column_name = 'updated_at') THEN
    ALTER TABLE groups ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- group_members: own id, created_at instead of joined_at
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'group_members'
               AND column_name = 'joined_at') THEN
    ALTER TABLE group_members RENAME COLUMN joined_at TO created_at;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'group_members'
                   AND column_name = 'id') THEN
    ALTER TABLE group_members DROP CONSTRAINT group_members_pkey;
    ALTER TABLE group_members ADD COLUMN id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
    ALTER TABLE group_members ADD CONSTRAINT group_members_group_student_key
      UNIQUE (group_id, student_id);
  END IF;
END $$;

-- The leader must be a member of their own group. Deferred, so the group row
-- can be inserted before its member rows inside one transaction; it is checked
-- when that transaction commits.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'groups_leader_is_member_fkey'
                   AND conrelid = 'groups'::regclass) THEN
    ALTER TABLE groups ADD CONSTRAINT groups_leader_is_member_fkey
      FOREIGN KEY (id, leader_id) REFERENCES group_members (group_id, student_id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- submissions: work handed in for an assignment.
--   Individual assignment: one row per student (group_id is NULL).
--   Group assignment: one row per group (group_id set); student_id is the
--   member who submitted it for the group.
-- content holds the text or URL that was submitted.
-- status: a row is created when someone submits, so it is always 'submitted'
--   today. 'not_submitted' is what the API reports when there is no row.
-- acknowledged_at / acknowledged_by: the group leader's acknowledgement of a
--   group submission (NULL = not acknowledged). Never set on individual work.
-- file_url, grade and feedback are for later phases and unused so far.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id  INTEGER NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES users (id)       ON DELETE CASCADE,
  group_id       INTEGER REFERENCES groups (id) ON DELETE SET NULL,
  content        TEXT NOT NULL,
  file_url       TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'submitted',
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  grade          NUMERIC(5, 2),
  feedback       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at  TIMESTAMPTZ,
  acknowledged_by  INTEGER REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT submissions_assignment_student_key UNIQUE (assignment_id, student_id),
  CONSTRAINT submissions_group_key UNIQUE (group_id),
  CONSTRAINT submissions_status_check CHECK (status IN ('not_submitted', 'submitted')),
  CONSTRAINT submissions_ack_group_only CHECK (acknowledged_at IS NULL OR group_id IS NOT NULL)
);

-- Upgrade for databases created before Phase 3 (no status, created_at,
-- updated_at or one-per-student rule; content was optional).
DO $$
BEGIN
  UPDATE submissions SET content = COALESCE(file_url, '') WHERE content IS NULL;
  ALTER TABLE submissions ALTER COLUMN content SET NOT NULL;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'submissions'
                   AND column_name = 'status') THEN
    ALTER TABLE submissions ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'submitted';
    ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
      CHECK (status IN ('not_submitted', 'submitted'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'submissions'
                   AND column_name = 'created_at') THEN
    ALTER TABLE submissions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'submissions'
                   AND column_name = 'updated_at') THEN
    ALTER TABLE submissions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'submissions_assignment_student_key'
                   AND conrelid = 'submissions'::regclass) THEN
    ALTER TABLE submissions ADD CONSTRAINT submissions_assignment_student_key
      UNIQUE (assignment_id, student_id);
  END IF;
END $$;

-- Upgrade for databases created before Phase 4 (no acknowledgement columns,
-- no one-submission-per-group rule).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'submissions'
                   AND column_name = 'acknowledged_at') THEN
    ALTER TABLE submissions ADD COLUMN acknowledged_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'submissions'
                   AND column_name = 'acknowledged_by') THEN
    ALTER TABLE submissions ADD COLUMN acknowledged_by INTEGER REFERENCES users (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'submissions_group_key'
                   AND conrelid = 'submissions'::regclass) THEN
    ALTER TABLE submissions ADD CONSTRAINT submissions_group_key UNIQUE (group_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'submissions_ack_group_only'
                   AND conrelid = 'submissions'::regclass) THEN
    ALTER TABLE submissions ADD CONSTRAINT submissions_ack_group_only
      CHECK (acknowledged_at IS NULL OR group_id IS NOT NULL);
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Indexes for foreign keys not already covered by a primary/unique key
-- (users.email, enrollments by course and group_members by group are
--  covered by their constraints)
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_courses_professor_id       ON courses (professor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id     ON course_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id      ON assignments (course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_created_by     ON assignments (created_by);
CREATE INDEX IF NOT EXISTS idx_groups_assignment_id        ON groups (assignment_id);
CREATE INDEX IF NOT EXISTS idx_groups_leader_id            ON groups (leader_id);
CREATE INDEX IF NOT EXISTS idx_group_members_student_id   ON group_members (student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id  ON submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id     ON submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_group_id       ON submissions (group_id);
