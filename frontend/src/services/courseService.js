import { api } from './api.js';

export const getProfessorCourses = async () => (await api.get('/courses/professor')).data.courses;
export const getStudentCourses = async () => (await api.get('/courses/student')).data.courses;
export const getCourse = async (id) => (await api.get(`/courses/${id}`)).data.course;
export const createCourse = async (details) => (await api.post('/courses', details)).data.course;
export const updateCourse = async (id, details) => (await api.put(`/courses/${id}`, details)).data.course;

export async function deleteCourse(id) {
  await api.delete(`/courses/${id}`);
}
