// Request validation. Each function returns { errors, value }:
//   errors: { field: message } (empty when the input is valid)
//   value:  the cleaned input (trimmed name, lowercased email, ...)

const ROLES = ['student', 'professor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything past 72 bytes

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

function checkEmail(input, errors) {
  if (!isNonEmptyString(input)) {
    errors.email = 'Email is required';
    return undefined;
  }
  const email = input.trim().toLowerCase();
  if (email.length > 255 || !EMAIL_REGEX.test(email)) {
    errors.email = 'Enter a valid email address';
    return undefined;
  }
  return email;
}

function checkNewPassword(input, errors) {
  if (typeof input !== 'string' || input === '') {
    errors.password = 'Password is required';
  } else if (input.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  } else if (Buffer.byteLength(input, 'utf8') > MAX_PASSWORD_BYTES) {
    errors.password = 'Password is too long (72 bytes maximum)';
  } else if (!/[A-Za-z]/.test(input) || !/\d/.test(input)) {
    errors.password = 'Password must include at least one letter and one number';
  }
  return errors.password ? undefined : input;
}

function validateRegister(body = {}) {
  const errors = {};
  const { name, email, password, role } = body;

  if (!isNonEmptyString(name)) {
    errors.name = 'Name is required';
  } else if (name.trim().length > 100) {
    errors.name = 'Name must be 100 characters or fewer';
  }

  const cleanEmail = checkEmail(email, errors);
  const cleanPassword = checkNewPassword(password, errors);

  if (role === undefined || role === null || role === '') {
    errors.role = 'Role is required';
  } else if (!ROLES.includes(role)) {
    errors.role = 'Role must be student or professor';
  }

  return {
    errors,
    value: {
      name: isNonEmptyString(name) ? name.trim() : undefined,
      email: cleanEmail,
      password: cleanPassword,
      role,
    },
  };
}

// Login only checks the shape. Whether the credentials are right is decided
// by the service, so strength rules are not applied here.
function validateLogin(body = {}) {
  const errors = {};
  const { email, password } = body;

  const cleanEmail = checkEmail(email, errors);
  if (typeof password !== 'string' || password === '') {
    errors.password = 'Password is required';
  }

  return { errors, value: { email: cleanEmail, password } };
}

const COURSE_CODE_REGEX = /^[A-Z0-9][A-Z0-9 _-]*$/;
const MAX_INT4 = 2147483647; // largest value of a PostgreSQL INTEGER id

// Course fields: name and code (required on create), description (optional).
// With { partial: true } (used by update) every field is optional, but any field
// that is sent must be valid and at least one must be sent.
// The code is trimmed and upper-cased so "cs101" and "CS101" are the same course.
function validateCourse(body = {}, { partial = false } = {}) {
  const errors = {};
  const value = {};
  const { name, code, description } = body;

  if (!partial || name !== undefined) {
    if (!isNonEmptyString(name)) {
      errors.name = 'Course name is required';
    } else if (name.trim().length > 200) {
      errors.name = 'Course name must be 200 characters or fewer';
    } else {
      value.name = name.trim();
    }
  }

  if (!partial || code !== undefined) {
    const cleanCode = isNonEmptyString(code) ? code.trim().toUpperCase() : '';
    if (cleanCode === '') {
      errors.code = 'Course code is required';
    } else if (cleanCode.length > 20) {
      errors.code = 'Course code must be 20 characters or fewer';
    } else if (!COURSE_CODE_REGEX.test(cleanCode)) {
      errors.code = 'Course code can only use letters, numbers, spaces, hyphens and underscores';
    } else {
      value.code = cleanCode;
    }
  }

  if (description !== undefined) {
    if (description === null || description === '') {
      value.description = null;
    } else if (typeof description !== 'string') {
      errors.description = 'Description must be text';
    } else if (description.trim().length > 2000) {
      errors.description = 'Description must be 2000 characters or fewer';
    } else {
      value.description = description.trim() || null;
    }
  }

  if (partial && Object.keys(errors).length === 0 && Object.keys(value).length === 0) {
    errors.body = 'Send at least one field to update: name, code or description';
  }

  return { errors, value };
}

// Same for an id in a JSON body: only a number or a string qualifies, so [5] is not read as 5.
const parseBodyId = (value) => (typeof value === 'number' || typeof value === 'string' ? parseId(value) : undefined);

// Turns a URL parameter into a positive integer id, or undefined if it is not one.
function parseId(raw) {
  const text = String(raw);
  if (!/^[1-9]\d{0,9}$/.test(text) || Number(text) > MAX_INT4) return undefined;
  return Number(text);
}

const SUBMISSION_TYPES = ['individual', 'group'];
const SUBMISSION_STATUSES = ['not_submitted', 'submitted'];
const MIN_DEADLINE_YEAR = 1970;

// Date and time as ISO 8601, e.g. 2026-05-01T17:00:00Z or 2026-05-01T17:00:00+05:30.
// A value without a timezone is read in the server's timezone, so clients should send one.
const DEADLINE_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)?$/;

// Returns a Date, or undefined when the text is not a real date and time.
// (JavaScript quietly turns 2026-02-31 into 2026-03-03, so the day is checked too.)
function parseDeadline(input) {
  if (typeof input !== 'string') return undefined;
  const match = DEADLINE_REGEX.exec(input.trim());
  if (!match) return undefined;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return undefined;
  if (year < MIN_DEADLINE_YEAR) return undefined;

  const date = new Date(input.trim());
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Assignment fields. On create (default) title, description, deadline, submission_type
// and course_id are required. With { partial: true } (update) every field is optional,
// but any field that is sent must be valid and at least one must be sent.
// course_id is only read on create: an assignment never moves to another course.
// The deadline comes back as a normalized ISO string (UTC).
function validateAssignment(body = {}, { partial = false } = {}) {
  const errors = {};
  const value = {};
  const { course_id: courseId, title, description, deadline, submission_type: submissionType } = body;

  if (!partial) {
    const id = parseBodyId(courseId);
    if (id === undefined) errors.course_id = 'A valid course_id is required';
    else value.course_id = id;
  }

  if (!partial || title !== undefined) {
    if (!isNonEmptyString(title)) {
      errors.title = 'Title is required';
    } else if (title.trim().length > 200) {
      errors.title = 'Title must be 200 characters or fewer';
    } else {
      value.title = title.trim();
    }
  }

  if (!partial || description !== undefined) {
    if (!isNonEmptyString(description)) {
      errors.description = 'Description is required';
    } else if (description.trim().length > 5000) {
      errors.description = 'Description must be 5000 characters or fewer';
    } else {
      value.description = description.trim();
    }
  }

  if (!partial || deadline !== undefined) {
    if (deadline === undefined || deadline === null || deadline === '') {
      errors.deadline = 'Deadline is required';
    } else {
      const date = parseDeadline(deadline);
      if (date === undefined) {
        errors.deadline = 'Deadline must be a valid date and time, for example 2026-05-01T17:00:00Z';
      } else {
        value.deadline = date.toISOString();
      }
    }
  }

  if (!partial || submissionType !== undefined) {
    if (submissionType === undefined || submissionType === null || submissionType === '') {
      errors.submission_type = 'Submission type is required';
    } else if (!SUBMISSION_TYPES.includes(submissionType)) {
      errors.submission_type = 'Submission type must be individual or group';
    } else {
      value.submission_type = submissionType;
    }
  }

  if (partial && Object.keys(errors).length === 0 && Object.keys(value).length === 0) {
    errors.body = 'Send at least one field to update: title, description, deadline or submission_type';
  }

  return { errors, value };
}

// What a student hands in for now: plain text or a link.
function validateSubmission(body = {}) {
  const errors = {};
  const { content } = body;

  if (!isNonEmptyString(content)) {
    errors.content = 'Submission content is required';
  } else if (content.trim().length > 5000) {
    errors.content = 'Submission must be 5000 characters or fewer';
  }

  return { errors, value: { content: isNonEmptyString(content) ? content.trim() : undefined } };
}

const MAX_LISTED_MEMBERS = 50; // sanity cap on the request; the real limit is GROUP_MAX_MEMBERS

// Request to create a group. The student sending it is always a member and is the
// leader unless leader_id says otherwise.
//   member_ids: optional list of the other students to add (no repeats)
//   leader_id:  optional, must end up being one of the members (checked by the service)
function validateGroup(body = {}) {
  const errors = {};
  const value = { member_ids: [], leader_id: undefined };
  const { member_ids: memberIds, leader_id: leaderId } = body;

  if (memberIds !== undefined) {
    if (!Array.isArray(memberIds) || memberIds.length > MAX_LISTED_MEMBERS) {
      errors.member_ids = 'member_ids must be a list of student ids';
    } else {
      const ids = memberIds.map(parseBodyId);
      if (ids.includes(undefined)) {
        errors.member_ids = 'Every member id must be a positive whole number';
      } else if (new Set(ids).size !== ids.length) {
        errors.member_ids = 'Each student can be listed only once';
      } else {
        value.member_ids = ids;
      }
    }
  }

  if (leaderId !== undefined && leaderId !== null) {
    const id = parseBodyId(leaderId);
    if (id === undefined) errors.leader_id = 'leader_id must be a student id';
    else value.leader_id = id;
  }

  return { errors, value };
}

module.exports = {
  ROLES,
  SUBMISSION_TYPES,
  SUBMISSION_STATUSES,
  validateRegister,
  validateLogin,
  validateCourse,
  validateAssignment,
  validateSubmission,
  validateGroup,
  parseId,
  parseDeadline,
};
