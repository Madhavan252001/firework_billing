import React, { useState, useEffect, useRef } from 'react';
import { X, ShoppingCart, Trash2, User, Phone, Banknote, CreditCard, QrCode, BadgeIndianRupee, Check, LoaderCircle, ReceiptText, Minus, Plus, Tag, FileText, FileSpreadsheet } from 'lucide-react';
import { useCart, fmt } from '../context/CartContext';
import BillSummary from '../components/BillSummary';
import SuccessModal from '../components/SuccessModal';
import ConfirmModal from '../components/ConfirmModal';
import CustomerAutocomplete from '../components/CustomerAutocomplete';
import useLongPress from '../hooks/useLongPress';
import { saveCustomer } from '../utils/customerStore';
import { orderService, discountService, referralService, getShopDetails } from '../services';
import './checkout.css';

const paymentMethods = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'upi', label: 'UPI / GPay / QR', icon: QrCode },
];

export default function Checkout({ onClose, onOrderProcessed }) {
  const {
    cartItems, customer, setCustomer, gst, discount,
    referral, referralDiscountAmount, removeReferral,
    requirementNote, setRequirementNote,
    paymentMethod, setPaymentMethod, addToCart, clearCart,
    subtotal, originalSubtotal, gstAmount, discountAmount, grandTotal
  } = useCart();
  const [showClear, setShowClear] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const [paymentType, setPaymentType] = useState('');
  const [creditPaidAmount, setCreditPaidAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [removalToast, setRemovalToast] = useState(null);
  const processTimerRef = useRef(null);
  const removalToastTimerRef = useRef(null);
  const mobileRef = useRef(null);
  const nameRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (paymentMethod === 'qr') setPaymentMethod('upi');
  }, [paymentMethod, setPaymentMethod]);

  useEffect(() => () => {
    window.clearTimeout(processTimerRef.current);
    window.clearTimeout(removalToastTimerRef.current);
  }, []);

  // Validation
  const nameTrimmed = customer.name.trim();
  const nameError = customer.name.length > 0
    ? nameTrimmed.length < 2
      ? 'Customer name must be at least 2 characters'
      : !/^[a-zA-Z\s.'-]+$/.test(customer.name)
      ? 'Customer name can only contain letters and spaces'
      : ''
    : '';
  const mobileError = customer.mobile.length > 0 && !/^[0-9]{10}$/.test(customer.mobile) ? 'Enter a valid 10-digit mobile number' : '';
  const creditPaid = Number(creditPaidAmount) || 0;
  const balanceDue = Math.max(0, grandTotal - creditPaid);
  const creditPaidPercentage = grandTotal > 0 ? Math.min(100, Math.max(0, (creditPaid / grandTotal) * 100)) : 0;
  const isCredit = paymentType === 'credit';
  const creditError = isCredit && creditPaidAmount && (creditPaid <= 0 || creditPaid >= grandTotal)
    ? `Credit payment must be more than ${fmt(0)} and less than ${fmt(grandTotal)}`
    : '';

  const [clickErrors, setClickErrors] = useState({});

  const canProcess = cartItems.length > 0 &&
    paymentMethod &&
    paymentType &&
    (!isCredit || (creditPaid > 0 && creditPaid < grandTotal)) &&
    ((paymentMethod !== 'upi' && paymentMethod !== 'qr') || upiConfirmed);

  const handleProcessClick = () => {
    const errs = {};
    if (!customer.mobile || !/^[0-9]{10}$/.test(customer.mobile)) {
      errs.mobile = 'Enter a valid 10-digit mobile number';
    }
    if (!nameTrimmed) {
      errs.name = 'Please enter customer name';
    } else if (nameTrimmed.length < 2) {
      errs.name = 'Customer name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s.'-]+$/.test(nameTrimmed)) {
      errs.name = 'Customer name can only contain letters and spaces';
    }

    setClickErrors(errs);
    if (errs.mobile && mobileRef.current) { mobileRef.current.querySelector('input')?.focus(); return; }
    if (errs.name && nameRef.current) { nameRef.current.querySelector('input')?.focus(); return; }
    if (Object.keys(errs).length > 0) return;
    handleProcessOrder();
  };

  const handleClear = () => {
    clearCart();
    removeReferral?.();
    setRequirementNote?.('');
    setCustomer({ name: '', mobile: '' });
    setShowClear(false);
  };

  const handleProcessOrder = async () => {
    if (!canProcess || isProcessing) return;
    setIsProcessing(true);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const orderNum = 'RS-2026-' + String(Math.floor(Math.random() * 9000) + 1000);
    const basicDiscountPercent = (discount.enabled && discount.type === 'percentage') ? Number(discount.value || 0) : 0;
    const basicDiscountAmt = discount.enabled ? (subtotal * Math.min(basicDiscountPercent, 100) / 100) : 0;
    const otherDiscountVal = discount.enabled ? Number(discount.otherValue || 0) : 0;
    const isOtherPercent = discount.otherType === 'percentage' || discount.otherType === 'percent';
    const otherDiscountAmt = discount.enabled ? (isOtherPercent ? (subtotal * Math.min(otherDiscountVal, 100) / 100) : otherDiscountVal) : 0;

    const paidAmt = isCredit ? creditPaid : grandTotal;
    const dueAmt = isCredit ? balanceDue : 0;
    const trimmedReqNote = (requirementNote || '').trim();

    const orderRecord = {
      orderNumber: orderNum,
      date: dateStr,
      customer: { name: customer.name.trim(), mobile: customer.mobile },
      customer_name: customer.name.trim() || 'Walk-in Customer',
      customer_mobile: customer.mobile || '',
      requirement_note: trimmedReqNote,
      requirementNote: trimmedReqNote,
      order_notes: trimmedReqNote,
      notes: trimmedReqNote,
      items: [...cartItems],
      subtotal,
      originalSubtotal,
      taxPercentage: gst.enabled ? Number(gst.percentage || 18) : 0,
      taxAmount: gst.enabled ? gstAmount : 0,
      gstAmount: gst.enabled ? gstAmount : 0,
      basicDiscountPercentage: basicDiscountPercent,
      basicDiscountAmount: basicDiscountAmt,
      otherDiscountType: isOtherPercent ? 'percentage' : 'amount',
      otherDiscountValue: otherDiscountVal,
      otherDiscountAmount: otherDiscountAmt,
      coupon_code: discount?.selectedOfferName || discount?.code || '',
      coupon_discount: basicDiscountAmt + otherDiscountAmt,
      address: customer.address || '',
      postalcode: customer.postalcode || customer.pincode || '',
      referral_code: referral?.applied ? (referral.code || referral.referral_code || '') : (referral?.code || ''),
      referral_customer_discount: referral?.applied ? Number(referral.customerDiscount ?? referral.customer_discount ?? 0) : Number(referral?.customerDiscount ?? referral?.customer_discount ?? 0),
      referralCode: referral?.applied ? (referral.code || referral.referral_code || '') : (referral?.code || ''),
      referralName: referral?.applied ? (referral.name || '') : '',
      referralDiscountPercentage: referral?.applied ? Number(referral.customerDiscount ?? referral.customer_discount ?? 0) : Number(referral?.customerDiscount ?? referral?.customer_discount ?? 0),
      referralDiscountAmount: referral?.applied ? referralDiscountAmount : 0,
      salesPartnerDiscount: referral?.applied ? Number(referral.salesPartnerDiscount ?? referral.sales_partner_discount ?? 0) : 0,
      delivery_fee: 0,
      discountAmount: discountAmount || 0,
      grandTotal,
      payableAmount: grandTotal,
      payable_amount: grandTotal,
      paidAmount: paidAmt,
      balanceDue: dueAmt,
      remainingAmount: dueAmt,
      paymentStatus: isCredit ? (paidAmt > 0 ? 'partial' : 'pending') : 'paid',
      paymentType: paymentType || 'full',
      paymentMethodRaw: paymentMethod,
      payment_method: paymentMethod,
      paymentMethod: paymentMethods.find(m => m.id === paymentMethod)?.label || paymentMethod,
      shop_details: (() => { try { return JSON.parse(localStorage.getItem('shop_details') || 'null'); } catch { return null; } })(),
      shopDetails: (() => { try { return JSON.parse(localStorage.getItem('shop_details') || 'null'); } catch { return null; } })(),
    };

    try {
      const response = await orderService.createOfflineOrder(orderRecord);
      const serverOrderNo = response?.data?.order_no || response?.order_no || response?.data?.orderNumber || response?.orderNumber;
      if (serverOrderNo) {
        orderRecord.orderNumber = serverOrderNo;
      }
      if (response?.data?.id || response?.id) {
        orderRecord.id = response?.data?.id || response?.id;
      }
      const respShop = response?.shop_details || response?.data?.shop_details || null;
      if (respShop) {
        orderRecord.shop_details = respShop;
        orderRecord.shopDetails = respShop;
        try { localStorage.setItem('shop_details', JSON.stringify(respShop)); } catch {}
      }
    } catch (err) {
      console.warn('Offline order API error (continuing with local order flow):', err);
    }

    const resolvedShop = orderRecord.shop_details || getShopDetails();
    orderRecord.shop_details = resolvedShop;
    orderRecord.shopDetails = resolvedShop;

    try {
      const prev = JSON.parse(localStorage.getItem('billing_orders') || '[]');
      prev.push(orderRecord);
      localStorage.setItem('billing_orders', JSON.stringify(prev));
    } catch {}

    saveCustomer({ name: customer.name, mobile: customer.mobile });
    setOrderData(orderRecord);
    onOrderProcessed?.(cartItems);
    clearCart();
    removeReferral?.();
    setRequirementNote?.('');
    setCustomer({ name: '', mobile: '' });
    setIsProcessing(false);
    setShowSuccess(true);
  };

  const handleEstimateOrder = async () => {
    if (cartItems.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const trimmedCustName = customer.name.trim() || 'Walk-in Customer';
    const trimmedMobile = customer.mobile ? customer.mobile.trim() : '';
    const trimmedReqNote = (requirementNote || '').trim() || 'Estimate only';

    const basicDiscountPercent = (discount.enabled && discount.type === 'percentage') ? Number(discount.value || 0) : 0;
    const basicDiscountAmt = discount.enabled ? (subtotal * Math.min(basicDiscountPercent, 100) / 100) : 0;
    const otherDiscountVal = discount.enabled ? Number(discount.otherValue || 0) : 0;
    const isOtherPercent = discount.otherType === 'percentage' || discount.otherType === 'percent';
    const otherDiscountAmt = discount.enabled ? (isOtherPercent ? (subtotal * Math.min(otherDiscountVal, 100) / 100) : otherDiscountVal) : 0;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    let orderNum = 'EST-' + String(Math.floor(Math.random() * 9000) + 1000);

    const estimatePayload = {
      customer_name: trimmedCustName,
      customer_mobile: trimmedMobile,
      address: customer.address || 'Chennai',
      postalcode: customer.postalcode || customer.pincode || '600001',
      items: cartItems.map(item => ({
        product_id: item.product_id ?? item.productId ?? item.id,
        quantity: Math.max(1, Number(item.quantity || 1)),
      })),
      tax_percentage: gst.enabled ? Number(gst.percentage || 18) : 0,
      basic_discount_percentage: basicDiscountPercent,
      other_discount_type: isOtherPercent ? 'percentage' : 'amount',
      other_discount_value: otherDiscountVal,
      payment_method: paymentMethod || 'cash',
      remark: trimmedReqNote,
      subtotal,
      originalSubtotal,
      payableAmount: grandTotal,
      coupon_code: discount?.selectedOfferName || discount?.code || '',
      coupon_discount: basicDiscountAmt + otherDiscountAmt,
      referral_code: referral?.applied ? (referral.code || '') : '',
      referral_customer_discount: referral?.applied ? Number(referral.customerDiscount || 0) : 0,
    };

    let serverShop = null;
    try {
      const response = await orderService.createEstimateOrder(estimatePayload);
      const serverOrderNo = response?.data?.order_no || response?.order_no || response?.data?.orderNumber || response?.orderNumber;
      if (serverOrderNo) {
        orderNum = serverOrderNo;
      }
      serverShop = response?.data?.shop_details || response?.shop_details || null;
    } catch (err) {
      console.warn('Estimate order API call error (continuing with local flow):', err);
    }

    const resolvedShop = serverShop || getShopDetails();

    const orderRecord = {
      orderNumber: orderNum,
      order_no: orderNum,
      date: dateStr,
      created_at: now.toISOString(),
      is_estimate: '1',
      isEstimate: true,
      order_type: 'offline',
      customer: { name: trimmedCustName, mobile: trimmedMobile, address: estimatePayload.address, postalcode: estimatePayload.postalcode },
      customer_name: trimmedCustName,
      customer_mobile: trimmedMobile,
      address: estimatePayload.address,
      postalcode: estimatePayload.postalcode,
      remark: trimmedReqNote,
      requirement_note: trimmedReqNote,
      requirementNote: trimmedReqNote,
      order_notes: trimmedReqNote,
      notes: trimmedReqNote,
      items: [...cartItems],
      subtotal,
      taxPercentage: gst.enabled ? Number(gst.percentage || 18) : 0,
      taxAmount: gst.enabled ? gstAmount : 0,
      gstAmount: gst.enabled ? gstAmount : 0,
      basicDiscountPercentage: basicDiscountPercent,
      basicDiscountAmount: basicDiscountAmt,
      otherDiscountType: isOtherPercent ? 'percentage' : 'amount',
      otherDiscountValue: otherDiscountVal,
      otherDiscountAmount: otherDiscountAmt,
      discountAmount: discountAmount || 0,
      grandTotal,
      payableAmount: grandTotal,
      payable_amount: grandTotal,
      paidAmount: grandTotal,
      balanceDue: 0,
      remainingAmount: 0,
      paymentStatus: 'paid',
      paymentType: 'full',
      paymentMethodRaw: paymentMethod || 'cash',
      payment_method: paymentMethod || 'cash',
      paymentMethod: paymentMethods.find(m => m.id === paymentMethod)?.label || 'Cash',
      shop_details: resolvedShop,
      shopDetails: resolvedShop,
    };

    try {
      const prev = JSON.parse(localStorage.getItem('billing_orders') || '[]');
      prev.unshift(orderRecord);
      localStorage.setItem('billing_orders', JSON.stringify(prev));
    } catch {}

    if (customer.name && customer.mobile) {
      saveCustomer({ name: customer.name, mobile: customer.mobile });
    }

    setOrderData(orderRecord);
    clearCart();
    removeReferral?.();
    setRequirementNote?.('');
    setCustomer({ name: '', mobile: '' });
    setIsProcessing(false);
    setShowSuccess(true);
  };

  const handlePaymentTypeChange = type => {
    setPaymentType(type);
    setCreditPaidAmount('');
    setUpiConfirmed(false);
  };

  const handleCustomerChange = (field, value) => {
    setCustomer({ ...customer, [field]: value });
  };

  const handleSuccessClose = () => {
    removeReferral?.();
    setRequirementNote?.('');
    setShowSuccess(false);
    onClose();
  };

  const showRemovalToast = removedItem => {
    window.clearTimeout(removalToastTimerRef.current);
    setRemovalToast({
      item: removedItem,
      message: `${removedItem.name} removed from order`,
    });
    removalToastTimerRef.current = window.setTimeout(() => setRemovalToast(null), 3200);
  };

  const undoRemoval = () => {
    if (!removalToast?.item) return;
    window.clearTimeout(removalToastTimerRef.current);
    addToCart(removalToast.item, removalToast.item.quantity);
    setRemovalToast(null);
  };

  return (
    <div className="checkout-modal-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="checkout-page checkout-page-popup" role="dialog" aria-modal="true" aria-label="Checkout" onMouseDown={event => event.stopPropagation()}>
      <header className="checkout-header">
        <div className="checkout-header-title">
          <ShoppingCart size={18} />
          <h2>Current Order</h2>
          {cartItems.length > 0 && (
            <span className="checkout-count" aria-label={`${cartItems.length} unique products`} title="Unique product count">
              <strong>{cartItems.length}</strong>
              <small>{cartItems.length === 1 ? 'Item' : 'Items'}</small>
            </span>
          )}
        </div>
        {cartItems.length > 0 && (
          <button className="checkout-clear clay-btn clay-btn-sm clay-btn-danger" onClick={() => setShowClear(true)}>
            <Trash2 size={14} /> Clear
          </button>
        )}
        <button className="checkout-back clay-btn clay-btn-sm" onClick={onClose} aria-label="Close current order">
          <X size={20} />
        </button>
      </header>

      <div className="checkout-content">
        {cartItems.length === 0 ? (
          <div className="empty-state checkout-empty">
            <ShoppingCart size={48} />
            <h3>No items in cart</h3>
            <p>Select a product to begin billing</p>
            <button className="clay-btn clay-btn-primary" onClick={onClose} style={{ marginTop: 16 }}>
              Back to Billing
            </button>
          </div>
        ) : (
          <>
            {/* Customer Details */}
            <section className="checkout-section">
              <h3 className="section-title">Customer Details</h3>
              <div className="customer-form">
                <div className="form-field" ref={mobileRef}>
                  <label className="field-label">
                    <Phone size={14} /> Mobile Number <span className="required">*</span>
                  </label>
                  <CustomerAutocomplete
                    field="mobile"
                    value={customer.mobile}
                    onChange={value => { handleCustomerChange('mobile', value.replace(/\D/g, '').slice(0, 10)); setClickErrors(p => ({ ...p, mobile: '' })); }}
                    onSelect={selectedCustomer => { setCustomer({ name: selectedCustomer.name, mobile: selectedCustomer.mobile }); setClickErrors({}); }}
                    inputProps={{ type: 'tel', className: `clay-input ${mobileError || clickErrors.mobile ? 'input-error' : ''}`, placeholder: 'Enter 10-digit mobile number', inputMode: 'numeric', maxLength: 10, 'aria-label': 'Customer mobile number' }}
                  />
                  {(mobileError || clickErrors.mobile) && <p className="error-text">{clickErrors.mobile || mobileError}</p>}
                </div>
                <div className="form-field" ref={nameRef}>
                  <label className="field-label">
                    <User size={14} /> Customer Name <span className="required">*</span>
                  </label>
                  <CustomerAutocomplete
                    field="name"
                    value={customer.name}
                    onChange={value => {
                      const sanitized = value.replace(/[^a-zA-Z\s.'-]/g, '').replace(/^\s+/, '');
                      handleCustomerChange('name', sanitized);
                      setClickErrors(p => ({ ...p, name: '' }));
                    }}
                    onSelect={selectedCustomer => { setCustomer({ name: selectedCustomer.name, mobile: selectedCustomer.mobile }); setClickErrors({}); }}
                    inputProps={{ type: 'text', className: `clay-input ${nameError || clickErrors.name ? 'input-error' : ''}`, placeholder: 'Enter customer name', maxLength: 50, 'aria-label': 'Customer name' }}
                  />
                  {(nameError || clickErrors.name) && <p className="error-text">{clickErrors.name || nameError}</p>}
                </div>
              </div>
            </section>

            {/* Order Items */}
            <section className="checkout-section">
              <h3 className="section-title">Order Items</h3>
              <div className="checkout-items">
                {cartItems.map(item => (
                  <CheckoutItem key={item.id} item={item} onRemoved={showRemovalToast} />
                ))}
              </div>
            </section>

            {/* Bill Summary */}
            <section className="checkout-section">
              <h3 className="section-title">Bill Summary</h3>
              <CheckoutAdjustments />
              <BillSummary />
            </section>

            {/* Payment Methods */}
            <section className="checkout-section">
              <h3 className="section-title">Payment Method <span className="required">*</span></h3>
              <div className="payment-grid checkout-payment-grid">
                {paymentMethods.map(({ id, label, icon: Icon }) => {
                  const isActive = paymentMethod === id;
                  return (
                    <button
                      key={id}
                      className={`payment-card clay-card ${isActive ? 'active' : ''}`}
                      onClick={() => { setPaymentMethod(id); if (id !== 'upi' && id !== 'qr') setUpiConfirmed(false); }}
                      aria-pressed={isActive}
                    >
                      <Icon size={24} />
                      <span className="payment-label-text">{label}</span>
                      {isActive && <Check size={16} className="payment-check" />}
                    </button>
                  );
                })}
              </div>

              <div className={`payment-type-block ${!paymentMethod ? 'is-disabled' : ''}`}>
                <span className="field-label">Payment Type <span className="required">*</span></span>
                <div className="payment-type-selector" role="group" aria-label="Payment type">
                  <button
                    type="button"
                    className={`payment-type-option ${paymentType === 'full' ? 'active' : ''}`}
                    onClick={() => handlePaymentTypeChange('full')}
                    aria-pressed={paymentType === 'full'}
                    disabled={!paymentMethod}
                  >
                    <Check size={14} /> Full Payment
                  </button>
                  <button
                    type="button"
                    className={`payment-type-option ${paymentType === 'credit' ? 'active credit-active' : ''}`}
                    onClick={() => handlePaymentTypeChange('credit')}
                    aria-pressed={paymentType === 'credit'}
                    disabled={!paymentMethod}
                  >
                    <ReceiptText size={14} /> Credit
                  </button>
                </div>
              </div>

              {isCredit && (
                <div className="credit-payment-detail">
                  <div className="credit-entry-panel">
                    <div className="credit-panel-title">
                      <span><BadgeIndianRupee size={16} /></span>
                      <div><strong>Credit Payment</strong><small>Enter the amount received now</small></div>
                    </div>
                    <label className="field-label" htmlFor="credit-paid-amount">Amount Paid Now</label>
                    <div className={`credit-input-wrap ${creditError ? 'has-error' : ''}`}>
                      <span aria-hidden="true">₹</span>
                      <input
                        id="credit-paid-amount"
                        type="number"
                        className="clay-input credit-amount-input"
                        placeholder="0.00"
                        min="0"
                        max={grandTotal}
                        step="0.01"
                        inputMode="decimal"
                        value={creditPaidAmount}
                        onChange={e => setCreditPaidAmount(e.target.value)}
                      />
                    </div>
                    <div className="credit-presets" role="group" aria-label="Quick paid amount">
                      {[25, 50, 75].map(percent => (
                        <button
                          key={percent}
                          type="button"
                          onClick={() => setCreditPaidAmount((grandTotal * percent / 100).toFixed(2))}
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                    {creditError && <p className="error-text">{creditError}</p>}
                  </div>
                  <div className="credit-calculation" aria-live="polite">
                    <div className="credit-progress-heading">
                      <span>Payment progress</span>
                      <strong>{Math.round(creditPaidPercentage)}%</strong>
                    </div>
                    <div className="credit-progress-track" aria-hidden="true">
                      <span style={{ width: `${creditPaidPercentage}%` }} />
                    </div>
                    <div className="credit-summary-grid">
                      <div><span>Total Amount</span><strong>{fmt(grandTotal)}</strong></div>
                      <div className="credit-paid-row"><span>Paid Now</span><strong>{fmt(creditPaid)}</strong></div>
                      <div className="credit-balance-row"><span>Balance Due</span><strong>{fmt(balanceDue)}</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Card Detail */}
              {paymentType === 'full' && paymentMethod === 'card' && (
                <div className="payment-detail" style={{ marginTop: 12 }}>
                  <p className="payment-info-text">Card payment selected. Swipe or tap the card on the terminal.</p>
                </div>
              )}

              {/* UPI / QR */}
              {paymentType && (paymentMethod === 'upi' || paymentMethod === 'qr') && (
                <div className="payment-detail upi-detail" style={{ marginTop: 12 }}>
                  <div className="qr-placeholder">
                    <QrCode size={64} />
                    <span className="qr-label">Scan to Pay</span>
                  </div>
                  <p className="upi-id">UPI ID: <strong>rsfireworks@upi</strong></p>
                  <p className="upi-amount">Amount: <strong>{fmt(isCredit ? creditPaid : grandTotal)}</strong></p>
                  <label className="clay-toggle upi-confirm">
                    <input type="checkbox" checked={upiConfirmed} onChange={e => setUpiConfirmed(e.target.checked)} />
                    <span className="track"><span className="thumb" /></span>
                    <span>Payment Confirmed</span>
                  </label>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Process & Estimate Buttons (Pinned at drawer bottom) */}
      {cartItems.length > 0 && (
        <div className="checkout-sticky-bottom checkout-actions-dual">
          <button
            type="button"
            className="clay-btn checkout-estimate-btn"
            onClick={handleEstimateOrder}
            disabled={cartItems.length === 0 || isProcessing}
            title="Generate Estimate Bill (Quotation) without reducing stock"
          >
            <FileSpreadsheet size={17} />
            <span>Estimate Bill</span>
          </button>
          <button
            className="clay-btn clay-btn-primary process-checkout-btn"
            onClick={handleProcessClick}
            disabled={!canProcess || isProcessing}
          >
            {isProcessing ? <LoaderCircle size={18} className="button-spinner" /> : <BadgeIndianRupee size={18} />}
            {isCredit
              ? `Process Credit - Paid ${fmt(creditPaid)} | Due ${fmt(balanceDue)}`
              : `Process Order - ${fmt(grandTotal)}`}
          </button>
        </div>
      )}

      {showClear && (
        <ConfirmModal
          title="Clear Order?"
          message="Are you sure you want to clear the current order?"
          onConfirm={handleClear}
          onCancel={() => setShowClear(false)}
          confirmText="Clear Order"
          danger
        />
      )}

      {showSuccess && orderData && (
        <SuccessModal
          orderData={orderData}
          onClose={handleSuccessClose}
        />
      )}
      {isProcessing && (
        <div className="bill-generation-loader" role="status" aria-live="polite">
          <div className="bill-generation-icon">
            <ReceiptText size={30} />
            <LoaderCircle size={20} className="bill-spinner" />
          </div>
          <strong>Generating Bill</strong>
          <span>Preparing your order summary...</span>
        </div>
      )}
      {removalToast && (
        <div className="checkout-remove-toast" role="status" aria-live="polite">
          <Check size={15} />
          <span>{removalToast.message}</span>
          <button type="button" onClick={undoRemoval}>Undo</button>
        </div>
      )}
    </div>
    </div>
  );
}

function CheckoutItem({ item, onRemoved }) {
  const { updateQuantity, removeFromCart, triggerStockError } = useCart();
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempQty, setTempQty] = useState('');
  const [itemError, setItemError] = useState('');
  const removeTimerRef = useRef(null);
  const dec = useLongPress(() => {
    if (item.quantity <= 1) { removeFromCart(item.id); return; }
    updateQuantity(item.id, item.quantity - 1);
  });
  const inc = useLongPress(() => updateQuantity(item.id, item.quantity + 1));

  useEffect(() => () => window.clearTimeout(removeTimerRef.current), []);

  const animateRemove = () => {
    if (isRemoving) return;
    setIsRemoving(true);
    removeTimerRef.current = window.setTimeout(() => {
      removeFromCart(item.id);
      onRemoved?.(item);
    }, 280);
  };

  const handleCommit = () => {
    setIsEditing(false);
    const parsed = parseInt(tempQty, 10);
    if (isNaN(parsed) || parsed <= 0) {
      setItemError('');
      removeFromCart(item.id);
    } else if (parsed > item.stock) {
      setItemError(`Max ${item.stock}!`);
      triggerStockError(`Only ${item.stock} items available in stock for ${item.name}!`);
      setTimeout(() => setItemError(''), 3000);
      updateQuantity(item.id, item.stock);
    } else {
      setItemError('');
      updateQuantity(item.id, parsed);
    }
  };

  return (
    <div className={`checkout-item clay-card ${isRemoving ? 'is-removing' : ''}`}>
      <div className="checkout-item-thumb">
        <img
          src={item.image}
          alt={item.name}
          onError={event => {
            if (item.fallbackImage && event.currentTarget.src !== item.fallbackImage) event.currentTarget.src = item.fallbackImage;
          }}
        />
      </div>
      <div className="checkout-item-info">
        <div className="checkout-item-copy">
          <div className="checkout-item-header">
            <span className="checkout-item-name">{item.name}</span>
            {(item.product_code || item.code) && (
              <span className="checkout-item-code">{item.product_code || item.code}</span>
            )}
          </div>
          <span className="checkout-item-package">{item.packageInfo}</span>
        </div>
        <div className="checkout-item-metric checkout-item-unit">
          <small>Unit Price</small>
          <strong>{fmt(item.discountedPrice)}</strong>
        </div>
        <div className="checkout-item-metric checkout-item-quantity" role="group" aria-label={`Quantity for ${item.name}`}>
          <small>Quantity</small>
          <div className="checkout-quantity-ctrls">
            <button type="button" onMouseDown={e => e.preventDefault()} {...dec} aria-label={`Decrease ${item.name} quantity`}>
              <Minus size={12} />
            </button>
            {isEditing ? (
              <input
                type="number"
                min="1"
                max={item.stock}
                className="qty-inline-input"
                value={tempQty}
                autoFocus
                onChange={e => setTempQty(e.target.value)}
                onBlur={handleCommit}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  else if (e.key === 'Escape') { setIsEditing(false); setTempQty(item.quantity); }
                }}
              />
            ) : (
              <strong
                className="qty-value"
                onClick={() => { setTempQty(item.quantity); setIsEditing(true); }}
                title="Click to edit quantity"
              >{item.quantity}</strong>
            )}
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              {...inc}
              disabled={item.quantity >= item.stock}
              aria-label={`Increase ${item.name} quantity`}
            >
              <Plus size={12} />
            </button>
          </div>
          {itemError && <span className="product-qty-error-badge">{itemError}</span>}
        </div>
        <div className="checkout-item-metric checkout-item-total">
          <small>Total</small>
          <strong>{fmt(item.discountedPrice * item.quantity)}</strong>
        </div>
        <div className="checkout-item-metric checkout-item-action">
          <small className="checkout-action-spacer" aria-hidden="true">&nbsp;</small>
          <button
            type="button"
            className="checkout-mobile-remove"
            onClick={animateRemove}
            disabled={isRemoving}
            aria-label={`Remove ${item.name} from order`}
            title={`Remove ${item.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutAdjustments() {
  const { gst, setGst, discount, setDiscount, referral, applyReferral, removeReferral, requirementNote, setRequirementNote, subtotal } = useCart();
  const [apiDiscounts, setApiDiscounts] = useState([]);
  const [referralInput, setReferralInput] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState('');

  useEffect(() => {
    if (!referral?.applied) {
      setReferralInput('');
      setReferralError('');
    }
  }, [referral?.applied]);

  const handleApplyReferral = async () => {
    const code = (referralInput || '').trim();
    if (!code) {
      setReferralError('Please enter a referral code');
      return;
    }
    setReferralLoading(true);
    setReferralError('');
    try {
      const res = await referralService.getReferralByCode(code);
      if (res && res.data) {
        applyReferral(res.data);
        setReferralInput('');
      } else {
        setReferralError('Invalid referral code.');
      }
    } catch (err) {
      setReferralError(err.message || 'Invalid referral code.');
    } finally {
      setReferralLoading(false);
    }
  };

  const handleRemoveReferral = () => {
    removeReferral();
    setReferralInput('');
    setReferralError('');
  };

  useEffect(() => {
    let isMounted = true;
    discountService.getDiscounts().then(list => {
      if (isMounted) setApiDiscounts(list);
    }).catch(err => {
      console.warn('Checkout discounts error:', err);
    });
    return () => { isMounted = false; };
  }, []);

  const updateBasicDiscount = value => {
    const normalized = Math.max(0, Math.min(100, Number(value) || 0));
    const otherValue = discount.otherValue || '';
    setDiscount({
      ...discount,
      enabled: normalized > 0 || Number(otherValue) > 0,
      type: 'percentage',
      value: normalized || '',
      otherValue,
    });
  };

  const updateOtherDiscount = value => {
    const otherType = discount.otherType || 'fixed';
    const maximum = otherType === 'percentage' ? 100 : subtotal;
    const normalized = Math.max(0, Math.min(maximum, Number(value) || 0));
    const basicValue = discount.value || '';
    setDiscount({
      ...discount,
      enabled: normalized > 0 || Number(basicValue) > 0,
      type: 'percentage',
      value: basicValue,
      otherMode: 'manual',
      otherType,
      otherValue: normalized || '',
      selectedOfferId: null,
      selectedOfferName: '',
    });
  };

  const updateOtherDiscountType = otherType => {
    const maximum = otherType === 'percentage' ? 100 : subtotal;
    const normalizedValue = Math.min(maximum, Number(discount.otherValue) || 0);
    setDiscount({
      ...discount,
      otherMode: 'manual',
      otherType,
      otherValue: normalizedValue || '',
      selectedOfferId: null,
      selectedOfferName: '',
    });
  };

  const handleDiscountModeChange = mode => {
    if (mode === 'manual') {
      setDiscount({
        ...discount,
        otherMode: 'manual',
        selectedOfferId: null,
        selectedOfferName: '',
      });
    } else {
      setDiscount({
        ...discount,
        otherMode: 'api',
      });
    }
  };

  const handleSelectApiOffer = offerIdStr => {
    const basicValue = discount.value || '';
    if (!offerIdStr) {
      setDiscount({
        ...discount,
        enabled: Number(basicValue) > 0,
        otherValue: '',
        selectedOfferId: null,
        selectedOfferName: '',
      });
      return;
    }
    const offer = apiDiscounts.find(item => String(item.id) === String(offerIdStr));
    if (offer) {
      setDiscount({
        ...discount,
        enabled: true,
        otherMode: 'api',
        otherType: offer.type,
        otherValue: offer.value,
        selectedOfferId: offer.id,
        selectedOfferName: offer.name,
      });
    }
  };

  return (
    <div className="checkout-adjustments">
      <label className="checkout-adjustment-row checkout-gst-row">
        <span>
          <input
            type="checkbox"
            checked={gst.enabled}
            onChange={event => setGst({ ...gst, enabled: event.target.checked, percentage: 18 })}
          />
          Tax (GST)
        </span>
        <strong>18%</strong>
      </label>

      <label className="checkout-adjustment-row" htmlFor="checkout-basic-discount">
        <span>Basic Discount</span>
        <span className="checkout-adjustment-input">
          <input
            id="checkout-basic-discount"
            type="number"
            min="0"
            max="100"
            inputMode="decimal"
            value={discount.value || ''}
            placeholder="0"
            onChange={event => updateBasicDiscount(event.target.value)}
          />
          <small>%</small>
        </span>
      </label>

      <div className="checkout-adjustment-row checkout-other-discount-block summary-row-discount-container">
        <div className="other-discount-header-row">
          <label htmlFor="checkout-other-discount">Other Discount</label>
          <div className="discount-mode-tabs" role="tablist" aria-label="Discount Mode">
            <button
              type="button"
              className={`discount-mode-btn ${(discount.otherMode || 'manual') === 'manual' ? 'active' : ''}`}
              onClick={() => handleDiscountModeChange('manual')}
            >
              Manual
            </button>
            <button
              type="button"
              className={`discount-mode-btn ${discount.otherMode === 'api' ? 'active' : ''}`}
              onClick={() => handleDiscountModeChange('api')}
            >
              Offers
            </button>
          </div>
        </div>

        <div className="other-discount-body-row">
          {discount.otherMode === 'api' ? (
            <div className="api-offer-control-full">
              <select
                id="checkout-other-discount-select"
                className="api-discount-select-full"
                value={discount.selectedOfferId || ''}
                onChange={e => handleSelectApiOffer(e.target.value)}
              >
                <option value="">-- Select Offer --</option>
                {apiDiscounts.map(offer => (
                  <option key={offer.id} value={offer.id}>
                    {offer.name} ({offer.value}{offer.type === 'percentage' ? '%' : '₹'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="other-discount-manual-full">
              <div className="discount-type-toggle" role="group" aria-label="Other discount type">
                <button
                  type="button"
                  className={`discount-toggle-btn ${(discount.otherType || 'fixed') === 'fixed' ? 'active' : ''}`}
                  onClick={() => updateOtherDiscountType('fixed')}
                >
                  ₹
                </button>
                <button
                  type="button"
                  className={`discount-toggle-btn ${discount.otherType === 'percentage' ? 'active' : ''}`}
                  onClick={() => updateOtherDiscountType('percentage')}
                >
                  %
                </button>
              </div>
              <div className="other-discount-input-box">
                {(discount.otherType || 'fixed') === 'fixed' && <span>₹</span>}
                <input
                  id="checkout-other-discount"
                  type="number"
                  min="0"
                  max={(discount.otherType || 'fixed') === 'percentage' ? 100 : subtotal}
                  inputMode="decimal"
                  value={discount.otherValue || ''}
                  placeholder="0"
                  onChange={event => updateOtherDiscount(event.target.value)}
                />
                {discount.otherType === 'percentage' && <small>%</small>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Referral Code Row */}
      <div className="checkout-adjustment-row checkout-referral-row summary-referral-container">
        {!referral?.applied ? (
          <div className="referral-input-container">
            <div className="referral-input-wrapper">
              <Tag size={13} className="referral-icon" />
              <input
                type="text"
                className="referral-code-input"
                placeholder="Enter referral code"
                value={referralInput}
                onChange={e => { setReferralInput(e.target.value.toUpperCase()); setReferralError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyReferral(); } }}
                disabled={referralLoading}
              />
              <button
                type="button"
                className="referral-apply-btn"
                onClick={handleApplyReferral}
                disabled={referralLoading || !referralInput.trim()}
              >
                {referralLoading ? <LoaderCircle size={13} className="spin-icon" /> : 'Apply'}
              </button>
            </div>
            {referralError && <div className="referral-error-text">{referralError}</div>}
          </div>
        ) : (
          <div className="referral-applied-card">
            <div className="referral-applied-info">
              <div className="referral-badge-title">
                <Check size={13} className="referral-check-icon" />
                <strong>{referral.code}</strong>
                <span className="referral-discount-pill">{referral.customerDiscount}% OFF</span>
              </div>
              {referral.name && <span className="referral-partner-name">{referral.name}</span>}
            </div>
            <button
              type="button"
              className="referral-remove-btn"
              onClick={handleRemoveReferral}
              title="Remove referral code"
              aria-label="Remove referral code"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Requirement Note Row */}
      <div className="checkout-adjustment-row checkout-note-row summary-note-container">
        <div className="note-input-wrapper">
          <label htmlFor="checkout-requirement-note" className="note-input-label">
            <FileText size={12} className="note-icon" />
            <span>Requirement Note</span>
          </label>
          <textarea
            id="checkout-requirement-note"
            className="order-requirement-note-input"
            placeholder="Special requirement / note (will print on bill)..."
            rows={2}
            value={requirementNote || ''}
            onChange={e => setRequirementNote(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
