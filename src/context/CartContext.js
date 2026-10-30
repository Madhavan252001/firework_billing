import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const CartContext = createContext(null);

function load(key, fallback) {
  try { const v = localStorage.getItem('billing_' + key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => load('cart', []));
  const [customer, setCustomer] = useState(() => load('customer', { name: '', mobile: '' }));
  const [gst, setGst] = useState(() => ({
    ...load('gst', { enabled: true, percentage: 18 }),
    enabled: true,
  }));
  const [discount, setDiscount] = useState(() => load('discount', {
    enabled: false,
    type: 'percentage',
    value: '',
    otherMode: 'manual',
    otherType: 'fixed',
    otherValue: '',
    selectedOfferId: null,
    selectedOfferName: '',
  }));
  const [referral, setReferral] = useState(() => load('referral', {
    applied: false,
    code: '',
    name: '',
    mobile: '',
    customerDiscount: 0,
    salesPartnerDiscount: 0,
    data: null,
  }));
  const [paymentMethod, setPaymentMethod] = useState(() => load('payment', ''));
  const [requirementNote, setRequirementNote] = useState(() => load('requirement_note', ''));
  const [orderProcessed, setOrderProcessed] = useState(null);

  useEffect(() => { localStorage.setItem('billing_cart', JSON.stringify(cartItems)); }, [cartItems]);
  useEffect(() => { localStorage.setItem('billing_customer', JSON.stringify(customer)); }, [customer]);
  useEffect(() => { localStorage.setItem('billing_gst', JSON.stringify(gst)); }, [gst]);
  useEffect(() => { localStorage.setItem('billing_discount', JSON.stringify(discount)); }, [discount]);
  useEffect(() => { localStorage.setItem('billing_referral', JSON.stringify(referral)); }, [referral]);
  useEffect(() => { localStorage.setItem('billing_payment', JSON.stringify(paymentMethod)); }, [paymentMethod]);
  useEffect(() => { localStorage.setItem('billing_requirement_note', JSON.stringify(requirementNote)); }, [requirementNote]);

  const addToCart = useCallback((product, qty) => {
    const stockLimit = Number(product.stock_count !== undefined ? product.stock_count : (product.stock ?? 9999));
    setCartItems(prev => {
      const idx = prev.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = Math.min(next[idx].quantity + qty, stockLimit);
        next[idx] = { ...next[idx], stock: stockLimit, stock_count: stockLimit, quantity: newQty };
        return next;
      }
      return [...prev, { ...product, stock: stockLimit, stock_count: stockLimit, quantity: Math.min(qty, stockLimit) }];
    });
  }, []);

  const updateQuantity = useCallback((id, qty) => {
    setCartItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const stockLimit = Number(i.stock_count !== undefined ? i.stock_count : (i.stock ?? 9999));
      return { ...i, stock: stockLimit, stock_count: stockLimit, quantity: Math.max(1, Math.min(qty, stockLimit)) };
    }));
  }, []);

  const removeFromCart = useCallback((id) => {
    setCartItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setReferral({
      applied: false,
      code: '',
      name: '',
      mobile: '',
      customerDiscount: 0,
      salesPartnerDiscount: 0,
      data: null,
    });
    setRequirementNote('');
  }, []);

  const applyReferral = useCallback((referralData) => {
    if (!referralData) return;
    setReferral({
      applied: true,
      code: referralData.referral_code || referralData.code || '',
      name: referralData.name || '',
      mobile: referralData.mobile_no || referralData.mobile || '',
      customerDiscount: Number(referralData.customer_discount ?? referralData.customerDiscount ?? 0),
      salesPartnerDiscount: Number(referralData.sales_partner_discount ?? referralData.salesPartnerDiscount ?? 0),
      data: referralData,
    });
  }, []);

  const removeReferral = useCallback(() => {
    setReferral({
      applied: false,
      code: '',
      name: '',
      mobile: '',
      customerDiscount: 0,
      salesPartnerDiscount: 0,
      data: null,
    });
  }, []);

  const resetOrder = useCallback(() => {
    setCartItems([]);
    setCustomer({ name: '', mobile: '' });
    setGst({ enabled: true, percentage: 18 });
    setDiscount({
      enabled: false,
      type: 'percentage',
      value: '',
      otherMode: 'manual',
      otherType: 'fixed',
      otherValue: '',
      selectedOfferId: null,
      selectedOfferName: '',
    });
    setReferral({
      applied: false,
      code: '',
      name: '',
      mobile: '',
      customerDiscount: 0,
      salesPartnerDiscount: 0,
      data: null,
    });
    setPaymentMethod('');
    setRequirementNote('');
    setOrderProcessed(null);
  }, []);

  const inCart = useMemo(() => new Set(cartItems.map(i => i.id)), [cartItems]);

  const subtotal = useMemo(() =>
    cartItems.reduce((s, i) => s + i.discountedPrice * i.quantity, 0), [cartItems]);

  const originalSubtotal = useMemo(() =>
    cartItems.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0), [cartItems]);

  const gstAmount = useMemo(() =>
    gst.enabled ? (subtotal * Number(gst.percentage)) / 100 : 0, [subtotal, gst]);

  const referralDiscountAmount = useMemo(() => {
    if (!referral.applied) return 0;
    const pct = Math.max(0, Number(referral.customerDiscount) || 0);
    return pct > 0 ? (subtotal * pct) / 100 : 0;
  }, [subtotal, referral]);

  const discountAmount = useMemo(() => {
    const basicVal = discount.enabled ? (Number(discount.value) || 0) : 0;
    const basicAmount = discount.enabled
      ? (discount.type === 'percentage'
          ? (subtotal * Math.min(basicVal, 100)) / 100
          : Math.min(basicVal, subtotal))
      : 0;

    const otherVal = discount.enabled ? Math.max(0, Number(discount.otherValue) || 0) : 0;
    const isOtherPercent = discount.otherType === 'percentage' || discount.otherType === 'percent';
    const otherAmount = discount.enabled
      ? (isOtherPercent
          ? (subtotal * Math.min(otherVal, 100)) / 100
          : Math.min(otherVal, subtotal))
      : 0;

    return Math.min(basicAmount + otherAmount + referralDiscountAmount, subtotal);
  }, [subtotal, discount, referralDiscountAmount]);

  const grandTotal = useMemo(() =>
    Math.max(0, subtotal + gstAmount - discountAmount), [subtotal, gstAmount, discountAmount]);

  const cartCount = useMemo(() =>
    cartItems.reduce((s, i) => s + i.quantity, 0), [cartItems]);

  const [stockToast, setStockToast] = useState(null);
  const stockToastTimerRef = React.useRef(null);

  const triggerStockError = useCallback((message) => {
    window.clearTimeout(stockToastTimerRef.current);
    setStockToast(message);
    stockToastTimerRef.current = window.setTimeout(() => {
      setStockToast(null);
    }, 3200);
  }, []);

  const loadOrderToCart = useCallback((order) => {
    if (!order) return;
    if (Array.isArray(order.items)) {
      setCartItems(order.items);
    }
    if (order.customer) {
      setCustomer({
        name: order.customer.name || '',
        mobile: order.customer.mobile || '',
      });
    }
    if (order.gst) {
      setGst(order.gst);
    }
    if (order.discount) {
      setDiscount(order.discount);
    }
    if (order.paymentMethod) {
      setPaymentMethod(order.paymentMethod);
    }
    if (order.requirement_note || order.requirementNote || order.order_notes || order.notes || order.note) {
      setRequirementNote(order.requirement_note || order.requirementNote || order.order_notes || order.notes || order.note || '');
    }
    if (order.referral) {
      setReferral(order.referral);
    } else if (order.referralCode) {
      setReferral({
        applied: true,
        code: order.referralCode,
        name: order.referralName || '',
        mobile: '',
        customerDiscount: Number(order.referralDiscountPercentage || 0),
        salesPartnerDiscount: Number(order.salesPartnerDiscount || 0),
        data: null,
      });
    }
  }, []);

  const ctx = useMemo(() => ({
    cartItems, addToCart, updateQuantity, removeFromCart, clearCart,
    customer, setCustomer, gst, setGst, discount, setDiscount,
    referral, setReferral, applyReferral, removeReferral, referralDiscountAmount,
    requirementNote, setRequirementNote,
    paymentMethod, setPaymentMethod, resetOrder, inCart,
    subtotal, originalSubtotal, gstAmount, discountAmount, grandTotal, cartCount,
    orderProcessed, setOrderProcessed, stockToast, triggerStockError, loadOrderToCart,
  }), [cartItems, addToCart, updateQuantity, removeFromCart, clearCart,
      customer, gst, discount, referral, applyReferral, removeReferral, referralDiscountAmount,
      requirementNote, setRequirementNote,
      paymentMethod, resetOrder, inCart,
      subtotal, originalSubtotal, gstAmount, discountAmount, grandTotal, cartCount, orderProcessed, stockToast, triggerStockError, loadOrderToCart]);

  return (
    <CartContext.Provider value={ctx}>
      {children}
      {stockToast && (
        <div className="stock-error-toast" role="alert" aria-live="assertive">
          <span>⚠️ {stockToast}</span>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error('useCart must be used within CartProvider');
  return c;
}

export function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}
