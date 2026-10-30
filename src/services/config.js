export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? '/fireworks/crackers' : 'https://offer360.in/fireworks/crackers');

export const ENDPOINTS = {
  ADMIN_LOGIN: '/Adminlogin',
  STAFF_LOGIN: '/staffLogin',
  GET_CATEGORIES: '/category',
  GET_PRODUCTS: '/products',
  GET_DISCOUNTS: '/discounts',
  MY_ORDERS: '/myorders',
  MY_ORDERS_ALT: '/crackers/myorders',
  OFFLINE_ORDERS: '/orders/offline',
  CREATE_OFFLINE_ORDER: '/orders/offline',
  CREATE_OFFLINE_ORDER_ALT: '/orders/offlinex',
  REFERRAL_CODE: (code) => `/referrals/code/${encodeURIComponent(code)}`,
  REFERRAL_CODE_ALT: (code) => `/referals/code/${encodeURIComponent(code)}`,
  REFERRAL_CODE_MY: (code) => `/myreferral/code/${encodeURIComponent(code)}`,
  ESTIMATE_ORDERS: '/orders/estimates',
  ESTIMATE_ORDERS_ALT: '/crackers/orders/estimates',
  CREATE_ESTIMATE_ORDER: '/orders/estimates',
  CREATE_ESTIMATE_ORDER_ALT: '/crackers/orders/estimates',
  DELETE_ESTIMATE_ORDER: (id) => `/order/estimates/${id}`,
  DELETE_ESTIMATE_ORDER_ALT: (id) => `/crackers/order/estimates/${id}`,
  DELETE_ESTIMATE_ORDERS_PLURAL: (id) => `/orders/estimates/${id}`,
  DELETE_ESTIMATE_ORDERS_PLURAL_ALT: (id) => `/crackers/orders/estimates/${id}`,
  UPDATE_PRODUCT: (id) => `/products/${id}`,
  UPDATE_PRODUCT_ALT: (id) => `/crackers/products/${id}`,
};

export const getShopDomain = () => {
  if (typeof window === 'undefined') {
    return process.env.REACT_APP_DEFAULT_SHOP_DOMAIN || 'shivacrackers.pattaz.com';
  }

  const hostname = window.location.hostname;

  // Fallback for localhost and IP addresses during local development
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.endsWith('.local')
  ) {
    return process.env.REACT_APP_DEFAULT_SHOP_DOMAIN || 'shivacrackers.pattaz.com';
  }

  return hostname;
};

export const formatShopSlug = (slug) => {
  if (!slug) return 'RS Fireworks';

  let name = slug.replace(/[-_]+/g, ' ').trim();

  name = name.replace(/([a-z])(crackers|fireworks|traders|agency|agencies|stores|mart|shop)/gi, '$1 $2');
  name = name.replace(/(rs|k7|sri|om|jai|sree)([a-z])/gi, (m, p1, p2) => `${p1} ${p2}`);

  return name
    .split(/\s+/)
    .map(word => {
      const upper = word.toUpperCase();
      if (['RS', 'K7', 'OM', 'JAI', 'UK', 'US', '360', 'POS'].includes(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

export const getShopName = () => {
  try {
    const savedShopStr = localStorage.getItem('shop_details');
    if (savedShopStr) {
      const savedShop = JSON.parse(savedShopStr);
      const name = savedShop.shop_name || savedShop.store_name || savedShop.name;
      if (name && typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }
  } catch (e) {}

  try {
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      const name =
        userInfo.shop_name ||
        userInfo.store_name ||
        userInfo.company_name ||
        userInfo.business_name ||
        userInfo.shop_domain_name;
      if (name && typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }
  } catch (e) {
    // Ignore JSON parse error
  }

  const domain = getShopDomain();
  let slug = domain.split('.')[0];

  if (!slug || slug === 'localhost' || slug === '127' || slug === '192') {
    if (process.env.REACT_APP_DEFAULT_SHOP_NAME) {
      return process.env.REACT_APP_DEFAULT_SHOP_NAME;
    }
    const defaultDomain = process.env.REACT_APP_DEFAULT_SHOP_DOMAIN || 'shivacrackers.pattaz.com';
    slug = defaultDomain.split('.')[0];
  }

  return formatShopSlug(slug);
};

export const getShopDetails = (orderData = null) => {
  let shop = orderData?.shop_details || orderData?.shopDetails || null;

  let savedShop = null;
  try {
    const saved = localStorage.getItem('shop_details');
    if (saved) savedShop = JSON.parse(saved);
  } catch (e) {}

  let savedUserInfo = null;
  try {
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) savedUserInfo = JSON.parse(userInfoStr);
  } catch (e) {}

  if (!shop) {
    shop = savedShop || null;
  }

  if (!shop && savedUserInfo) {
    shop = {
      shop_name: savedUserInfo.shop_name || savedUserInfo.store_name || savedUserInfo.company_name || savedUserInfo.business_name || savedUserInfo.shop_domain_name,
      address: savedUserInfo.address || savedUserInfo.shop_address || savedUserInfo.address_line,
      landmark: savedUserInfo.landmark,
      postalcode: savedUserInfo.postalcode || savedUserInfo.postal_code || savedUserInfo.pincode,
      gst_no: savedUserInfo.gst_no || savedUserInfo.gst_number || savedUserInfo.gstin,
      license_no: savedUserInfo.license_no || savedUserInfo.license || savedUserInfo.lic_no,
      phone: savedUserInfo.mobile_no || savedUserInfo.phone || savedUserInfo.mobile || savedUserInfo.contact_no,
      footer_logo_url: savedUserInfo.footer_logo_url || savedUserInfo.footer_logo,
    };
  }

  const shopName = (
    shop?.shop_name ||
    shop?.name ||
    shop?.store_name ||
    savedShop?.shop_name ||
    savedUserInfo?.shop_name ||
    getShopName() ||
    'shivacrackers'
  );

  const rawAddress = shop?.address || shop?.shop_address || shop?.store_address || savedShop?.address || 'madurai';
  const landmark = shop?.landmark || savedShop?.landmark || '';
  const postalcode = shop?.postalcode || shop?.postal_code || shop?.pincode || savedShop?.postalcode || '625001';

  let formattedAddress = rawAddress;
  if (landmark && landmark.toLowerCase() !== rawAddress.toLowerCase() && !rawAddress.toLowerCase().includes(landmark.toLowerCase())) {
    formattedAddress = `${formattedAddress}, ${landmark}`;
  }
  if (postalcode && !formattedAddress.includes(postalcode)) {
    formattedAddress = `${formattedAddress} - ${postalcode}`;
  }

  const gstNumber = (
    shop?.gst_no ||
    shop?.gst_number ||
    shop?.gstin ||
    shop?.gst ||
    savedShop?.gst_no ||
    ''
  );

  const licenseNumber = (
    shop?.license_no ||
    shop?.license ||
    shop?.lic_no ||
    savedShop?.license_no ||
    ''
  );

  let footerLogoUrl = (
    shop?.footer_logo_url ||
    shop?.footer_logo ||
    shop?.logo_url ||
    shop?.logo ||
    savedShop?.footer_logo_url ||
    'https://offer360.in/uploads_crackers/sds_crackers_shop_2/footer/footer_2_20260816134409.jpeg'
  );

  if (footerLogoUrl && footerLogoUrl.startsWith('/')) {
    footerLogoUrl = `https://offer360.in${footerLogoUrl}`;
  }

  const phone = (
    shop?.phone ||
    shop?.mobile_no ||
    shop?.mobile ||
    shop?.phone_no ||
    shop?.contact_no ||
    shop?.contact ||
    savedShop?.phone ||
    savedShop?.mobile_no ||
    savedShop?.mobile ||
    savedUserInfo?.mobile_no ||
    savedUserInfo?.phone ||
    savedUserInfo?.mobile ||
    savedUserInfo?.contact_no ||
    process.env.REACT_APP_STORE_PHONE ||
    process.env.REACT_APP_DEFAULT_PHONE ||
    '9876543210'
  );

  return {
    ...shop,
    shop_name: shopName,
    name: shopName,
    address: formattedAddress,
    raw_address: rawAddress,
    landmark,
    postalcode,
    gst_no: gstNumber,
    gst_number: gstNumber,
    gstin: gstNumber,
    license_no: licenseNumber,
    license: licenseNumber,
    footer_logo_url: footerLogoUrl,
    footer_logo: footerLogoUrl,
    phone,
    mobile: phone,
    store_mobile: phone,
    mobile_no: phone,
  };
};


