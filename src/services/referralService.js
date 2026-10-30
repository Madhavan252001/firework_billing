import { apiClient } from './apiClient';
import { ENDPOINTS } from './config';

export const referralService = {
  /**
   * Validate and fetch referral code details
   * Primary URL: GET /referrals/code/:code (e.g. /referrals/code/len389mg)
   * Alt URLs: /referals/code/:code, /myreferral/code/:code
   * @param {string} code - Referral code entered by user (e.g. len389mg, KUM7759G6, etc.)
   * @returns {Promise<{success: boolean, message: string, data: {id: any, name: string, mobile_no: string, referral_code: string, customer_discount: number, sales_partner_discount: number}}>}
   */
  getReferralByCode: async (code) => {
    const rawCode = (code || '').trim();
    if (!rawCode) {
      throw new Error('Please enter a referral code.');
    }

    const cleanCode = rawCode.toUpperCase();

    // Try endpoints in sequence: /referrals/code/:code, /referals/code/:code, /myreferral/code/:code
    const endpointsToTry = [
      ENDPOINTS.REFERRAL_CODE(rawCode),
      ENDPOINTS.REFERRAL_CODE(cleanCode),
      ...(ENDPOINTS.REFERRAL_CODE_ALT ? [
        ENDPOINTS.REFERRAL_CODE_ALT(rawCode),
        ENDPOINTS.REFERRAL_CODE_ALT(cleanCode),
      ] : []),
      ...(ENDPOINTS.REFERRAL_CODE_MY ? [
        ENDPOINTS.REFERRAL_CODE_MY(rawCode),
        ENDPOINTS.REFERRAL_CODE_MY(cleanCode),
      ] : []),
    ];

    // Remove duplicates while preserving order
    const uniqueEndpoints = [...new Set(endpointsToTry)];
    let lastError = null;

    for (const ep of uniqueEndpoints) {
      try {
        const response = await apiClient.get(ep);

        if (response && (response.success === true || response.status === true || response.code === 200)) {
          const rawData = response.data && typeof response.data === 'object'
            ? (Array.isArray(response.data) ? response.data[0] : response.data)
            : null;

          if (rawData && (rawData.id || rawData.referral_code || rawData.name)) {
            return {
              success: true,
              message: response.message || 'Referral code applied successfully!',
              data: {
                id: rawData.id,
                name: rawData.name || rawData.partner_name || 'Referral Partner',
                mobile_no: rawData.mobile_no || rawData.mobile || '',
                referral_code: rawData.referral_code || cleanCode,
                customer_discount: Number(rawData.customer_discount || rawData.discount || 0),
                sales_partner_discount: Number(rawData.sales_partner_discount || 0),
                raw: rawData,
              },
            };
          }
        } else if (response && response.message && !response.success) {
          lastError = new Error(response.message);
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(lastError?.message || 'Invalid referral code.');
  },
};

