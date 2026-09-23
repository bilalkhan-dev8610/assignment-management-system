// The JWT and the basic user record live in localStorage so a refresh keeps the
// user signed in. The stored role only decides which pages to show; the API
// checks the token on every request and is the real authority.
const TOKEN_KEY = 'assignment_manager_token';
const USER_KEY = 'assignment_manager_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
