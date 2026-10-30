import { API_BASE_URL } from './config';

/**
 * Custom error class for API requests
 */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Retrieve current authentic session token from localStorage
 */
export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('auth_token');
  if (token && token !== 'undefined' && token !== 'null') {
    return token;
  }
  return null;
}

/**
 * Handle unauthorized session (session expired or invalid token)
 * Clears stale session and redirects to /login if in browser
 */
export function handleUnauthorizedSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('bmes_logged_in');
    localStorage.removeItem('user_info');
    localStorage.removeItem('user_role');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_password');
    sessionStorage.clear();
  } catch (e) {}

  const path = window.location.pathname;
  const isPublicPage = path.includes('/bill/') || path.includes('/login');
  if (!isPublicPage) {
    window.location.href = '/billing/login';
  }
}

/**
 * Generic fetch wrapper for ProERP API requests with authentic session token
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const isAuthEndpoint =
    endpoint.includes('/Adminlogin') ||
    endpoint.includes('/staffLogin') ||
    endpoint.includes('login');

  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    const isUnauthorized =
      (!response.ok && (response.status === 401 || response.status === 403)) ||
      (data && (data.code === 401 || data.code === 403 || data.message === 'Unauthorized access.' || data.message === 'Authentication token is required.'));

    if (isUnauthorized && !isAuthEndpoint) {
      console.warn(`[ProERP API] Unauthorized session on ${endpoint}`);
      handleUnauthorizedSession();
      throw new ApiError(data?.message || 'Session expired. Please log in again.', response.status || 401, data);
    }

    if (!response.ok) {
      const errorMessage = data?.message || `Request failed with status ${response.status}`;
      throw new ApiError(errorMessage, response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network error occurred. Please try again.', 0, null);
  }
}

export const apiClient = {
  get: (endpoint, headers) => request(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers) => request(endpoint, { method: 'POST', body, headers }),
  put: (endpoint, body, headers) => request(endpoint, { method: 'PUT', body, headers }),
  delete: (endpoint, headers) => request(endpoint, { method: 'DELETE', headers }),
  getToken: getAuthToken,
  getOrAcquireToken: getAuthToken,
};
