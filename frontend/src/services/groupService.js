import { api } from './api.js';

// Student: the group they belong to for this assignment, or null.
export async function getMyGroup(assignmentId) {
  const groups = (await api.get(`/assignments/${assignmentId}/groups`)).data.groups;
  return groups[0] || null;
}

// Student: classmates who can still be added, plus the size limit ({ students, max_members }).
export const getGroupCandidates = async (assignmentId) =>
  (await api.get(`/assignments/${assignmentId}/group-candidates`)).data;

export const createGroup = async (assignmentId, details) =>
  (await api.post(`/assignments/${assignmentId}/groups`, details)).data.group;

// Leader only; the API rejects anyone else.
export const acknowledgeGroup = async (groupId) => (await api.post(`/groups/${groupId}/acknowledge`)).data.group;

// Professor: every group of the assignment. status is '', 'submitted' or 'not_submitted'.
export async function getAssignmentGroups(assignmentId, status) {
  const query = status ? `?status=${status}` : '';
  return (await api.get(`/assignments/${assignmentId}/groups${query}`)).data.groups;
}
