import { api } from './api.js';

export const getCourseAssignments = async (courseId) =>
  (await api.get(`/assignments/course/${courseId}`)).data.assignments;
export const getAssignment = async (id) => (await api.get(`/assignments/${id}`)).data.assignment;
export const createAssignment = async (details) => (await api.post('/assignments', details)).data.assignment;
export const updateAssignment = async (id, details) =>
  (await api.put(`/assignments/${id}`, details)).data.assignment;

// Student
export const submitAssignment = async (id, content) =>
  (await api.post(`/assignments/${id}/submit`, { content })).data.submission;
export const getMySubmission = async (id) => (await api.get(`/assignments/${id}/submission`)).data.submission;

// Professor: status is '', 'submitted' or 'not_submitted'
export async function getSubmissions(id, status) {
  const query = status ? `?status=${status}` : '';
  return (await api.get(`/assignments/${id}/submissions${query}`)).data.submissions;
}
