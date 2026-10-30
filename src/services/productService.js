import { apiClient } from './apiClient';
import { ENDPOINTS } from './config';
import { getImageSVG } from '../utils/imageUtils';

let cachedProducts = null;
let productsFetchPromise = null;

export const productService = {
  /**
   * Get products list from API
   * GET /products
   * @param {boolean} forceRefresh - If true, bypasses the in-memory cache
   * @returns {Promise<Array>} List of normalized products
   */
  getProducts: async (forceRefresh = false) => {
    if (!forceRefresh && cachedProducts && cachedProducts.length > 0) {
      return cachedProducts;
    }
    if (!forceRefresh && productsFetchPromise) {
      return productsFetchPromise;
    }

    productsFetchPromise = (async () => {
      try {
        const response = await apiClient.get(ENDPOINTS.GET_PRODUCTS);
        const rawProducts = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
          ? response.data
          : [];

        const normalized = rawProducts.map((item, index) => {
          const id = item.id || index + 1;
          const name = item.name || 'Product';
          const originalPrice = Number(item.original_price || item.price || 0);
          const discountedPrice = Number(item.discount_price || item.discounted_price || originalPrice);
          
          let discountPercentage = 0;
          if (item.discount_value) {
            discountPercentage = Number(item.discount_value);
          } else if (originalPrice > 0 && originalPrice > discountedPrice) {
            discountPercentage = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
          }

          const firstImage = Array.isArray(item.product_images) && item.product_images.length > 0
            ? item.product_images[0].images
            : item.image || item.images || null;

          const fallbackImage = getImageSVG(name);
          const productCode = item.product_code || item.code || item.productCode || `PRD-${String(id).padStart(3, '0')}`;

          // Resolve proerp data and stock_count from product API or nested ERP payload
          let proerp = item.proerp || item.proerp_data || item.pro_erp || null;
          if (typeof proerp === 'string') {
            try {
              proerp = JSON.parse(proerp);
            } catch (e) {
              proerp = null;
            }
          }
          if (Array.isArray(proerp)) {
            proerp = proerp[0] || null;
          }

          const rawStock =
            item.stock_count !== undefined && item.stock_count !== null ? item.stock_count :
            proerp?.stock_count !== undefined && proerp?.stock_count !== null ? proerp.stock_count :
            proerp?.stock_qty !== undefined && proerp?.stock_qty !== null ? proerp.stock_qty :
            item.available_stock !== undefined && item.available_stock !== null ? item.available_stock :
            item.stock_qty !== undefined && item.stock_qty !== null ? item.stock_qty :
            proerp?.stock !== undefined && proerp?.stock !== null ? proerp.stock :
            proerp?.available_stock !== undefined && proerp?.available_stock !== null ? proerp.available_stock :
            item.quantity !== undefined && item.quantity !== null ? item.quantity :
            item.stock;

          const stockCount = (rawStock !== undefined && rawStock !== null && rawStock !== '' && !isNaN(Number(rawStock)))
            ? Math.max(0, Number(rawStock))
            : 0;

          const isAvailable = (item.is_active !== 0 && item.is_active !== false && item.status !== 'inactive') && stockCount > 0;

          return {
            id,
            productId: id,
            product_id: id,
            name,
            code: productCode,
            product_code: productCode,
            category: String(item.category_id || item.category || 'all'),
            packageInfo: item.pack_quantity || item.height || item.type || '1 Box',
            stock: stockCount,
            stock_count: stockCount,
            proerp: {
              ...(typeof proerp === 'object' && proerp !== null ? proerp : {}),
              stock_count: stockCount,
              stock: stockCount,
            },
            proerp_data: {
              ...(typeof proerp === 'object' && proerp !== null ? proerp : {}),
              stock_count: stockCount,
              stock: stockCount,
            },
            originalPrice,
            discountedPrice,
            price: discountedPrice,
            discountPercentage,
            description: item.description || `${name} firework product.`,
            isAvailable,
            image: firstImage || fallbackImage,
            fallbackImage,
            rawItem: item,
          };
        });

        if (normalized.length > 0) {
          cachedProducts = normalized;
        }
        return normalized;
      } catch (error) {
        console.warn('Product API request error:', error);
        return cachedProducts || [];
      } finally {
        productsFetchPromise = null;
      }
    })();

    return productsFetchPromise;
  },

  /**
   * Get product by ID or Code
   */
  getProductById: async (idOrCode) => {
    const prods = await productService.getProducts();
    return prods.find(p =>
      String(p.id) === String(idOrCode) ||
      String(p.code).toLowerCase() === String(idOrCode).toLowerCase() ||
      String(p.product_code).toLowerCase() === String(idOrCode).toLowerCase()
    ) || null;
  },

  /**
   * Update product stock count in admin API backend
   * PUT /products/:id with { stock_count: newStockCount }
   * @param {number|string} productId
   * @param {number} newStockCount
   * @returns {Promise<{success: boolean, data?: any, stock_count: number, error?: string}>}
   */
  updateProductStock: async (productId, newStockCount) => {
    const numStock = Math.max(0, parseInt(newStockCount, 10) || 0);
    let apiSuccess = false;
    let apiData = null;
    let apiError = null;

    try {
      const primaryUrl = ENDPOINTS.UPDATE_PRODUCT ? ENDPOINTS.UPDATE_PRODUCT(productId) : `/products/${productId}`;
      apiData = await apiClient.put(primaryUrl, { stock_count: numStock });
      apiSuccess = true;
    } catch (err) {
      try {
        const altUrl = ENDPOINTS.UPDATE_PRODUCT_ALT ? ENDPOINTS.UPDATE_PRODUCT_ALT(productId) : `/crackers/products/${productId}`;
        apiData = await apiClient.put(altUrl, { stock_count: numStock });
        apiSuccess = true;
      } catch (err2) {
        apiError = err?.message || err2?.message || 'Failed to update stock';
        console.warn('API product stock update error:', apiError);
      }
    }

    // Synchronize in-memory cached products
    if (cachedProducts && Array.isArray(cachedProducts)) {
      cachedProducts = cachedProducts.map(p => {
        if (String(p.id) === String(productId)) {
          return {
            ...p,
            stock: numStock,
            stock_count: numStock,
            isAvailable: numStock > 0 && p.rawItem?.is_active !== 0,
            proerp: {
              ...(p.proerp || {}),
              stock_count: numStock,
              stock: numStock,
            },
            proerp_data: {
              ...(p.proerp_data || {}),
              stock_count: numStock,
              stock: numStock,
            },
          };
        }
        return p;
      });
    }

    return {
      success: apiSuccess,
      data: apiData,
      stock_count: numStock,
      error: apiError,
    };
  },

  /**
   * Clear in-memory cached products
   */
  clearCache: () => {
    cachedProducts = null;
    productsFetchPromise = null;
  },
};

