import { orderService } from '../services/orderService';

const CUSTOMER_STORAGE_KEY = 'billing_customers';

export function loadCustomers() {
  try {
    const customers = JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || '[]');
    return Array.isArray(customers) ? customers : [];
  } catch {
    return [];
  }
}

export function saveCustomer(customer) {
  if (!customer) return;
  const name = (customer.name || '').trim();
  const mobile = (customer.mobile || '').trim();
  if (name.length < 2 || !/^[0-9]{10}$/.test(mobile)) return;

  const existing = loadCustomers().filter(item => item.mobile !== mobile);
  const next = [{ name, mobile, updatedAt: Date.now() }, ...existing].slice(0, 100);
  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(next));
}

export async function fetchAndSyncApiCustomers() {
  const localList = loadCustomers();
  try {
    const apiOrders = await orderService.getOfflineOrders();
    if (!Array.isArray(apiOrders) || apiOrders.length === 0) {
      return localList;
    }

    const apiCustomers = [];
    const seenMobiles = new Set();

    for (const order of apiOrders) {
      const name = (order.customer?.name || order.customer_name || '').trim();
      const mobile = (order.customer?.mobile || order.customer_mobile || '').trim();

      if (
        mobile &&
        name &&
        name.toLowerCase() !== 'walk-in customer' &&
        name.toLowerCase() !== 'customer' &&
        !seenMobiles.has(mobile)
      ) {
        seenMobiles.add(mobile);
        apiCustomers.push({ name, mobile, updatedAt: order.created_at || Date.now() });
      }
    }

    const existingMap = new Map();
    localList.forEach(c => existingMap.set(c.mobile, c));
    apiCustomers.forEach(c => {
      if (!existingMap.has(c.mobile)) {
        existingMap.set(c.mobile, c);
      }
    });

    const merged = Array.from(existingMap.values()).slice(0, 100);
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (error) {
    console.warn('Failed to sync customers from Purchase History API:', error);
    return localList;
  }
}


