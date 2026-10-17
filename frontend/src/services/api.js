import { useUiStore } from '../store/uiStore';
import { isNative } from './platform';

/**
 * Normalizes backend API base URL from VITE_API_URL or local fallback.
 * Handles trailing slashes, missing /api prefix, and railway domain setups.
 * Prevents Mixed Content errors when running in browser over HTTPS (e.g. Vite basicSsl)
 * by proxying through window.location.origin.
 */
export function resolveApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // In web browser loaded over HTTPS:
  // Any direct request to http:// will be blocked by the browser as Mixed Content.
  // Vite proxy on server.https proxies /api to http://localhost:4000 seamlessly.
  if (isHttps && !isNative) {
    if (!envUrl) {
      return `${window.location.origin}/api`;
    }
    // If envUrl is relative (e.g. /api or /api/v1), use it with origin
    if (envUrl.startsWith('/')) {
      return `${window.location.origin}${envUrl.replace(/\/+$/, '')}`;
    }
    // If envUrl starts with insecure http://, use same-origin proxy with target path (e.g. /api/v1 or /api)
    if (envUrl.startsWith('http://')) {
      try {
        const parsed = new URL(envUrl);
        const pathname = parsed.pathname.replace(/\/+$/, '');
        const targetPath = (pathname.endsWith('/api') || pathname.endsWith('/api/v1'))
          ? pathname
          : `${pathname || ''}/api`;
        return `${window.location.origin}${targetPath}`;
      } catch {
        return `${window.location.origin}/api`;
      }
    }
    // If envUrl is already https://, it is secure and safe to use directly
    if (envUrl.startsWith('https://')) {
      let cleanUrl = envUrl.replace(/\/+$/, '');
      if (!cleanUrl.endsWith('/api') && !cleanUrl.endsWith('/api/v1')) {
        cleanUrl = `${cleanUrl}/api`;
      }
      return cleanUrl;
    }
  }

  if (!envUrl) {
    return 'http://localhost:4000/api';
  }

  // Remove trailing slashes
  let cleanUrl = envUrl.replace(/\/+$/, '');

  // If provided domain lacks /api and /api/v1 (e.g. https://xxx.up.railway.app), append /api
  if (!cleanUrl.endsWith('/api') && !cleanUrl.endsWith('/api/v1')) {
    cleanUrl = `${cleanUrl}/api`;
  }

  return cleanUrl;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function toCleanQuery(params = {}) {
  if (!params || typeof params !== 'object') return '';
  const entries = Object.entries(params).filter(
    ([_, v]) => v !== undefined && v !== null && v !== '' && v !== 'undefined' && v !== 'null'
  );
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : '';
}

let activeRequestsCount = 0;
let loadingStartTimer = null;
let watchdogResetTimer = null;

function notifyRequestStart() {
  activeRequestsCount++;

  // Watchdog: If requests stay active for > 7 seconds, force reset to prevent stuck loading bar
  if (!watchdogResetTimer) {
    watchdogResetTimer = setTimeout(() => {
      activeRequestsCount = 0;
      watchdogResetTimer = null;
      try {
        useUiStore.getState().stopTopBarLoading();
      } catch {}
    }, 7000);
  }

  if (activeRequestsCount === 1) {
    // Debounce 100ms to prevent visual flickering on super-fast responses
    loadingStartTimer = setTimeout(() => {
      loadingStartTimer = null;
      try {
        useUiStore.getState().startTopBarLoading();
      } catch {}
    }, 100);
  }
}

function notifyRequestEnd() {
  activeRequestsCount = Math.max(0, activeRequestsCount - 1);
  if (activeRequestsCount === 0) {
    if (loadingStartTimer) {
      clearTimeout(loadingStartTimer);
      loadingStartTimer = null;
    }
    if (watchdogResetTimer) {
      clearTimeout(watchdogResetTimer);
      watchdogResetTimer = null;
    }
    try {
      useUiStore.getState().stopTopBarLoading();
    } catch {}
  }
}

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('komazi-auth-token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  // Request timeout: 12 seconds max to prevent hanging on sleeping/cold-start instances
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 12000);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  notifyRequestStart();
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);
    if (!res.ok && !data?.success) {
      let friendlyMessage = data?.message;
      if (!friendlyMessage) {
        if (res.status === 401) {
          friendlyMessage = 'Sesi login telah berakhir. Silakan masuk kembali.';
        } else if (res.status === 403) {
          friendlyMessage = 'Anda tidak memiliki hak akses untuk tindakan ini.';
        } else if (res.status === 404) {
          friendlyMessage = 'Data yang dicari tidak ditemukan.';
        } else if (res.status >= 500) {
          friendlyMessage = 'Terjadi kendala pada server. Silakan coba beberapa saat lagi.';
        } else {
          friendlyMessage = 'Gagal memproses permintaan. Silakan periksa koneksi dan coba lagi.';
        }
      }

      // Deteksi jika akun pengguna dinonaktifkan oleh owner atau sesi dicabut
      if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/password-reset')) {
        const msg = String(data?.message || '').toLowerCase();
        if (msg.includes('dinonaktifkan') || msg.includes('tidak ditemukan') || msg.includes('dicabut')) {
          localStorage.removeItem('komazi-auth-token');
          localStorage.removeItem('komazi-refresh-token');
          try {
            window.dispatchEvent(
              new CustomEvent('auth:force_logout', {
                detail: {
                  reason: friendlyMessage || 'Akun Anda telah dinonaktifkan oleh pemilik kedai.',
                },
              })
            );
          } catch {}
        }
      }

      return {
        success: false,
        message: friendlyMessage,
        data: data?.data || null,
        status: res.status,
      };
    }
    return data || { success: res.ok };
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    console.warn(
      `[API] Request to ${url} ${isTimeout ? 'timed out (12s)' : 'failed'}:`,
      error.message
    );
    return {
      success: false,
      message: isTimeout
        ? 'Koneksi ke server terputus karena batas waktu. Silakan periksa jaringan internet dan coba lagi.'
        : 'Tidak dapat terhubung ke server utama. Mode cadangan lokal aktif.',
      error: error.message,
    };
  } finally {
    clearTimeout(timeoutId);
    notifyRequestEnd();
  }
}

// In-flight request deduplication and short TTL cache for orders to eliminate redundant bursts
let ordersGetAllInFlightPromise = null;
let ordersGetAllLastFetchTime = 0;
let ordersGetAllCachedData = null;

export function invalidateOrdersCache() {
  ordersGetAllLastFetchTime = 0;
  ordersGetAllCachedData = null;
}

function prepareRequestBody(body) {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData || typeof body === 'string') return body;
  return JSON.stringify(body);
}

export const api = {
  // Generic HTTP methods
  request,
  get: (endpoint, options = {}) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options = {}) =>
    request(endpoint, {
      method: 'POST',
      body: prepareRequestBody(body),
      ...options,
    }),
  put: (endpoint, body, options = {}) =>
    request(endpoint, {
      method: 'PUT',
      body: prepareRequestBody(body),
      ...options,
    }),
  patch: (endpoint, body, options = {}) =>
    request(endpoint, {
      method: 'PATCH',
      body: prepareRequestBody(body),
      ...options,
    }),
  delete: (endpoint, options = {}) => request(endpoint, { method: 'DELETE', ...options }),

  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    verifyResetToken: (token) => request('/auth/password-reset/verify-token', { method: 'POST', body: JSON.stringify({ token }) }),
    completePasswordReset: ({ token, newPassword, confirmPassword }) =>
      request('/auth/password-reset/complete', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      }),
    getProfile: () => request('/auth/me'),
    updateProfile: (data) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  users: {
    getAll: () => request('/users'),
    create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createResetToken: (id) => request(`/users/${id}/password-reset-token`, { method: 'POST' }),
    revokeResetToken: (id) => request(`/users/${id}/password-reset-token`, { method: 'DELETE' }),
    getResetTokenStatus: (id) => request(`/users/${id}/password-reset-status`),
    resetPassword: (id, newPassword) => request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
    delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  },
  customers: {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/customers${qs ? `?${qs}` : ''}`);
    },
    getById: (id) => request(`/customers/${id}`),
    create: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
    redeem: (id, points, note) => request(`/customers/${id}/redeem`, { method: 'POST', body: JSON.stringify({ points, note }) }),
    adjustPoints: (id, points, reason) => request(`/customers/${id}/adjust-points`, { method: 'POST', body: JSON.stringify({ points, reason }) }),
    syncBatch: (customers) => request('/customers/sync-batch', { method: 'POST', body: JSON.stringify({ customers }) }),
  },
  printers: {
    getAll: () => request('/printers'),
    getById: (id) => request(`/printers/${id}`),
    create: (data) => request('/printers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/printers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/printers/${id}`, { method: 'DELETE' }),
  },
  printerSettings: {
    getReceipt: () => request('/printer-settings/receipt'),
    updateReceipt: (data) => request('/printer-settings/receipt', { method: 'PUT', body: JSON.stringify(data) }),
  },
  printJobs: {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/print-jobs${qs ? `?${qs}` : ''}`);
    },
    getById: (id) => request(`/print-jobs/${id}`),
    create: (data) => request('/print-jobs', { method: 'POST', body: JSON.stringify(data) }),
    retry: (id) => request(`/print-jobs/${id}/retry`, { method: 'POST' }),
    reprint: (id) => request(`/print-jobs/${id}/reprint`, { method: 'POST' }),
  },
  kitchenRoutes: {
    getAll: () => request('/kitchen-printer-routes'),
    update: (routes) => request('/kitchen-printer-routes', { method: 'PUT', body: JSON.stringify({ routes }) }),
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
    bulkCreate: (products) => request('/products/bulk', { method: 'POST', body: JSON.stringify({ products }) }),
    bulkDelete: (ids) => request('/products/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  },
  orders: {
    getAll: (options = {}) => {
      const now = Date.now();
      // Reuse cached orders if fetched within the last 2000ms and not forced
      if (!options?.force && ordersGetAllCachedData && now - ordersGetAllLastFetchTime < 2000) {
        return Promise.resolve(ordersGetAllCachedData);
      }
      // If a request is already in-flight, return the existing promise (deduplication)
      if (ordersGetAllInFlightPromise) {
        return ordersGetAllInFlightPromise;
      }
      ordersGetAllInFlightPromise = request('/orders')
        .then((res) => {
          if (res && res.success) {
            ordersGetAllCachedData = res;
            ordersGetAllLastFetchTime = Date.now();
          }
          return res;
        })
        .finally(() => {
          ordersGetAllInFlightPromise = null;
        });
      return ordersGetAllInFlightPromise;
    },
    getById: (id) => request(`/orders/${id}`),
    create: (data) => {
      invalidateOrdersCache();
      return request('/orders', { method: 'POST', body: JSON.stringify(data) });
    },
    update: (id, data) => {
      invalidateOrdersCache();
      return request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    pay: (id, data) => {
      invalidateOrdersCache();
      return request(`/orders/${id}/pay`, { method: 'POST', body: JSON.stringify(data) });
    },
    updateKitchenStatus: (id, data) => {
      invalidateOrdersCache();
      return request(`/orders/${id}/kitchen-status`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    void: (id, reason, managerPin) => {
      invalidateOrdersCache();
      return request(`/orders/${id}/void`, { method: 'POST', body: JSON.stringify({ reason, managerPin }) });
    },
    refund: (id, reason, refundAmount) => {
      invalidateOrdersCache();
      return request(`/orders/${id}/refund`, { method: 'POST', body: JSON.stringify({ reason, refundAmount }) });
    },
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
    getRegisters: () => request('/shifts/registers'),
    getCurrent: (registerId) => request(`/shifts/current${registerId ? `?registerId=${registerId}` : ''}`),
    getHistory: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/shifts/history${qs ? `?${qs}` : ''}`);
    },
    getDetail: (id) => request(`/shifts/${id}`),
    open: (data) => request('/shifts/open', { method: 'POST', body: JSON.stringify(data) }),
    close: (data) => request('/shifts/close', { method: 'POST', body: JSON.stringify(data) }),
    recordMovement: (data) => request('/shifts/movements', { method: 'POST', body: JSON.stringify(data) }),
    getMovements: (id) => request(`/shifts/${id}/movements`),
  },
  stock: {
    getIngredients: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/ingredients${qs ? `?${qs}` : ''}`);
    },
    create: (data) => request('/ingredients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/ingredients/${id}`, { method: 'DELETE' }),
    bulkCreate: (ingredients) => request('/ingredients/bulk', { method: 'POST', body: JSON.stringify({ ingredients }) }),
    bulkDelete: (ids) => request('/ingredients/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
    recordMovement: (id, data) => request(`/ingredients/${id}/movements`, { method: 'POST', body: JSON.stringify(data) }),
    recordWaste: (id, data) => request(`/ingredients/${id}/waste`, { method: 'POST', body: JSON.stringify(data) }),
    getWasteAnalytics: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/ingredients/waste-analytics${qs ? `?${qs}` : ''}`);
    },
    getWhatsAppUrl: (id) => request(`/ingredients/${id}/whatsapp-url`),
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
    getProfitLoss: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/reports/profit-loss${qs ? `?${qs}` : ''}`);
    },
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
    getOrders: (params = {}) =>
      request(`/kds/orders${toCleanQuery(params)}`),
    updateItemStatus: (itemId, status) =>
      request(`/kds/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    bumpItem: (itemId) =>
      request(`/kds/items/${itemId}/bump`, { method: 'POST' }),
    bumpTicket: (orderId) =>
      request(`/kds/orders/${orderId}/bump`, { method: 'POST' }),
  },
  bds: {
    getOrders: (params = {}) =>
      request(`/bds/orders${toCleanQuery(params)}`),
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
  approvals: {
    getPending: () => request('/approvals/pending'),
    decide: (id, approve) => request(`/approvals/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve }) }),
  },
  hris: {
    getOverview: () => request('/hris/overview'),
    getStaff: () => request('/hris/staff'),
    createStaff: (data) => request('/hris/staff', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreateStaff: (staff) => request('/hris/staff/bulk', { method: 'POST', body: JSON.stringify({ staff }) }),
    updateStaff: (id, data) => request(`/hris/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteStaff: (id) => request(`/hris/staff/${id}`, { method: 'DELETE' }),
    getAttendance: (params = {}) =>
      request(`/hris/attendance${toCleanQuery(params)}`),
    clockIn: (data = {}) => request('/hris/attendance/clock-in', { method: 'POST', body: JSON.stringify(data) }),
    clockOut: (data = {}) => request('/hris/attendance/clock-out', { method: 'POST', body: JSON.stringify(data) }),
    createManualAttendance: (data) => request('/hris/attendance/manual', { method: 'POST', body: JSON.stringify(data) }),
    deleteAttendance: (id) => request(`/hris/attendance/${id}`, { method: 'DELETE' }),
    getSchedules: (params = {}) =>
      request(`/hris/schedules${toCleanQuery(params)}`),
    getMyTodaySchedule: () => request('/hris/my-schedule-today'),
    createSchedule: (data) => request('/hris/schedules', { method: 'POST', body: JSON.stringify(data) }),
    deleteSchedule: (id) => request(`/hris/schedules/${id}`, { method: 'DELETE' }),
    getLeaves: (params = {}) =>
      request(`/hris/leaves${toCleanQuery(params)}`),
    createLeave: (data) => request('/hris/leaves', { method: 'POST', body: JSON.stringify(data) }),
    updateLeaveStatus: (id, data) => request(`/hris/leaves/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteLeave: (id) => request(`/hris/leaves/${id}`, { method: 'DELETE' }),
    // Attendance Corrections
    getAttendanceCorrections: () => request('/hris/attendance/corrections'),
    createAttendanceCorrection: (data) => request('/hris/attendance/corrections', { method: 'POST', body: JSON.stringify(data) }),
    reviewAttendanceCorrection: (id, data) => request(`/hris/attendance/corrections/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    // Overtime
    getOvertimes: () => request('/hris/overtimes'),
    createOvertime: (data) => request('/hris/overtimes', { method: 'POST', body: JSON.stringify(data) }),
    reviewOvertime: (id, data) => request(`/hris/overtimes/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
    // Payroll & Payslips
    getPayrollPeriods: () => request('/hris/payroll/periods'),
    createPayrollPeriod: (data) => request('/hris/payroll/periods', { method: 'POST', body: JSON.stringify(data) }),
    calculatePayrollPeriod: (id) => request(`/hris/payroll/periods/${id}/calculate`, { method: 'POST' }),
    finalizePayrollPeriod: (id) => request(`/hris/payroll/periods/${id}/finalize`, { method: 'POST' }),
    publishPayrollPeriod: (id) => request(`/hris/payroll/periods/${id}/publish`, { method: 'POST' }),
    getPeriodPayslips: (id) => request(`/hris/payroll/periods/${id}/payslips`),
    getMyPayslips: () => request('/hris/payroll/my-payslips'),
    getMyPayslipDetail: (id) => request(`/hris/payroll/my-payslips/${id}`),
    // Audit Logs & Roles
    getAuditLogs: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/hris/audit-logs${qs ? `?${qs}` : ''}`);
    },
    getRoles: () => request('/hris/roles'),
  },
  notifications: {
    getAll: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/notifications${qs ? `?${qs}` : ''}`);
    },
    getUnreadCount: () => request('/notifications/unread-count'),
    markAsRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllAsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
    registerDevice: (data) => request('/notifications/devices', { method: 'POST', body: JSON.stringify(data) }),
    logoutDevice: (data = {}) => request('/notifications/devices/logout', { method: 'POST', body: JSON.stringify(data) }),
    testPush: () => request('/notifications/test-push', { method: 'POST' }),
  },
};

export default api;
