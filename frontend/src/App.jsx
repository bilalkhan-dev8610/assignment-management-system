import { Route, Routes } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RedirectHome from './components/RedirectHome.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import StudentCourseDetails from './pages/StudentCourseDetails.jsx';
import ProfessorDashboard from './pages/ProfessorDashboard.jsx';
import CourseForm from './pages/CourseForm.jsx';
import ProfessorCourseAssignments from './pages/ProfessorCourseAssignments.jsx';
import AssignmentForm from './pages/AssignmentForm.jsx';
import ProfessorAssignmentDetails from './pages/ProfessorAssignmentDetails.jsx';
import AssignmentSubmissions from './pages/AssignmentSubmissions.jsx';
import AssignmentGroups from './pages/AssignmentGroups.jsx';
import StudentAssignmentDetails from './pages/StudentAssignmentDetails.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectHome />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute role="student" />}>
        <Route element={<AppLayout />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/courses/:id" element={<StudentCourseDetails />} />
          <Route path="/student/assignments/:id" element={<StudentAssignmentDetails />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="professor" />}>
        <Route element={<AppLayout />}>
          <Route path="/professor" element={<ProfessorDashboard />} />
          <Route path="/professor/courses/new" element={<CourseForm />} />
          <Route path="/professor/courses/:id/edit" element={<CourseForm />} />
          <Route path="/professor/courses/:courseId/assignments" element={<ProfessorCourseAssignments />} />
          <Route path="/professor/courses/:courseId/assignments/new" element={<AssignmentForm />} />
          <Route path="/professor/assignments/:id" element={<ProfessorAssignmentDetails />} />
          <Route path="/professor/assignments/:id/edit" element={<AssignmentForm />} />
          <Route path="/professor/assignments/:id/submissions" element={<AssignmentSubmissions />} />
          <Route path="/professor/assignments/:id/groups" element={<AssignmentGroups />} />
        </Route>
      </Route>

      <Route path="*" element={<RedirectHome />} />
    </Routes>
  );
}
