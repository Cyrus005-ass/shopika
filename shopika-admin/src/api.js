// Client HTTP pour appeler l'API backend Shopika.
// Le token JWT est lu depuis localStorage ("shopika_token").
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('shopika_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  // Session expirée / token invalidé : on nettoie et on renvoie vers la
  // connexion (sauf pour la connexion elle-même, où un 401 = mauvais mot de passe).
  if (res.status === 401 && token && path !== '/auth/login') {
    localStorage.removeItem('shopika_token');
    localStorage.removeItem('shopika_user');
    window.location.assign('/login');
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// Auth
export const authApi = {
  login: (phone, password) => api.post('/auth/login', { phone, password }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  adminExists: () => api.get('/auth/admin-exists'),
  createFirstAdmin: (fullName, phone, password) =>
    api.post('/auth/create-first-admin', { fullName, phone, password }),
  createAdmin: (fullName, phone, password) =>
    api.post('/auth/create-admin', { fullName, phone, password }),
};

// Admin
export const adminApi = {
  overview: () => api.get('/admin/overview'),
  payoutsPending: () => api.get('/admin/payouts/pending'),
  payout: (storeOrderId) => api.post(`/admin/payouts/${storeOrderId}`),
  refundsPending: () => api.get('/admin/refunds/pending'),
  refund: (storeOrderId) => api.post(`/admin/refunds/${storeOrderId}`),
  disputes: () => api.get('/admin/disputes'),
  resolveDispute: (id, resolution) => api.patch(`/admin/disputes/${id}/resolve`, { resolution }),
  supportMessages: () => api.get('/admin/support'),
  replySupport: (id, reply) => api.patch(`/admin/support/${id}/reply`, { reply }),
  stores: () => api.get('/admin/stores'),
  updateStoreRating: (id, rating) => api.patch(`/admin/stores/${id}/rating`, { rating }),
  suspendStore: (id, reason) => api.patch(`/admin/stores/${id}/suspend`, { reason }),
  reactivateStore: (id) => api.patch(`/admin/stores/${id}/reactivate`),
  deleteStore: (id) => api.del(`/admin/stores/${id}`), // réservé aux boutiques sans historique (test)
  audit: () => api.get('/admin/audit'),
  orders: (params = {}) => api.get(`/admin/orders?${new URLSearchParams(params)}`),
  users: (params = {}) => api.get(`/admin/users?${new URLSearchParams(params)}`),
  setUserActive: (id, isActive) => api.patch(`/admin/users/${id}/active`, { isActive }),
};