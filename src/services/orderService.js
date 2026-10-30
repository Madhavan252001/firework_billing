import { apiClient } from './apiClient';
import { ENDPOINTS, getShopDetails } from './config';
import { productService } from './productService';

export const orderService = {
  /**
   * Create an offline order via API
   * POST /orders/offline (or /orders/offlinex)
   * @param {Object} orderPayload - Order details
   * @returns {Promise<Object>} API Response
   */
  createOfflineOrder: async (orderPayload) => {
    const subtotal = Number(orderPayload.subtotal || 0);

    const taxPercentage = Number(
      orderPayload.taxPercentage ??
      orderPayload.tax_percentage ??
      (orderPayload.gst?.enabled ? (orderPayload.gst?.percentage || 18) : (orderPayload.gstAmount ? 18 : 0))
    );

    const taxAmount = Number(
      orderPayload.taxAmount ??
      orderPayload.tax_amount ??
      orderPayload.gstAmount ??
      0
    );

    const basicDiscountPercentage = Number(
      orderPayload.basicDiscountPercentage ??
      orderPayload.basic_discount_percentage ??
      (orderPayload.discount?.enabled && orderPayload.discount?.type === 'percentage' ? Number(orderPayload.discount?.value || 0) : 0)
    );

    const basicDiscountAmount = Number(
      orderPayload.basicDiscountAmount ??
      orderPayload.basic_discount_amount ??
      (basicDiscountPercentage ? (subtotal * basicDiscountPercentage) / 100 : 0)
    );

    const otherDiscountType =
      orderPayload.otherDiscountType ||
      orderPayload.other_discount_type ||
      (orderPayload.discount?.otherType === 'percentage' || orderPayload.discount?.otherType === 'percent' ? 'percentage' : 'amount');

    const otherDiscountValue = Number(
      orderPayload.otherDiscountValue ??
      orderPayload.other_discount_value ??
      orderPayload.discount?.otherValue ??
      0
    );

    const isOtherPercent = otherDiscountType === 'percentage' || otherDiscountType === 'percent';
    const otherDiscountAmount = Number(
      orderPayload.otherDiscountAmount ??
      orderPayload.other_discount_amount ??
      (otherDiscountValue ? (isOtherPercent ? (subtotal * otherDiscountValue) / 100 : otherDiscountValue) : 0)
    );

    const payableAmount = Number(
      orderPayload.payableAmount ??
      orderPayload.payable_amount ??
      orderPayload.grandTotal ??
      orderPayload.grand_total ??
      0
    );

    const paidAmount = Number(
      orderPayload.paidAmount ??
      orderPayload.paid_amount ??
      payableAmount
    );

    const remainingAmount = Math.max(0, Number((payableAmount - paidAmount).toFixed(2)));

    let paymentStatus = orderPayload.paymentStatus || orderPayload.payment_status;
    if (!paymentStatus) {
      if (paidAmount >= payableAmount) paymentStatus = 'paid';
      else if (paidAmount > 0) paymentStatus = 'partial';
      else paymentStatus = 'pending';
    }

    let paymentMethod = (
      orderPayload.paymentMethodRaw ||
      orderPayload.paymentMethod ||
      orderPayload.payment_method ||
      'cash'
    ).toString().toLowerCase();

    if (paymentMethod.includes('upi') || paymentMethod.includes('qr') || paymentMethod.includes('gpay')) {
      paymentMethod = 'upi';
    } else if (paymentMethod.includes('card')) {
      paymentMethod = 'card';
    } else if (paymentMethod.includes('cod')) {
      paymentMethod = 'cod';
    } else if (paymentMethod.includes('online')) {
      paymentMethod = 'online';
    } else if (!['cash', 'cod', 'upi', 'card', 'online', 'other'].includes(paymentMethod)) {
      paymentMethod = 'cash';
    }

    const referralCode = (
      orderPayload.referral_code ||
      orderPayload.referralCode ||
      orderPayload.referral?.code ||
      orderPayload.referral?.referral_code ||
      ''
    ).trim();

    const requirementNote = (
      orderPayload.requirement_note ||
      orderPayload.requirementNote ||
      orderPayload.notes ||
      orderPayload.order_notes ||
      orderPayload.note ||
      ''
    ).trim();

    const referralCustomerDiscount = Number(
      orderPayload.referral_customer_discount ??
      orderPayload.referralCustomerDiscount ??
      orderPayload.referralDiscountPercentage ??
      orderPayload.referral?.customerDiscount ??
      orderPayload.referral?.customer_discount ??
      orderPayload.referral?.discount ??
      0
    );

    const couponCode = (
      orderPayload.coupon_code ||
      orderPayload.couponCode ||
      orderPayload.discount?.selectedOfferName ||
      orderPayload.discount?.code ||
      ''
    ).trim();

    const couponDiscount = Number(
      orderPayload.coupon_discount ??
      orderPayload.couponDiscount ??
      (orderPayload.basicDiscountAmount || orderPayload.discountAmount || (basicDiscountAmount + otherDiscountAmount))
    );

    const address = (
      orderPayload.customer?.address ||
      orderPayload.address ||
      ''
    ).trim();

    const postalcode = (
      orderPayload.customer?.postalcode ||
      orderPayload.customer?.pincode ||
      orderPayload.postalcode ||
      orderPayload.pincode ||
      ''
    ).trim();

    const deliveryFee = Number(orderPayload.delivery_fee ?? orderPayload.deliveryFee ?? 0);

    const items = (orderPayload.items || []).map(item => {
      const unitPrice = Number(item.price ?? item.unit_price ?? item.discountedPrice ?? 0);
      const qty = Number(item.quantity ?? item.qty ?? 1);
      const totalPrice = Number(item.total_price ?? item.total ?? (unitPrice * qty));
      return {
        product_id: item.product_id ?? item.id,
        product_name: item.product_name ?? item.name ?? 'crackers',
        product_code: item.product_code ?? item.code ?? '',
        quantity: qty,
        price: unitPrice,
        unit_price: unitPrice,
        total_price: totalPrice,
        stock_count: Number(item.stock_count ?? item.stock ?? 0),
      };
    });

    const formattedPayload = {
      // Primary fields matching POST /orders/offline
      customer_name: (orderPayload.customer?.name || orderPayload.customer_name || 'Walk-in Customer').trim(),
      customer_mobile: (orderPayload.customer?.mobile || orderPayload.customer_mobile || '').trim(),
      requirement_note: requirementNote,
      requirementNote: requirementNote,
      notes: requirementNote,
      order_notes: requirementNote,
      coupon_code: couponCode,
      address,
      postalcode,
      payment_method: paymentMethod, // 'cash', 'cod', 'upi', 'card', 'online', 'other'
      coupon_discount: couponDiscount,
      referral_code: referralCode,
      referral_customer_discount: referralCustomerDiscount,
      delivery_fee: deliveryFee,
      payable_amount: payableAmount,
      items,

      // POS and offline fields for server compatibility and full audit
      subtotal,
      original_subtotal: Number(orderPayload.originalSubtotal ?? orderPayload.original_subtotal ?? subtotal),
      tax_percentage: taxPercentage,
      tax_amount: taxAmount,
      gst_amount: taxAmount,
      basic_discount_percentage: basicDiscountPercentage,
      basic_discount_amount: basicDiscountAmount,
      other_discount_type: isOtherPercent ? 'percentage' : 'amount',
      other_discount_value: otherDiscountValue,
      other_discount_amount: otherDiscountAmount,
      referral_partner_name: orderPayload.referralName || orderPayload.referral_partner_name || '',
      referral_discount_percentage: Number(orderPayload.referralDiscountPercentage || orderPayload.referral_discount_percentage || referralCustomerDiscount),
      referral_discount_amount: Number(orderPayload.referralDiscountAmount || orderPayload.referral_discount_amount || 0),
      sales_partner_discount: Number(orderPayload.salesPartnerDiscount || orderPayload.sales_partner_discount || 0),
      payment_status: paymentStatus,
      paid_amount: paidAmount,
      remaing_amount: remainingAmount,
      remaining_amount: remainingAmount,
      payment_type: orderPayload.paymentType || (paidAmount < payableAmount ? 'credit' : 'full'),
      created_at: new Date().toISOString(),
    };

    try {
      // 1. Primary: POST /orders/offline (https://offer360.in/fireworks/crackers/orders/offline)
      const response = await apiClient.post(ENDPOINTS.OFFLINE_ORDERS, formattedPayload);
      return response;
    } catch (error) {
      console.warn('Primary /orders/offline endpoint failed, trying /orders/offlinex:', error);
      try {
        // 2. Alt fallback: /orders/offlinex
        const altResponse = await apiClient.post(ENDPOINTS.CREATE_OFFLINE_ORDER_ALT, formattedPayload);
        return altResponse;
      } catch (altError) {
        console.warn('/orders/offlinex failed, trying /myorders:', altError);
        try {
          // 3. Fallback to /myorders
          const myOrdersResponse = await apiClient.post(ENDPOINTS.MY_ORDERS, formattedPayload);
          return myOrdersResponse;
        } catch (myOrdersError) {
          console.warn('/myorders failed, trying /crackers/myorders:', myOrdersError);
          // 4. Final fallback to /crackers/myorders
          return await apiClient.post(ENDPOINTS.MY_ORDERS_ALT, formattedPayload);
        }
      }
    }
  },

  /**
   * Alias for creating order via API
   */
  createOrder: async (orderPayload) => {
    return orderService.createOfflineOrder(orderPayload);
  },

  createMyOrder: async (orderPayload) => {
    return orderService.createOfflineOrder(orderPayload);
  },

  /**
   * Create an estimate order via API
   * POST /orders/estimates (or /crackers/orders/estimates)
   * @param {Object} orderPayload - Estimate details
   * @returns {Promise<Object>} API Response
   */
  createEstimateOrder: async (orderPayload) => {
    const subtotal = Number(orderPayload.subtotal || 0);

    const taxPercentage = Number(
      orderPayload.taxPercentage ??
      orderPayload.tax_percentage ??
      (orderPayload.gst?.enabled ? (orderPayload.gst?.percentage || 18) : (orderPayload.gstAmount ? 18 : 0))
    );

    const basicDiscountPercentage = Number(
      orderPayload.basicDiscountPercentage ??
      orderPayload.basic_discount_percentage ??
      (orderPayload.discount?.enabled && orderPayload.discount?.type === 'percentage' ? Number(orderPayload.discount?.value || 0) : 0)
    );

    const otherDiscountType =
      orderPayload.otherDiscountType ||
      orderPayload.other_discount_type ||
      (orderPayload.discount?.otherType === 'percentage' || orderPayload.discount?.otherType === 'percent' ? 'percentage' : 'amount');

    const otherDiscountValue = Number(
      orderPayload.otherDiscountValue ??
      orderPayload.other_discount_value ??
      orderPayload.discount?.otherValue ??
      0
    );

    let paymentMethod = (
      orderPayload.paymentMethodRaw ||
      orderPayload.paymentMethod ||
      orderPayload.payment_method ||
      'cash'
    ).toString().toLowerCase();

    if (paymentMethod.includes('upi') || paymentMethod.includes('qr') || paymentMethod.includes('gpay')) {
      paymentMethod = 'upi';
    } else if (paymentMethod.includes('card')) {
      paymentMethod = 'card';
    } else if (paymentMethod.includes('cod')) {
      paymentMethod = 'cod';
    } else if (paymentMethod.includes('online')) {
      paymentMethod = 'online';
    } else if (!['cash', 'cod', 'upi', 'card', 'online', 'other'].includes(paymentMethod)) {
      paymentMethod = 'cash';
    }

    const items = (orderPayload.items || []).map(item => ({
      product_id: item.product_id ?? item.productId ?? item.id,
      quantity: Math.max(1, Number(item.quantity ?? item.qty ?? 1)),
    }));

    const remark = (
      orderPayload.remark ||
      orderPayload.requirement_note ||
      orderPayload.requirementNote ||
      orderPayload.notes ||
      orderPayload.order_notes ||
      'Estimate only'
    ).trim();

    const formattedPayload = {
      customer_name: (orderPayload.customer?.name || orderPayload.customer_name || 'Walk-in Customer').trim(),
      customer_mobile: (orderPayload.customer?.mobile || orderPayload.customer_mobile || '').trim(),
      address: (orderPayload.customer?.address || orderPayload.address || 'Chennai').trim(),
      postalcode: (orderPayload.customer?.postalcode || orderPayload.customer?.pincode || orderPayload.postalcode || '600001').trim(),
      items,
      tax_percentage: taxPercentage,
      basic_discount_percentage: basicDiscountPercentage,
      other_discount_type: otherDiscountType,
      other_discount_value: otherDiscountValue,
      payment_method: paymentMethod,
      remark: remark || 'Estimate only',
      subtotal,
      original_subtotal: Number(orderPayload.originalSubtotal ?? orderPayload.original_subtotal ?? subtotal),
    };

    if (orderPayload.coupon_code) formattedPayload.coupon_code = orderPayload.coupon_code;
    if (orderPayload.coupon_discount) formattedPayload.coupon_discount = orderPayload.coupon_discount;
    if (orderPayload.referral_code) formattedPayload.referral_code = orderPayload.referral_code;
    if (orderPayload.referral_customer_discount) formattedPayload.referral_customer_discount = orderPayload.referral_customer_discount;

    let response;
    try {
      // 1. Primary: POST /orders/estimates
      response = await apiClient.post(ENDPOINTS.CREATE_ESTIMATE_ORDER, formattedPayload);
    } catch (err1) {
      console.warn('Primary /orders/estimates failed, trying /crackers/orders/estimates:', err1);
      // 2. Alt: POST /crackers/orders/estimates
      response = await apiClient.post(ENDPOINTS.CREATE_ESTIMATE_ORDER_ALT, formattedPayload);
    }

    if (response?.data?.shop_details || response?.shop_details) {
      try {
        localStorage.setItem('shop_details', JSON.stringify(response?.data?.shop_details || response?.shop_details));
      } catch (e) {}
    }

    return response;
  },

  /**
   * Fetch list of estimate orders
   * GET /orders/estimates (or /crackers/orders/estimates)
   * @returns {Promise<Array>} List of normalized estimate orders
   */
  getEstimateOrders: async () => {
    try {
      let response;
      try {
        response = await apiClient.get(ENDPOINTS.ESTIMATE_ORDERS);
      } catch (err0) {
        response = await apiClient.get(ENDPOINTS.ESTIMATE_ORDERS_ALT);
      }

      const rawEstimates = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];

      return rawEstimates.map((item, index) => {
        const orderNumber = item.order_no || item.order_number || item.orderNumber || `EST-${item.id || index + 1}`;
        let date = item.created_at || item.date || new Date().toLocaleString('en-IN');
        if (item.created_at) {
          try {
            const parsed = new Date(item.created_at.replace(' ', 'T'));
            if (!isNaN(parsed.getTime())) {
              date = parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
            }
          } catch (e) {}
        }

        const items = Array.isArray(item.items) ? item.items.map((i, idx) => {
          const unitPrice = Number(i.unit_price ?? i.price ?? i.discountedPrice ?? 0);
          const qty = Number(i.quantity ?? i.qty ?? 1);
          return {
            id: i.product_id || i.id || idx + 1,
            productId: i.product_id,
            name: i.product_name || i.name || `Item ${idx + 1}`,
            quantity: qty,
            originalPrice: Number(i.original_price ?? i.originalPrice ?? i.mrp ?? unitPrice),
            discountedPrice: unitPrice,
            price: unitPrice,
            unitPrice: unitPrice,
            total: Number(i.total_price ?? i.total ?? (unitPrice * qty)),
          };
        }) : [];

        const subtotal = Number(item.subtotal || 0);
        const payableAmount = Number(item.payable_amount || item.grand_total || subtotal);

        return {
          id: item.id || index + 1,
          orderNumber,
          order_no: orderNumber,
          date,
          created_at: item.created_at,
          is_estimate: '1',
          isEstimate: true,
          customer: {
            name: item.customer_name || 'Walk-in Customer',
            mobile: item.customer_mobile || '',
            address: item.address || '',
            postalcode: item.postalcode || '',
          },
          customer_name: item.customer_name || 'Walk-in Customer',
          customer_mobile: item.customer_mobile || '',
          address: item.address || '',
          postalcode: item.postalcode || '',
          remark: item.remark || 'Estimate only',
          requirement_note: item.remark || 'Estimate only',
          requirementNote: item.remark || 'Estimate only',
          order_notes: item.remark || 'Estimate only',
          notes: item.remark || 'Estimate only',
          items,
          subtotal,
          taxPercentage: Number(item.tax_percentage || 0),
          tax_percentage: Number(item.tax_percentage || 0),
          taxAmount: Number(item.tax_amount || 0),
          basicDiscountPercentage: Number(item.basic_discount_percentage || 0),
          basicDiscountAmount: Number(item.basic_discount_amount || 0),
          otherDiscountType: item.other_discount_type,
          otherDiscountValue: Number(item.other_discount_value || 0),
          otherDiscountAmount: Number(item.other_discount_amount || 0),
          payableAmount,
          grandTotal: payableAmount,
          paidAmount: Number(item.paid_amount || payableAmount),
          balanceDue: Number(item.remaing_amount || 0),
          paymentStatus: item.payment_status || 'paid',
          paymentMethod: item.payment_method || 'Cash',
          paymentType: 'full',
          shop_details: item.shop_details || getShopDetails(),
          shopDetails: item.shop_details || getShopDetails(),
          rawItem: item,
        };
      });
    } catch (err) {
      console.warn('Failed to load estimates from API:', err);
      return [];
    }
  },

  /**
   * Delete an estimate quotation via API
   * DELETE /crackers/order/estimates/:id (or /order/estimates/:id)
   * Only applicable to estimates
   * @param {string|number} estimateId - Estimate ID
   * @returns {Promise<Object>} API response
   */
  deleteEstimateOrder: async (estimateId) => {
    if (!estimateId) {
      throw new Error('Estimate ID is required to delete an estimate');
    }

    const cleanId = String(estimateId).replace(/^EST-|^ORD-/, '').trim();
    const idToUse = cleanId || estimateId;

    let response = null;
    let lastError = null;

    // Endpoints in order of preference (user requested /crackers/order/estimates/:id)
    const candidateEndpoints = [
      `/crackers/order/estimates/${idToUse}`,
      ENDPOINTS.DELETE_ESTIMATE_ORDER ? ENDPOINTS.DELETE_ESTIMATE_ORDER(idToUse) : `/order/estimates/${idToUse}`,
      `/crackers/orders/estimates/${idToUse}`,
      ENDPOINTS.DELETE_ESTIMATE_ORDERS_PLURAL ? ENDPOINTS.DELETE_ESTIMATE_ORDERS_PLURAL(idToUse) : `/orders/estimates/${idToUse}`,
    ];

    for (const ep of candidateEndpoints) {
      try {
        response = await apiClient.delete(ep);
        if (response && (response.success !== false || response.data || response.message)) {
          return response;
        }
      } catch (err) {
        lastError = err;
      }
    }

    // Fallback: try POST with /delete if reverse proxies disallow HTTP DELETE method
    const postCandidates = [
      `/crackers/order/estimates/${idToUse}/delete`,
      `/order/estimates/${idToUse}/delete`,
      `/crackers/orders/estimates/${idToUse}/delete`,
      `/orders/estimates/${idToUse}/delete`,
    ];
    for (const ep of postCandidates) {
      try {
        response = await apiClient.post(ep, { id: idToUse, is_deleted: 1 });
        if (response && response.success !== false) {
          return response;
        }
      } catch (err) {}
    }

    if (lastError) {
      console.warn('API delete estimate call completed with notice:', lastError);
    }

    return response || { success: true, message: 'Estimate deleted successfully' };
  },

  /**
   * Fetch and cache latest shop details from GET /orders/offline
   * @returns {Promise<Object>} Shop details object
   */
  fetchShopDetails: async () => {
    try {
      await orderService.getOfflineOrders();
      const saved = localStorage.getItem('shop_details');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return getShopDetails();
  },

  /**
   * Fetch list of offline orders
   * GET /orders/offline (or /orders/offlinex)
   * @returns {Promise<Array>} List of normalized orders
   */
  getOfflineOrders: async () => {
    try {
      let response;
      try {
        // 1. Primary: /orders/offline
        response = await apiClient.get(ENDPOINTS.OFFLINE_ORDERS);
      } catch (err0) {
        console.warn('/orders/offline failed, trying /orders/offlinex:', err0);
        try {
          // 2. Alt: /orders/offlinex
          response = await apiClient.get(ENDPOINTS.CREATE_OFFLINE_ORDER_ALT);
        } catch (err1) {
          try {
            response = await apiClient.get(ENDPOINTS.MY_ORDERS);
          } catch (err2) {
            response = await apiClient.get(ENDPOINTS.MY_ORDERS_ALT);
          }
        }
      }

      const apiShop =
        response?.shop_details ||
        response?.data?.shop_details ||
        response?.shop ||
        (Array.isArray(response?.data) && response.data.find(d => d?.shop_details)?.shop_details) ||
        (Array.isArray(response) && response.find(d => d?.shop_details)?.shop_details) ||
        null;
      if (apiShop && typeof apiShop === 'object') {
        try {
          localStorage.setItem('shop_details', JSON.stringify(apiShop));
        } catch (e) {}
      }

      const rawOrders = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.orders)
        ? response.orders
        : Array.isArray(response?.data?.orders)
        ? response.data.orders
        : [];

      return rawOrders.map((item, index) => {
        const orderNumber = item.order_no || item.order_number || item.orderNumber || (item.id ? `RS-2026-${item.id}` : `RS-2026-${1000 + index}`);
        let date = item.created_at || item.date || new Date().toLocaleString('en-IN');
        if (item.created_at) {
          try {
            const parsed = new Date(item.created_at.replace(' ', 'T'));
            if (!isNaN(parsed.getTime())) {
              date = parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
            }
          } catch (e) {}
        }
        const customer = {
          name: item.customer_name || item.customer?.name || 'Walk-in Customer',
          mobile: item.customer_mobile || item.customer?.mobile || '',
        };
        const orderShop = item.shop_details || item.shopDetails || apiShop || null;
        const items = Array.isArray(item.items) ? item.items.map((i, idx) => {
          const unitPrice = Number(i.unit_price ?? i.price ?? i.discountedPrice ?? 0);
          const qty = Number(i.quantity ?? i.qty ?? 1);
          const pCode = i.product_code || i.code || '';
          return {
            id: i.product_id || i.id || idx + 1,
            productId: i.product_id,
            code: pCode,
            product_code: pCode,
            name: i.product_name || i.name || `Item ${idx + 1}`,
            quantity: qty,
            discountedPrice: unitPrice,
            price: unitPrice,
            unitPrice: unitPrice,
            total: Number(i.total_price ?? i.total ?? (unitPrice * qty)),
          };
        }) : [];

        const itemsSubtotal = items.reduce((s, i) => s + (i.discountedPrice * i.quantity), 0);
        const subtotal = Number(item.subtotal ?? item.sub_total ?? itemsSubtotal);
        const taxPercentage = Number(item.tax_percentage ?? item.taxPercentage ?? 18);
        const gstAmount = Number(item.tax_amount ?? item.gst_amount ?? item.gstAmount ?? item.gst ?? 0);

        const basicDiscountPercentage = Number(item.basic_discount_percentage ?? item.basicDiscountPercentage ?? 0);
        const basicDiscountAmount = Number(item.basic_discount_amount ?? item.basicDiscountAmount ?? 0);
        const otherDiscountType = item.other_discount_type || item.otherDiscountType || 'amount';
        const otherDiscountValue = Number(item.other_discount_value ?? item.otherDiscountValue ?? 0);
        const otherDiscountAmount = Number(item.other_discount_amount ?? item.otherDiscountAmount ?? 0);
        const couponDiscount = Number(item.coupon_discount ?? item.couponDiscount ?? 0);

        const referralCode = (item.referral_code || item.referralCode || '').trim();
        const requirementNote = (item.requirement_note || item.requirementNote || item.order_notes || item.notes || item.note || '').trim();
        const referralCustomerDiscount = Number(item.referral_customer_discount || item.referralCustomerDiscount || 0);
        const referralDiscountAmount = (otherDiscountType === 'percentage' && referralCode && otherDiscountAmount > 0)
          ? otherDiscountAmount
          : (referralCustomerDiscount > 0 ? (subtotal * referralCustomerDiscount) / 100 : 0);

        const explicitDiscount = Number(item.discount_amount ?? item.discountAmount ?? 0);
        const standardDiscounts = basicDiscountAmount + otherDiscountAmount + couponDiscount;
        const discountAmount = explicitDiscount > standardDiscounts
          ? explicitDiscount
          : (standardDiscounts + referralDiscountAmount);

        const calculatedPayable = Math.max(0, Number((subtotal + gstAmount - discountAmount).toFixed(2)));
        let payableAmount = Number(item.payable_amount ?? item.grand_total ?? item.grandTotal ?? item.total_amount ?? item.total ?? calculatedPayable);
        if (referralDiscountAmount > 0 && Math.abs(payableAmount - (subtotal + gstAmount)) < 0.05) {
          payableAmount = calculatedPayable;
        }

        const paidAmount = Number(item.paid_amount ?? item.paidAmount ?? payableAmount);
        let balanceDue = Number(item.remaing_amount ?? item.remaining_amount ?? item.balance_due ?? item.balanceDue ?? Math.max(0, payableAmount - paidAmount));
        const rawStatus = (item.payment_status || item.paymentStatus || '').toString().toLowerCase();
        let paymentStatus = 'paid';
        if (['refunded', 'failed', 'unpaid', 'pending', 'partial', 'paid'].includes(rawStatus)) {
          paymentStatus = rawStatus;
        } else {
          paymentStatus = (balanceDue === 0 || Math.abs(paidAmount - payableAmount) < 0.05) ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');
        }
        if (paymentStatus === 'paid') {
          balanceDue = 0;
        }

        return {
          id: item.id || index + 1,
          orderNumber,
          date,
          created_at: item.created_at,
          customer: {
            ...customer,
            address: item.address || '',
            postalcode: item.postalcode || '',
          },
          customer_name: customer.name,
          customer_mobile: customer.mobile,
          requirement_note: requirementNote,
          requirementNote: requirementNote,
          order_notes: requirementNote,
          notes: requirementNote,
          address: item.address || '',
          postalcode: item.postalcode || '',
          items,
          subtotal,
          taxPercentage,
          tax_percentage: taxPercentage,
          gstAmount,
          tax_amount: gstAmount,
          basicDiscountPercentage,
          basicDiscountAmount,
          otherDiscountType,
          otherDiscountValue,
          otherDiscountAmount,
          couponDiscount,
          referral_code: referralCode,
          referralCode,
          referral_customer_discount: referralCustomerDiscount,
          referralCustomerDiscount,
          referralDiscountPercentage: referralCustomerDiscount,
          referralDiscountAmount,
          discountAmount,
          grandTotal: payableAmount,
          payableAmount,
          paidAmount,
          balanceDue,
          remainingAmount: balanceDue,
          paymentStatus,
          orderStatus: item.order_status || item.orderStatus || 'completed',
          paymentMethod: item.payment_method || item.paymentMethod || 'Cash',
          paymentType: item.payment_type || item.paymentType || (balanceDue > 0 ? 'credit' : 'full'),
          shop_details: orderShop,
          shopDetails: orderShop,
          rawItem: item,
        };
      });
    } catch (error) {
      console.warn('Failed to fetch offline orders from API:', error);
      return [];
    }
  },

  /**
   * Fetch single offline order detail by ID
   * GET /orders/offline/:id (or /orders/offlinex/:id)
   * @param {string|number} orderId - Order ID
   * @returns {Promise<Object|null>} Normalized order detail object
   */
  getOrderById: async (orderId) => {
    if (!orderId) return null;
    try {
      const cleanId = String(orderId).trim();
      const isNumericId = /^\d+$/.test(cleanId);
      let response = null;
      let matchedOrderSummary = null;
      let isEstimateOrder = false;

      // 1. Direct fetch if numeric ID
      if (isNumericId) {
        // Try offline order first
        try {
          response = await apiClient.get(`${ENDPOINTS.OFFLINE_ORDERS}/${cleanId}`);
        } catch (err0) {
          try {
            response = await apiClient.get(`${ENDPOINTS.CREATE_OFFLINE_ORDER_ALT}/${cleanId}`);
          } catch (err1) {
            // Try estimate order
            try {
              response = await apiClient.get(`${ENDPOINTS.ESTIMATE_ORDERS}/${cleanId}`);
              if (response?.data) isEstimateOrder = true;
            } catch (err2) {
              try {
                response = await apiClient.get(`${ENDPOINTS.ESTIMATE_ORDERS_ALT}/${cleanId}`);
                if (response?.data) isEstimateOrder = true;
              } catch (err3) {
                try {
                  response = await apiClient.get(`${ENDPOINTS.MY_ORDERS}/${cleanId}`);
                } catch (e) {}
              }
            }
          }
        }
      }

      // Check if response already has valid items
      const hasResponseItems = Boolean(
        response?.data &&
        Array.isArray(response.data.items) &&
        response.data.items.length > 0
      );

      // 2. If not numeric or direct fetch did not return valid items, search across lists
      if (!hasResponseItems) {
        // Check offline orders list
        try {
          const listRes = await apiClient.get(ENDPOINTS.OFFLINE_ORDERS);
          const rawOrders = Array.isArray(listRes)
            ? listRes
            : Array.isArray(listRes?.data)
            ? listRes.data
            : Array.isArray(listRes?.orders)
            ? listRes.orders
            : [];

          matchedOrderSummary = rawOrders.find(o =>
            String(o.order_no || o.order_number || o.orderNumber || o.id).toLowerCase() === cleanId.toLowerCase() ||
            String(o.id) === cleanId
          );

          if (matchedOrderSummary?.id) {
            try {
              const singleRes = await apiClient.get(`${ENDPOINTS.OFFLINE_ORDERS}/${matchedOrderSummary.id}`);
              if (singleRes?.data) {
                response = singleRes;
                isEstimateOrder = false;
              }
            } catch (errFetch) {
              try {
                const altSingle = await apiClient.get(`${ENDPOINTS.CREATE_OFFLINE_ORDER_ALT}/${matchedOrderSummary.id}`);
                if (altSingle?.data) {
                  response = altSingle;
                  isEstimateOrder = false;
                }
              } catch (e) {}
            }
          }
        } catch (listErr) {
          console.warn('Orders list lookup failed in getOrderById:', listErr);
        }

        // If not found in offline orders, search in estimates list
        const foundOfflineWithItems = Boolean(
          response?.data &&
          Array.isArray(response.data.items) &&
          response.data.items.length > 0
        );

        if (!foundOfflineWithItems) {
          try {
            let estRes;
            try {
              estRes = await apiClient.get(ENDPOINTS.ESTIMATE_ORDERS);
            } catch {
              estRes = await apiClient.get(ENDPOINTS.ESTIMATE_ORDERS_ALT);
            }

            const rawEstimates = Array.isArray(estRes)
              ? estRes
              : Array.isArray(estRes?.data)
              ? estRes.data
              : [];

            const matchedEst = rawEstimates.find(o =>
              String(o.order_no || o.order_number || o.orderNumber || o.id).toLowerCase() === cleanId.toLowerCase() ||
              String(o.id) === cleanId
            );

            if (matchedEst) {
              matchedOrderSummary = matchedEst;
              isEstimateOrder = true;
              if (matchedEst.id) {
                try {
                  const estSingle = await apiClient.get(`${ENDPOINTS.ESTIMATE_ORDERS}/${matchedEst.id}`);
                  if (estSingle?.data) {
                    response = estSingle;
                  }
                } catch (estSingleErr) {
                  try {
                    const estAltSingle = await apiClient.get(`${ENDPOINTS.ESTIMATE_ORDERS_ALT}/${matchedEst.id}`);
                    if (estAltSingle?.data) {
                      response = estAltSingle;
                    }
                  } catch (e) {}
                }
              }
            }
          } catch (estErr) {
            console.warn('Estimate list lookup failed in getOrderById:', estErr);
          }
        }
      }

      // Check localStorage for offline orders / items fallback
      let localFound = null;
      try {
        const savedOrders = JSON.parse(localStorage.getItem('billing_orders') || '[]');
        localFound = savedOrders.find(o =>
          String(o.orderNumber || o.order_no || o.id).toLowerCase() === cleanId.toLowerCase()
        );
      } catch (storageErr) {}

      let item = (response?.data && !Array.isArray(response.data))
        ? response.data
        : (Array.isArray(response?.data) ? response.data[0] : (response?.order || response));

      if ((!item || typeof item !== 'object' || !item.id) && matchedOrderSummary) {
        item = matchedOrderSummary;
      }
      if ((!item || typeof item !== 'object' || !item.id) && localFound) {
        item = localFound;
      }

      if (!item || typeof item !== 'object') return null;

      const shopDetails =
        item.shop_details ||
        item.shopDetails ||
        response?.shop_details ||
        response?.data?.shop_details ||
        matchedOrderSummary?.shop_details ||
        localFound?.shop_details ||
        localFound?.shopDetails ||
        (() => {
          try {
            return JSON.parse(localStorage.getItem('shop_details') || 'null');
          } catch {
            return null;
          }
        })();

      if (shopDetails && typeof shopDetails === 'object') {
        try {
          localStorage.setItem('shop_details', JSON.stringify(shopDetails));
        } catch (e) {}
      }

      const orderNumber = item.order_no || item.order_number || item.orderNumber || localFound?.orderNumber || (item.id ? `RS-2026-${item.id}` : `RS-2026-${orderId}`);
      let date = item.created_at || item.date || localFound?.date || new Date().toLocaleString('en-IN');
      if (item.created_at) {
        try {
          const parsed = new Date(item.created_at.replace(' ', 'T'));
          if (!isNaN(parsed.getTime())) {
            date = parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
          }
        } catch (e) {}
      }
      const customer = {
        name: item.customer_name || item.customer?.name || localFound?.customer?.name || localFound?.customer_name || 'Walk-in Customer',
        mobile: item.customer_mobile || item.customer?.mobile || localFound?.customer?.mobile || localFound?.customer_mobile || '',
      };

      // Extract raw items from API response or local storage
      let rawItemList = [];
      if (Array.isArray(item.items) && item.items.length > 0) {
        rawItemList = item.items;
      } else if (Array.isArray(localFound?.items) && localFound.items.length > 0) {
        rawItemList = localFound.items;
      }

      // Fetch products list from proerp/products API to enrich items with product_code, proerp data, images
      let productCatalog = [];
      try {
        productCatalog = await productService.getProducts();
      } catch (prodErr) {
        console.warn('Failed to load products for item enrichment:', prodErr);
      }

      const items = rawItemList.map((i, idx) => {
        const prodId = Number(i.product_id ?? i.productId ?? i.id ?? 0);
        const prodName = (i.product_name || i.name || '').trim();
        const pCodeExplicit = (i.product_code || i.code || '').trim();

        // Match against live products catalog (proerp)
        const foundProd = productCatalog.find(p =>
          (prodId > 0 && (Number(p.id) === prodId || Number(p.product_id) === prodId)) ||
          (pCodeExplicit && (p.product_code === pCodeExplicit || p.code === pCodeExplicit)) ||
          (prodName && p.name && p.name.trim().toLowerCase() === prodName.toLowerCase())
        );

        const unitPrice = Number(i.unit_price ?? i.price ?? i.discountedPrice ?? foundProd?.discountedPrice ?? foundProd?.price ?? 0);
        const originalPrice = Number(i.original_price ?? i.originalPrice ?? i.mrp ?? foundProd?.originalPrice ?? unitPrice);
        const qty = Number(i.quantity ?? i.qty ?? 1);
        const resolvedCode = pCodeExplicit || foundProd?.product_code || foundProd?.code || '';
        const resolvedName = prodName || foundProd?.name || `Item ${idx + 1}`;
        const totalPrice = Number(i.total_price ?? i.total ?? (unitPrice * qty));
        const proerpData = foundProd?.proerp || foundProd?.proerp_data || (foundProd?.stock_count !== undefined ? { stock_count: foundProd.stock_count } : null);

        return {
          id: prodId || foundProd?.id || idx + 1,
          productId: prodId || foundProd?.id || idx + 1,
          product_id: prodId || foundProd?.id || idx + 1,
          code: resolvedCode,
          product_code: resolvedCode,
          name: resolvedName,
          product_name: resolvedName,
          quantity: qty,
          qty,
          unitPrice,
          unit_price: unitPrice,
          price: unitPrice,
          discountedPrice: unitPrice,
          originalPrice,
          total: totalPrice,
          total_price: totalPrice,
          stock_count: Number(i.stock_count ?? foundProd?.stock_count ?? 0),
          proerp: proerpData,
          proerp_data: proerpData,
          image: i.image || foundProd?.image || null,
          packageInfo: foundProd?.packageInfo || foundProd?.pack_quantity || '',
        };
      });

      const itemsSubtotal = items.reduce((s, i) => s + (i.discountedPrice * i.quantity), 0);
      const subtotal = Number(item.subtotal ?? item.sub_total ?? localFound?.subtotal ?? itemsSubtotal);
      const taxPercentage = Number(item.tax_percentage ?? item.taxPercentage ?? localFound?.taxPercentage ?? 18);
      const gstAmount = Number(item.tax_amount ?? item.gst_amount ?? item.gstAmount ?? item.gst ?? localFound?.gstAmount ?? 0);

      const basicDiscountPercentage = Number(item.basic_discount_percentage ?? item.basicDiscountPercentage ?? localFound?.basicDiscountPercentage ?? 0);
      const basicDiscountAmount = Number(item.basic_discount_amount ?? item.basicDiscountAmount ?? localFound?.basicDiscountAmount ?? 0);
      const otherDiscountType = item.other_discount_type || item.otherDiscountType || localFound?.otherDiscountType || 'amount';
      const otherDiscountValue = Number(item.other_discount_value ?? item.otherDiscountValue ?? localFound?.otherDiscountValue ?? 0);
      const otherDiscountAmount = Number(item.other_discount_amount ?? item.otherDiscountAmount ?? localFound?.otherDiscountAmount ?? 0);
      const couponDiscount = Number(item.coupon_discount ?? item.couponDiscount ?? localFound?.coupon_discount ?? 0);

      const referralCode = (item.referral_code || item.referralCode || localFound?.referral_code || localFound?.referralCode || '').trim();
      const requirementNote = (item.requirement_note || item.requirementNote || item.order_notes || item.notes || item.remark || item.note || localFound?.requirement_note || localFound?.requirementNote || localFound?.notes || '').trim();
      const referralCustomerDiscount = Number(item.referral_customer_discount || item.referralCustomerDiscount || localFound?.referral_customer_discount || 0);
      const referralDiscountAmount = (otherDiscountType === 'percentage' && referralCode && otherDiscountAmount > 0)
        ? otherDiscountAmount
        : (referralCustomerDiscount > 0 ? (subtotal * referralCustomerDiscount) / 100 : 0);

      const explicitDiscount = Number(item.discount_amount ?? item.discountAmount ?? localFound?.discountAmount ?? 0);
      const standardDiscounts = basicDiscountAmount + otherDiscountAmount + couponDiscount;
      const discountAmount = explicitDiscount > standardDiscounts
        ? explicitDiscount
        : (standardDiscounts + referralDiscountAmount);

      const calculatedPayable = Math.max(0, Number((subtotal + gstAmount - discountAmount).toFixed(2)));
      let payableAmount = Number(item.payable_amount ?? item.grand_total ?? item.grandTotal ?? item.total_amount ?? item.total ?? localFound?.grandTotal ?? calculatedPayable);
      if (referralDiscountAmount > 0 && Math.abs(payableAmount - (subtotal + gstAmount)) < 0.05) {
        payableAmount = calculatedPayable;
      }

      const paidAmount = Number(item.paid_amount ?? item.paidAmount ?? localFound?.paidAmount ?? payableAmount);
      let balanceDue = Number(item.remaing_amount ?? item.remaining_amount ?? item.balance_due ?? item.balanceDue ?? localFound?.balanceDue ?? Math.max(0, payableAmount - paidAmount));
      const rawStatus = (item.payment_status || item.paymentStatus || localFound?.paymentStatus || localFound?.payment_status || '').toString().toLowerCase();
      let paymentStatus = 'paid';
      if (['refunded', 'failed', 'unpaid', 'pending', 'partial', 'paid'].includes(rawStatus)) {
        paymentStatus = rawStatus;
      } else {
        paymentStatus = (balanceDue === 0 || Math.abs(paidAmount - payableAmount) < 0.05) ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');
      }
      if (paymentStatus === 'paid') {
        balanceDue = 0;
      }

      const isEstimate = Boolean(
        isEstimateOrder ||
        item.is_estimate === '1' ||
        item.is_estimate === 1 ||
        item.is_estimate === true ||
        item.isEstimate ||
        item.order_type === 'estimate' ||
        localFound?.isEstimate ||
        localFound?.is_estimate === '1' ||
        String(orderNumber).startsWith('EST-')
      );

      return {
        id: item.id || localFound?.id || orderId,
        orderNumber,
        order_no: orderNumber,
        date,
        created_at: item.created_at || localFound?.created_at,
        customer: {
          ...customer,
          address: item.address || localFound?.address || '',
          postalcode: item.postalcode || localFound?.postalcode || '',
        },
        customer_name: customer.name,
        customer_mobile: customer.mobile,
        requirement_note: requirementNote,
        requirementNote: requirementNote,
        order_notes: requirementNote,
        notes: requirementNote,
        remark: requirementNote || (isEstimate ? 'Estimate only' : ''),
        address: item.address || localFound?.address || '',
        postalcode: item.postalcode || localFound?.postalcode || '',
        items,
        subtotal,
        taxPercentage,
        tax_percentage: taxPercentage,
        gstAmount,
        tax_amount: gstAmount,
        basicDiscountPercentage,
        basicDiscountAmount,
        otherDiscountType,
        otherDiscountValue,
        otherDiscountAmount,
        couponDiscount,
        referral_code: referralCode,
        referralCode,
        referral_customer_discount: referralCustomerDiscount,
        referralCustomerDiscount,
        referralDiscountPercentage: referralCustomerDiscount,
        referralDiscountAmount,
        discountAmount,
        grandTotal: payableAmount,
        payableAmount,
        paidAmount,
        balanceDue,
        remainingAmount: balanceDue,
        paymentStatus,
        orderStatus: item.order_status || item.orderStatus || 'completed',
        paymentMethod: item.payment_method || item.paymentMethod || localFound?.paymentMethod || 'Cash',
        paymentType: item.payment_type || item.paymentType || (balanceDue > 0 ? 'credit' : 'full'),
        is_estimate: isEstimate ? '1' : '0',
        isEstimate,
        order_type: isEstimate ? 'estimate' : (item.order_type || 'offline'),
        shop_details: shopDetails,
        shopDetails: shopDetails,
        rawItem: item,
      };
    } catch (error) {
      console.warn(`Failed to fetch order details for ID ${orderId}:`, error);
      return null;
    }
  },

  /**
   * Update an existing offline order via API
   * PUT /orders/offline/:id
   * @param {string|number} orderId - Order ID
   * @param {Object} orderData - Updated order data (normalized order object)
   * @returns {Promise<Object|null>} API Response or null on failure
   */
  updateOfflineOrder: async (orderId, orderData) => {
    if (!orderId) return null;
    try {
      const items = (orderData.items || []).map(item => {
        const unitPrice = Number(item.price ?? item.unit_price ?? item.discountedPrice ?? 0);
        const qty = Number(item.quantity ?? item.qty ?? 1);
        const totalPrice = Number(item.total_price ?? item.total ?? (unitPrice * qty));
        return {
          product_id: item.product_id ?? item.productId ?? item.id,
          product_name: item.product_name ?? item.name ?? 'crackers',
          product_code: item.product_code ?? item.code ?? '',
          quantity: qty,
          price: unitPrice,
          unit_price: unitPrice,
          total_price: totalPrice,
        };
      });

      const requirementNote = (
        orderData.requirement_note ||
        orderData.requirementNote ||
        orderData.order_notes ||
        orderData.notes ||
        ''
      ).trim();

      const payableAmount = Number(
        orderData.payableAmount ??
        orderData.grandTotal ??
        orderData.payable_amount ??
        0
      );

      const paidAmount = Number(orderData.paidAmount ?? payableAmount);

      const payload = {
        customer_name: (orderData.customer?.name || orderData.customer_name || 'Walk-in Customer').trim(),
        customer_mobile: (orderData.customer?.mobile || orderData.customer_mobile || '').trim(),
        requirement_note: requirementNote,
        order_notes: requirementNote,
        notes: requirementNote,
        address: orderData.customer?.address || orderData.address || '',
        postalcode: orderData.customer?.postalcode || orderData.postalcode || '',
        payment_method: (orderData.paymentMethod || orderData.payment_method || 'cash').toString().toLowerCase(),
        payment_status: (orderData.paymentStatus || orderData.payment_status || 'paid').toString().toLowerCase(),
        paymentStatus: (orderData.paymentStatus || orderData.payment_status || 'paid').toString().toLowerCase(),
        payable_amount: payableAmount,
        paid_amount: paidAmount,
        balance_due: Number(orderData.balanceDue ?? Math.max(0, payableAmount - paidAmount)),
        subtotal: Number(orderData.subtotal || 0),
        tax_amount: Number(orderData.gstAmount || orderData.tax_amount || 0),
        referral_code: orderData.referral_code || orderData.referralCode || '',
        referral_customer_discount: Number(orderData.referral_customer_discount || orderData.referralCustomerDiscount || 0),
        coupon_code: orderData.coupon_code || orderData.couponCode || '',
        coupon_discount: Number(orderData.couponDiscount || orderData.coupon_discount || 0),
        items,
      };

      try {
        const response = await apiClient.put(`${ENDPOINTS.OFFLINE_ORDERS}/${orderId}`, payload);
        return response;
      } catch (err) {
        console.warn(`PUT /orders/offline/${orderId} failed, trying offlinex:`, err);
        try {
          return await apiClient.put(`${ENDPOINTS.CREATE_OFFLINE_ORDER_ALT}/${orderId}`, payload);
        } catch (altErr) {
          console.warn('PUT offlinex also failed:', altErr);
          return null;
        }
      }
    } catch (error) {
      console.warn(`updateOfflineOrder failed for ID ${orderId}:`, error);
      return null;
    }
  },
};

