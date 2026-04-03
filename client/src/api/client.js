export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BASE_URL = API_URL;

async function request(method, path, body) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  let res = await fetch(`${BASE_URL}${path}`, opts);

  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    // Try refresh token before giving up
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        localStorage.setItem('token', refreshData.access_token);
        opts.headers['Authorization'] = `Bearer ${refreshData.access_token}`;
        res = await fetch(`${BASE_URL}${path}`, opts);
      }
    }

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  if (data.access_token) {
    localStorage.setItem('token', data.access_token);
  }
  if (data.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token);
  }
  return data;
}

export async function logout() {
  try {
    const refresh_token = localStorage.getItem('refresh_token');
    await api.post('/auth/logout', { refresh_token });
  } catch (e) {
    // ignore logout errors
  }
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

export async function changePassword(newPassword) {
  return api.post('/auth/change-password', { new_password: newPassword });
}
