# Student & Professor Assignment Management System

A full-stack web app where professors create courses and assignments, and students
enroll, submit work individually or in groups, and track submission status. Built in
phases (foundation → courses → assignments → groups → UI polish → this final QA pass).

**Read this before anything else:** [Known limitations](#known-limitations) lists one
feature this README's own outline calls for — a browsable "Available Courses" list —
that is **not implemented** in this codebase. Everything else below is accurate as of
this phase.

## Project overview

Two roles, one login:

- **Professors** create and manage courses, create assignments (individual or group),
  and monitor submissions and group acknowledgement.
- **Students** see the courses they're enrolled in, view assignments, submit work
  (alone or as a group), and track submission and acknowledgement status.

## Features

- Email/password authentication with JWT, roles enforced on every protected route
- Professor: create, edit, delete courses; create, edit assignments; monitor submissions
  with a status filter
- Student: view enrolled courses and their assignments, submit individual assignments
- Groups: students form a group for a group-type assignment, one submission per group,
  and only the group's leader can acknowledge that submission
- A responsive UI with a shared component library (buttons, cards, badges, a modal,
  loading/empty/error states) — see [UI/UX choices](#uiux-choices)

## Tech stack

| Part | Stack |
|------|-------|
| `frontend/` | React 18, Vite, Tailwind CSS 3, React Router |
| `backend/` | Node.js, Express 4, PostgreSQL (`pg`), JWT, bcrypt |

The two apps are independent: each has its own `package.json` and can be started on
its own. There is no monorepo tool (no Turborepo/Nx) — two `npm install`s is enough.

## Architecture

```
Browser (React SPA)
   │  fetch, Bearer JWT in Authorization header
   ▼
Express API (backend/src)
   routes → controllers → services → PostgreSQL (pg pool)
   middleware: authenticate (verifies JWT) → requireRole (checks req.user.role)
```

- **routes** map a URL to a controller function.
- **controllers** parse/validate the request and shape the JSON response.
- **services** hold the business rules and the SQL — ownership checks, enrollment
  checks, duplicate-prevention, deadline handling, group rules, acknowledgement.
- Authorization is enforced in the services, not just the routes, so a controller
  can't accidentally skip a check.

## Student workflow

1. Register or log in → land on `/student`.
2. See enrolled courses as cards → open one for its assignment list.
3. Open an assignment → see title, description, deadline, type and status.
4. **Individual assignment:** submit text or a link, once, before the deadline.
5. **Group assignment:** create a group (pick classmates and a leader) or see the
   group you're already in, then any member submits once for the whole group.
6. The leader (only) acknowledges the group's submission; every member sees the
   same acknowledged/not-acknowledged status, reloaded from the database.

## Professor workflow

1. Register or log in → land on `/professor`.
2. Create a course (name, unique code, optional description).
3. Open a course → create an assignment (title, description, deadline, individual
   or group).
4. Open an assignment → for individual assignments, view the per-student submission
   table with a status filter; for group assignments, view every group with its
   leader, members, submission and acknowledgement status.
5. Edit a course or assignment; deleting a course also deletes its assignments,
   submissions and enrollments.

## Authentication

- Passwords are hashed with bcrypt (`bcryptjs`) before they touch the database —
  the `users.password` column never holds plain text.
- `POST /api/auth/login` returns a JWT (`Authorization: Bearer <token>`), which
  `authenticate` middleware verifies on every protected route, and `requireRole`
  checks against `req.user.role`.
- The frontend keeps the token and a copy of the signed-in user in `localStorage`;
  a `401` from the API clears both and redirects to `/login?session=expired`.
- Duplicate emails are rejected via a `UNIQUE` constraint on `users.email`, not just
  application logic, so a race between two identical sign-ups can't both succeed.

## Course management

Professors create, list, edit and delete their own courses (`/api/courses`, professor
role required for anything but reading). A professor can never modify another
professor's course — the service checks `course.professor_id` against the token's
user id before any write, independent of what the frontend shows.

## Available Courses / Enrollment

**Current state:** a student is enrolled in a course via `POST
/api/courses/:courseId/enroll`, and `GET /api/courses/student` lists the courses
they're already in. **There is no "browse courses I'm not in yet" endpoint or screen.**
See [Known limitations](#known-limitations) — this is the one gap this phase found
between what was expected and what the code actually contains.

Enrollment itself, once it happens, is solid: `course_enrollments` has a composite
primary key `(course_id, student_id)`, so the database — not just the API — refuses a
duplicate row, and it persists normally across refresh/logout/login since it's a real
table, not client state.

## Assignment management

Professors create assignments under a course they own (title, description, a
deadline, and `individual` or `group`). Editing is partial — send only the fields
that changed. An assignment's type is locked once a submission or group exists for
it, so a professor can't turn a graded individual assignment into a group one
after the fact.

## Individual submission

A student enrolled in the course submits once (text or a link) before the deadline;
`submissions` has a `UNIQUE (assignment_id, student_id)` constraint, so a second
attempt is rejected by the database, not just checked in code. After the deadline,
`POST /:assignmentId/submit` returns `409` and nothing is written — there is no late
submission or resubmission in this system.

## Group assignment

For a `group`-type assignment, a student without a group first creates one (picking
enrolled classmates and a leader; size capped by `GROUP_MAX_MEMBERS`, default 4,
leader included). Any member can then submit once for the whole group —
`submissions.group_id` is `UNIQUE`, so the group has exactly one submission row, not
one per member. `groups.leader_id` is required to also be a row in `group_members`
for that group (enforced by a composite foreign key), so a leader who isn't a member
is impossible at the database level, not just checked in the API.

## Group acknowledgement

Only the group's leader can acknowledge the group's submission
(`POST /api/groups/:groupId/acknowledge`). The backend checks, in order: valid token
→ student role → group exists → it's a group-assignment's group → caller is a member
→ caller is the leader → the group has actually submitted. The result
(`acknowledged_at`, `acknowledged_by`) is a column on the submission row, so every
member and the professor read the same value from PostgreSQL — it survives a refresh
or a fresh login, and there is no frontend-only "acknowledged" state anywhere.

## UI/UX choices

A small shared component library instead of one-off markup per page:
`Button` (boxed and inline-link variants), `Card`, `Badge` (status/acknowledgement/
type pills all built on it), `Modal` (used for the delete-course confirmation, not
`window.confirm`), `Loader`/`SkeletonCard` (loading states), `PageHeader`,
`BackLink`, `ProgressBar` (drawn from real submitted/total counts, never invented
numbers), and `ErrorMessage` for failed data loads specifically (`Alert` is used
directly for form validation and success/info notices). The visual language is a
plain "notebook" palette (ink blue, off-white page, a red rule) with IBM Plex
Sans/Serif — deliberately not a generic dashboard template.

## Responsive design

Card grids run 1 column by default, 2 at 640px, 3 at 1024px, 4 at 1280px+ (Tailwind's
default breakpoints, which already line up with 360/390/768/1024/1280px). The top
navigation collapses the user's name, role and sign-out button behind a toggle below
640px so nothing wraps or overflows on a small phone. Submission tables scroll
horizontally on narrow screens instead of squeezing columns unreadably. **This has
been checked by reading the code and the compiled Tailwind classes, not by opening a
browser at each width** — see [Testing](#testing).

## Project structure

```
/
  backend/
    src/
      config/       env loading and validation
      db/           pg pool, schema.sql (with in-place upgrade blocks), init script
      routes/       URL → controller mapping
      controllers/  HTTP layer: validate input, shape the response
      services/     business logic and SQL
      middleware/   authenticate (JWT), requireRole, error handling
      utils/        validators, AppError, token helpers
    tests/          node:test unit tests (validators + services, no DB required)
  frontend/
    src/
      components/   shared UI: Button, Card, Badge, Modal, Loader, forms, etc.
      pages/         one file per route
      layouts/       AuthLayout (login/register), AppLayout (signed-in shell)
      services/      one file per API resource (auth, courses, assignments, groups)
      hooks/         useLoad (fetch + loading/error state), useFlashNotice
      utils/         session storage, role routing, date/deadline formatting
  docs/
    screenshots/    checklist + where screenshots go before submission
  README.md
```

## Prerequisites

- Node.js 20 or newer
- A running PostgreSQL 14 or newer

## Environment variables

`backend/.env` (copy from `backend/.env.example`):

| Variable | Meaning |
|----------|---------|
| `PORT` | Port the API listens on (default 5000) |
| `DATABASE_URL` | e.g. `postgresql://USER:PASSWORD@localhost:5432/assignment_db` |
| `JWT_SECRET` | Long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | Origin allowed by CORS (default `http://localhost:5173`) |
| `GROUP_MAX_MEMBERS` | Largest group size, leader included (optional, default 4) |

`frontend/.env` (copy from `frontend/.env.example`; optional for local dev):

| Variable | Meaning |
|----------|---------|
| `VITE_API_URL` | Base API URL (default `http://localhost:5000/api`) |

**Never commit `.env`.** `.gitignore` excludes `.env` and `.env.*` but keeps
`.env.example`, so only placeholders ever reach the repository.

## PostgreSQL setup

```bash
createdb assignment_db   # or create the database with pgAdmin / psql
```

`npm run db:init` (see below) then creates every table. It's idempotent — safe to
run again — and it upgrades a database created by an earlier phase of this project
in place (e.g. it renames `courses.title` to `courses.name` if it finds the old
column, adds `submission_type`, `created_by`, group tables, and so on, only where
they're missing).

## Backend setup

```bash
cd backend
cp .env.example .env      # then edit DATABASE_URL and JWT_SECRET
npm install
npm run db:init
npm run dev                # http://localhost:5000/api
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## Run instructions

Run the backend and frontend setup steps above in two terminals. Open
`http://localhost:5173`, register a professor account and a student account, and
follow the workflows described above. There is no seed script — any credentials
used while building this were manual local testing, not shipped fixtures.

## API reference

All responses are JSON: `{ success: true, data, message? }` or
`{ success: false, message, errors? }` (field errors keyed by field name).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | none | Health check |
| POST | `/api/auth/register` | none | Create an account |
| POST | `/api/auth/login` | none | Returns `{ token, user }` |
| GET | `/api/auth/me` | any | The signed-in user |
| POST | `/api/courses` | professor | Create a course |
| GET | `/api/courses/professor` | professor | The professor's own courses |
| GET | `/api/courses/student` | student | Courses the student is enrolled in |
| GET | `/api/courses/:id` | owner or enrolled | Course details |
| PUT | `/api/courses/:id` | professor (owner) | Update a course |
| DELETE | `/api/courses/:id` | professor (owner) | Delete a course |
| POST | `/api/courses/:courseId/enroll` | student | Enroll the signed-in student |
| POST | `/api/assignments` | professor | Create an assignment |
| GET | `/api/assignments/course/:courseId` | owner or enrolled | List a course's assignments |
| GET | `/api/assignments/:id` | owner or enrolled | Assignment details |
| PUT | `/api/assignments/:id` | professor (owner) | Update an assignment |
| POST | `/api/assignments/:assignmentId/submit` | student | Submit (individual or, for a group assignment, on behalf of the group) |
| GET | `/api/assignments/:assignmentId/submission` | student | The caller's own (or group's) status |
| GET | `/api/assignments/:assignmentId/submissions[?status=]` | professor | Per-student status (individual assignments only) |
| POST | `/api/assignments/:assignmentId/groups` | student (enrolled) | Create a group |
| GET | `/api/assignments/:assignmentId/groups[?status=]` | owner or enrolled | List groups (professor: all; student: their own) |
| GET | `/api/assignments/:assignmentId/group-candidates` | student (enrolled) | Classmates available to add, and the size limit |
| GET | `/api/groups/:groupId` | member or owning professor | Group details |
| POST | `/api/groups/:groupId/acknowledge` | student (leader only) | Acknowledge the group's submission |

Status codes: `200`/`201` success, `400` validation or a malformed id, `401` missing/
invalid/expired token or bad credentials, `403` wrong role or not yours, `404`
unknown route/course/assignment/group, `409` a state conflict (duplicate code,
duplicate enrollment, duplicate submission, past deadline, already acknowledged),
`500` unexpected error.

## Testing

**Automated (actually run, not just written):**

```bash
cd backend && npm test
```

126 `node:test` assertions covering input validation and every service's business
rules (ownership, enrollment, deadlines, duplicate prevention, group membership,
leader-only acknowledgement) against an in-memory stand-in for PostgreSQL — fast,
and they don't need a running database. They do **not** exercise the real SQL, the
HTTP layer, or the React app; see [Known limitations](#known-limitations).

**Manual (required before submission, not yet performed in a browser):** work
through the full regression list below, in a real browser, against a real
PostgreSQL database — registration, login/logout for both roles, the complete course
→ assignment → submission → acknowledgement flow for both an individual and a group
assignment, and the responsive breakpoints listed under
[Responsive design](#responsive-design).

## Deployment

Not deployed. This documents how to, and what's needed:

| Part | Suggested host | What it needs |
|------|-----------------|----------------|
| Frontend | Vercel or Netlify | Build command `npm run build` in `frontend/`, output directory `dist/`, environment variable `VITE_API_URL` set to the deployed backend's URL (**not** `localhost`) |
| Backend | Any Node-compatible host (Render, Railway, Fly.io, etc.) | Start command `npm start` in `backend/`, environment variables `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (set to the deployed frontend's URL, for CORS) |
| Database | Any managed PostgreSQL (the same host's add-on, Supabase, Neon, etc.) | Run `npm run db:init` once against it after setting `DATABASE_URL` |

Manual steps, in order: provision the database → deploy the backend with its env
vars set → run `db:init` against the live database → deploy the frontend with
`VITE_API_URL` pointing at the live backend → update the backend's `FRONTEND_URL`
to the live frontend's origin (CORS is an exact-origin allowlist, not a wildcard) →
smoke-test registration and login on the live URLs.

## Screenshots

See `docs/screenshots/README.md` for the required list and exact filenames. None
are captured yet — they need a running instance and a browser, both unavailable in
the environment this project was built in.

## Demo video

Not recorded. Suggested outline once the app is running locally: register both
roles → professor creates a course and an assignment of each type → student
enrolls (via the API, until Available Courses exists — see below), submits an
individual assignment, then forms a group and submits as a group → leader
acknowledges → refresh to show the acknowledgement persisted.

## Known limitations

- **Available Courses / browse-and-enroll UI does not exist.** There is no
  `GET /api/courses/available` endpoint and no "Available courses" section on the
  student dashboard. Enrollment only works via the existing
  `POST /api/courses/:courseId/enroll`, called directly (e.g. with `curl` or a
  REST client) — a student cannot discover or join a course through the UI today.
  This was checked by reading the actual route files and `StudentDashboard.jsx`,
  not assumed.
- No live deployment; see [Deployment](#deployment) for exact manual steps.
- No screenshots or demo video yet (see above).
- Backend tests are unit-level against an in-memory database stand-in, not
  integration tests against real PostgreSQL, and there's no automated frontend or
  end-to-end test suite.
- No resubmission or late submission: a submission is final and the deadline is a
  hard cutoff, by design (see [Individual submission](#individual-submission)).
- No password reset or email verification.
- No file upload — submissions are text or a link.
