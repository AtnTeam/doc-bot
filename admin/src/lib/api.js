const API_BASE = '/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function setToken(token) {
  localStorage.setItem('admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('admin_token');
}

export function isAuthenticated() {
  return !!getToken();
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getLogs: () => request('/logs'),
  getLog: (id) => request('/logs/' + id),
  deleteLog: (id) => request('/logs/' + id, { method: 'DELETE' }),
  deleteAllLogs: () => request('/logs', { method: 'DELETE' }),

  getDocs: () => request('/docs'),
  getDoc: (filename) => request('/docs/' + encodeURIComponent(filename)),
  createDoc: (filename, content) =>
    request('/docs', {
      method: 'POST',
      body: JSON.stringify({ filename, content }),
    }),
  updateDoc: (filename, content) =>
    request('/docs/' + encodeURIComponent(filename), {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  deleteDoc: (filename) =>
    request('/docs/' + encodeURIComponent(filename), { method: 'DELETE' }),

  createLogStream: () => {
    const token = getToken();
    return new EventSource(`${API_BASE}/logs/stream?token=${token}`);
  },

  // Users
  getUsers: () => request('/users'),
  getUser: (telegramId) => request('/users/' + telegramId),
  setUserApproved: (telegramId, approved) =>
    request('/users/' + telegramId + '/approve', {
      method: 'PUT',
      body: JSON.stringify({ approved }),
    }),
  setUserAccess: (telegramId, filenames) =>
    request('/users/' + telegramId + '/access', {
      method: 'PUT',
      body: JSON.stringify({ filenames }),
    }),

  // Database
  getDbTables: () => request('/database/tables'),
  getDbTable: (name, limit = 200, offset = 0) =>
    request(`/database/tables/${encodeURIComponent(name)}?limit=${limit}&offset=${offset}`),
  createDbStream: () => {
    const token = getToken();
    return new EventSource(`${API_BASE}/database/stream?token=${token}`);
  },
};
