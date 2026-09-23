import { api } from './api.js';
import { clearSession, saveSession } from '../utils/session.js';

export async function register(details) {
  const response = await api.post('/auth/register', details, { auth: false });
  return response.data.user;
}

export async function login(credentials) {
  const response = await api.post('/auth/login', credentials, { auth: false });
  saveSession(response.data.token, response.data.user);
  return response.data.user;
}

export async function getCurrentUser() {
  const response = await api.get('/auth/me');
  return response.data.user;
}

export function logout() {
  clearSession();
}
