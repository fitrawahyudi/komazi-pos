// API client abstraction conforming to PRD Section 8
// Base URL: /api/v1 with automatic Bearer token injection

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('komazi-auth-token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.warn(`[API] Server at ${API_BASE_URL} not reachable. Running on frontend local store mode.`);
    return {
      success: false,
      message: 'Backend server not connected. Operating in local mode.',
      error: error.message,
    };
  }
}

export const api = {
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    verifyReset: (username) => request('/auth/forgot-password/verify', { method: 'POST', body: JSON.stringify({ username }) }),
    resetPassword: (data) => request('/auth/forgot-password/reset', { method: 'POST', body: JSON.stringify(data) }),
    getProfile: () => request('/auth/me'),
    updateProfile: (data) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  users: {
    getAll: () => request('/users'),
    create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    resetPassword: (id, newPassword) => request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
    delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  },
  categories: {
    getAll: () => request('/categories'),
    create: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },
  products: {
    getAll: () => request('/products'),
    create: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  },
  orders: {
    getAll: () => request('/orders'),
    getById: (id) => request(`/orders/${id}`),
    create: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    pay: (id, data) => request(`/orders/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }),
    updateKitchenStatus: (id, data) => request(`/orders/${id}/kitchen-status`, { method: 'PATCH', body: JSON.stringify(data) }),
    void: (id, reason, managerPin) => request(`/orders/${id}/void`, { method: 'POST', body: JSON.stringify({ reason, managerPin }) }),
    refund: (id, reason, refundAmount, managerPin) => request(`/orders/${id}/refund`, { method: 'POST', body: JSON.stringify({ reason, refundAmount, managerPin }) }),
  },
  workspace: {
    getAreas: () => request('/workspace/areas'),
    createArea: (data) => request('/workspace/areas', { method: 'POST', body: JSON.stringify(data) }),
    updateArea: (id, data) => request(`/workspace/areas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteArea: (id) => request(`/workspace/areas/${id}`, { method: 'DELETE' }),
    getPackages: () => request('/workspace/packages'),
    createPackage: (data) => request('/workspace/packages', { method: 'POST', body: JSON.stringify(data) }),
    updatePackage: (id, data) => request(`/workspace/packages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePackage: (id) => request(`/workspace/packages/${id}`, { method: 'DELETE' }),
    getActiveSessions: () => request('/workspace/sessions?status=ACTIVE'),
    checkIn: (data) => request('/workspace/sessions', { method: 'POST', body: JSON.stringify(data) }),
    checkOut: (id) => request(`/workspace/sessions/${id}/checkout`, { method: 'POST' }),
  },
  shifts: {
    getCurrent: () => request('/shifts/current'),
    getHistory: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/shifts/history${qs ? `?${qs}` : ''}`);
    },
    open: (data) => request('/shifts/open', { method: 'POST', body: JSON.stringify(data) }),
    close: (data) => request('/shifts/close', { method: 'POST', body: JSON.stringify(data) }),
  },
  stock: {
    getIngredients: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/ingredients${qs ? `?${qs}` : ''}`);
    },
    create: (data) => request('/ingredients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/ingredients/${id}`, { method: 'DELETE' }),
    recordMovement: (id, data) => request(`/ingredients/${id}/movements`, { method: 'POST', body: JSON.stringify(data) }),
  },
  recipes: {
    get: (productId) => request(`/products/${productId}/recipe`),
    save: (productId, data) => request(`/products/${productId}/recipe`, { method: 'PUT', body: JSON.stringify(data) }),
    getOverview: () => request('/products/cogs/overview'),
  },
  reports: {
    getSummary: () => request('/reports/summary'),
    getSales: (params) => request(`/reports/sales?${new URLSearchParams(params)}`),
    getCogs: (params) => request(`/reports/cogs?${new URLSearchParams(params)}`),
    getTopProducts: (params) => request(`/reports/top-products?${new URLSearchParams(params)}`),
    exportCSV: () => `${API_BASE_URL}/reports/export/csv`,
  },
  analytics: {
    askAi: (payload) => {
      const body = typeof payload === 'string' ? { query: payload } : payload;
      return request('/analytics/ai/ask', { method: 'POST', body: JSON.stringify(body) });
    },
    getQuickInsight: () => request('/analytics/ai/quick-insight'),
    getAiStatus: () => request('/analytics/ai/status'),
  },
  settings: {
    get: () => request('/settings'),
    update: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    verifyPin: (pin) => request('/settings/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  },
  upload: async (file) => {
    const token = localStorage.getItem('komazi-auth-token');
    const formData = new FormData();
    formData.append('image', file);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return {
        success: false,
        message: 'Gagal terhubung ke server upload Cloudinary: ' + err.message,
      };
    }
  },
  deleteUpload: (publicId) => {
    return request(`/upload/${encodeURIComponent(publicId)}`, { method: 'DELETE' });
  },
  payments: {
    checkStatus: (invoiceNo, amount) =>
      request(`/payments/status/${invoiceNo || 'unknown'}${amount ? `?amount=${amount}` : ''}`),
    simulate: (data) =>
      request('/payments/simulate', { method: 'POST', body: JSON.stringify(data) }),
    getWebhookInfo: () =>
      request('/payments/webhook-info'),
  },
  kds: {
    getOrders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/kds/orders${qs ? `?${qs}` : ''}`);
    },
    updateItemStatus: (itemId, status) =>
      request(`/kds/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    bumpItem: (itemId) =>
      request(`/kds/items/${itemId}/bump`, { method: 'POST' }),
    bumpTicket: (orderId) =>
      request(`/kds/orders/${orderId}/bump`, { method: 'POST' }),
  },
  bds: {
    getOrders: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/bds/orders${qs ? `?${qs}` : ''}`);
    },
    updateItemStatus: (itemId, status) =>
      request(`/bds/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    bumpItem: (itemId) =>
      request(`/bds/items/${itemId}/bump`, { method: 'POST' }),
    bumpTicket: (orderId) =>
      request(`/bds/orders/${orderId}/bump`, { method: 'POST' }),
  },
  stations: {
    getAll: () => request('/stations'),
    create: (data) => request('/stations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/stations/${id}`, { method: 'DELETE' }),
  },
  telegram: {
    getStatus: () => request('/telegram/status'),
    test: (data = {}) => request('/telegram/test', { method: 'POST', body: JSON.stringify(data) }),
    getStaff: () => request('/telegram/staff'),
    generateLinkCode: (userId) => request('/telegram/link-code', { method: 'POST', body: JSON.stringify({ userId }) }),
    unlink: (userId) => request('/telegram/unlink', { method: 'POST', body: JSON.stringify({ userId }) }),
  },
};

export default api;
