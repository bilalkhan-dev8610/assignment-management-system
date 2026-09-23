import { clearSession, getToken } from '../utils/session.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Thrown for every failed request so pages handle one error shape:
//   status  - HTTP status (0 when the server could not be reached)
//   message - text safe to show to the user
//   errors  - optional { field: message } from server-side validation
export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // The API rejected our token (expired or invalid): end the session.
    if (response.status === 401 && auth && token) {
      clearSession();
      window.location.replace('/login?session=expired');
    }
    throw new ApiError(data?.message || 'Something went wrong. Please try again.', response.status, data?.errors);
  }
  return data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
