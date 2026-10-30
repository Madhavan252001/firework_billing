import { apiClient } from './apiClient';
import { ENDPOINTS } from './config';
import { productService } from './productService';

export const authService = {
  /**
   * Admin Login API Call
   * POST /Adminlogin
   * @param {Object} credentials - { email, password }
   * @returns {Promise<Object>} API Response
   */
  adminLogin: async ({ email, password, username }) => {
    const emailId = (email || username || '').trim().toLowerCase();
    const response = await apiClient.post(ENDPOINTS.ADMIN_LOGIN, {
      email: emailId,
      username: emailId,
      password,
    });

    const isSuccess = response && (response.success || response.status || response.code === 200);
    if (isSuccess && response.data) {
      const userData = Array.isArray(response.data) ? response.data[0] : response.data;
      if (userData) {
        const token = userData.token || response.token || response.data?.token;
        if (token && token !== 'undefined') {
          localStorage.setItem('auth_token', token);
        }
        const roleName = userData.role_name || (userData.role === '4' ? 'Staff' : 'Admin');
        const updatedUserData = { ...userData, role_name: roleName };
        localStorage.setItem('user_info', JSON.stringify(updatedUserData));
        localStorage.setItem('user_role', roleName);
        localStorage.setItem('bmes_logged_in', 'true');
        localStorage.setItem('auth_email', emailId);
      }
    }

    return response;
  },

  /**
   * Staff Login API Call
   * POST /staffLogin using Staff Email ID
   * @param {Object} credentials - { email, password }
   * @returns {Promise<Object>} API Response
   */
  staffLogin: async ({ email, password, username }) => {
    const emailId = (email || username || '').trim().toLowerCase();
    const response = await apiClient.post(ENDPOINTS.STAFF_LOGIN, {
      email: emailId,
      username: emailId,
      password,
    });

    const isSuccess = response && (response.success || response.status || response.code === 200);
    if (isSuccess && response.data) {
      const userData = Array.isArray(response.data) ? response.data[0] : response.data;
      if (userData) {
        const token = userData.token || response.token || response.data?.token;
        if (token && token !== 'undefined') {
          localStorage.setItem('auth_token', token);
        }
        const roleName = userData.role_name || 'Staff';
        const updatedUserData = { ...userData, role_name: roleName };
        localStorage.setItem('user_info', JSON.stringify(updatedUserData));
        localStorage.setItem('user_role', roleName);
        localStorage.setItem('bmes_logged_in', 'true');
        localStorage.setItem('auth_email', emailId);
      }
    }

    return response;
  },

  /**
   * Unified Login API Call
   * Tries Staff Login first (/staffLogin); if unverified, falls back to Admin Login (/Adminlogin).
   * @param {Object} credentials - { email, password }
   * @returns {Promise<Object>} API Response
   */
  login: async ({ email, password }) => {
    let staffRes = null;
    let staffErr = null;

    try {
      staffRes = await authService.staffLogin({ email, password });
      const isStaffSuccess = staffRes && (staffRes.success === true || staffRes.status === true || staffRes.code === 200);
      if (isStaffSuccess && staffRes.data && (Array.isArray(staffRes.data) ? staffRes.data.length > 0 : true)) {
        return staffRes;
      }
    } catch (err) {
      staffErr = err;
    }

    let adminRes = null;
    let adminErr = null;

    try {
      adminRes = await authService.adminLogin({ email, password });
      const isAdminSuccess = adminRes && (adminRes.success === true || adminRes.status === true || adminRes.code === 200);
      if (isAdminSuccess && adminRes.data && (Array.isArray(adminRes.data) ? adminRes.data.length > 0 : true)) {
        return adminRes;
      }
    } catch (err) {
      adminErr = err;
    }

    // Neither staffLogin nor adminLogin succeeded.
    // Return explicit response or message from primary attempt
    if (staffRes && staffRes.message) return staffRes;
    if (adminRes && adminRes.message) return adminRes;

    const fallbackMsg = staffErr?.data?.message || staffErr?.message || adminErr?.data?.message || adminErr?.message || 'Login failed. Please check credentials.';
    return {
      success: false,
      message: fallbackMsg,
    };
  },

  /**
   * Clear all session data, tokens, and in-memory caches on user logout
   */
  logout: () => {
    try {
      // Remove authentication tokens and session indicators
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('bmes_logged_in');
      localStorage.removeItem('user_info');
      localStorage.removeItem('user_role');
      localStorage.removeItem('auth_email');
      localStorage.removeItem('auth_password');

      // Clear session storage completely
      sessionStorage.clear();

      // Clear cached data
      try {
        productService.clearCache();
      } catch (e) {}
    } catch (e) {
      console.warn('Error clearing tokens during logout:', e);
    }
  },

  /**
   * Get stored user profile data
   */
  getUser: () => {
    const info = localStorage.getItem('user_info');
    try {
      return info ? JSON.parse(info) : null;
    } catch {
      return null;
    }
  },

  /**
   * Get stored user role name
   */
  getRole: () => {
    const user = authService.getUser();
    return localStorage.getItem('user_role') || user?.role_name || 'User';
  },

  /**
   * Check if logged in user is Admin
   */
  isAdmin: () => {
    const role = authService.getRole();
    return role.toLowerCase() === 'admin' || role === '1';
  },

  /**
   * Check if logged in user is Staff
   */
  isStaff: () => {
    const role = authService.getRole();
    return role.toLowerCase() === 'staff' || role === '4';
  },

  /**
   * Get auth token
   */
  getToken: () => {
    return localStorage.getItem('auth_token');
  },

  /**
   * Ensure a valid authentication token is present
   */
  ensureToken: () => {
    return apiClient.getToken();
  },

  /**
   * Check if user is authenticated
   */
  isLoggedIn: () => {
    return localStorage.getItem('bmes_logged_in') === 'true' && Boolean(localStorage.getItem('auth_token'));
  },
};
