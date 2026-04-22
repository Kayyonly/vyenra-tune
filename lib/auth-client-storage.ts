const AUTH_EMAIL_KEY = 'vynra_auth_email';
const AUTH_NEXT_KEY = 'vynra_auth_next';

function hasWindow() {
  return typeof window !== 'undefined';
}

export function savePendingEmail(email: string) {
  if (!hasWindow()) return;
  const normalizedEmail = email.trim().toLowerCase();
  window.sessionStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);
  window.localStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);
}

export function getPendingEmail() {
  if (!hasWindow()) return '';
  return window.sessionStorage.getItem(AUTH_EMAIL_KEY) ?? window.localStorage.getItem(AUTH_EMAIL_KEY) ?? '';
}

export function clearPendingEmail() {
  if (!hasWindow()) return;
  window.sessionStorage.removeItem(AUTH_EMAIL_KEY);
  window.localStorage.removeItem(AUTH_EMAIL_KEY);
}

export function savePendingNextPath(path: string) {
  if (!hasWindow() || !path.startsWith('/')) return;
  window.sessionStorage.setItem(AUTH_NEXT_KEY, path);
  window.localStorage.setItem(AUTH_NEXT_KEY, path);
}

export function getPendingNextPath() {
  if (!hasWindow()) return '';
  const path = window.sessionStorage.getItem(AUTH_NEXT_KEY) ?? window.localStorage.getItem(AUTH_NEXT_KEY) ?? '';
  return path.startsWith('/') ? path : '';
}

export function clearPendingNextPath() {
  if (!hasWindow()) return;
  window.sessionStorage.removeItem(AUTH_NEXT_KEY);
  window.localStorage.removeItem(AUTH_NEXT_KEY);
}