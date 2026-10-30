import { apiClient } from './apiClient';
import { ENDPOINTS } from './config';

export const discountService = {
  /**
   * Get active discount offers directly from API
   * GET /discounts
   * @returns {Promise<Array<{id: number|string, name: string, type: 'percentage'|'fixed', value: number}>>} List of active discounts from backend API
   */
  getDiscounts: async () => {
    try {
      const response = await apiClient.get(ENDPOINTS.GET_DISCOUNTS);
      const rawDiscounts = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];

      return rawDiscounts
        .filter(item => item.is_deleted === '0' || item.is_deleted === 0 || !item.is_deleted)
        .map(item => {
          const discountType = (item.discount_type || 'percentage').toLowerCase();
          return {
            id: item.id,
            name: item.name || `Offer #${item.id}`,
            type: (discountType === 'percentage' || discountType === 'percent') ? 'percentage' : 'fixed',
            value: Number(item.discount_value) || 0,
            rawItem: item,
          };
        });
    } catch (error) {
      console.warn('Discount API fetch error:', error);
      return [];
    }
  },
};
