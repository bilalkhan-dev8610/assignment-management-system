# Screenshots

None of the files in this folder are committed yet — this file is only the checklist.
Run the app locally (see the root README), sign in as each role, and save a PNG or JPG
for each item below directly into this folder, using the exact filename given, before
final submission.

| # | Filename | Screen | How to reach it |
|---|----------|--------|------------------|
| 1 | `01-login.png` | Login | `/login` |
| 2 | `02-register.png` | Registration | `/register` |
| 3 | `03-student-dashboard.png` | Student dashboard | Sign in as a student |
| 4 | `04-available-courses.png` | Available courses | See **Known limitations** in the root README — this screen does not exist in the current codebase, so this shot cannot be captured yet |
| 5 | `05-enrolled-course.png` | An enrolled course's detail page | `/student/courses/:id` |
| 6 | `06-professor-dashboard.png` | Professor dashboard | Sign in as a professor |
| 7 | `07-course-management.png` | Create/edit course form | `/professor/courses/new` |
| 8 | `08-assignment-creation.png` | Create assignment form | `/professor/courses/:courseId/assignments/new` |
| 9 | `09-student-assignment-view.png` | Assignment details (student) | `/student/assignments/:id` |
| 10 | `10-submission-status.png` | Submission status badge, either role | Same page as #9, or `/professor/assignments/:id/submissions` |
| 11 | `11-group-assignment.png` | Group assignment view | `/student/assignments/:id` for a group-type assignment |
| 12 | `12-group-acknowledgement.png` | Acknowledged status, group panel | Same page as #11, after the leader acknowledges |

All 12 are still required — none exist yet. Item 4 needs the Available Courses feature
to be built first (see the root README's Known limitations section).
