import { apiClient } from './apiClient';
import { ENDPOINTS } from './config';

export const categoryService = {
  /**
   * Get categories list from API
   * GET /category
   * @returns {Promise<Array>} List of categories
   */
  getCategories: async () => {
    try {
      const response = await apiClient.get(ENDPOINTS.GET_CATEGORIES);
      if (response && response.success && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.warn('Category API request error:', error);
      return [];
    }
  },
};
