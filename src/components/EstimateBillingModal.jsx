import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, User, Phone, MapPin, ReceiptText, LoaderCircle } from 'lucide-react';
import { useCart, fmt } from '../context/CartContext';
import { orderService, getShopDetails } from '../services';

export default function EstimateBillingModal({ isOpen, onClose, onSuccess }) {
  const {
    cartItems, customer, setCustomer,
    subtotal, originalSubtotal, gst, gstAmount, discount, discountAmount, grandTotal,
    referral,
    requirementNote, setRequirementNote, clearCart, removeReferral,
  } = useCart();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('Chennai');
  const [postalcode, setPostalcode] = useState('600001');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [remark, setRemark] = useState('');
  const [keepCart, setKeepCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(customer?.name?.trim() || 'Walk-in Customer');
      setMobile(customer?.mobile?.trim() || '');
      setAddress(customer?.address?.trim() || 'Chennai');
      setPostalcode(customer?.postalcode?.trim() || customer?.pincode?.trim() || '600001');
      setPaymentMethod('cash');
      setRemark(requirementNote?.trim() || 'Estimate only');
      setError('');
      setLoading(false);
    }
  }, [isOpen, customer, requirementNote]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const totalQuantity = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter customer name');
      return;
    }
    if (mobile.trim() && !/^[0-9]{10}$/.test(mobile.trim())) {
      setError('Please enter a valid 10-digit mobile number or leave blank');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const basicDiscountPercent = (discount.enabled && discount.type === 'percentage') ? Number(discount.value || 0) : 0;
      const otherDiscountVal = discount.enabled ? Number(discount.otherValue || 0) : 0;
      const isOtherPercent = discount.otherType === 'percentage' || discount.otherType === 'percent';

      const payload = {
        customer_name: trimmedName,
        customer_mobile: mobile.trim(),
        address: address.trim() || 'Chennai',
        postalcode: postalcode.trim() || '600001',
        items: cartItems.map(item => ({
          product_id: item.product_id ?? item.productId ?? item.id,
          quantity: Math.max(1, Number(item.quantity || 1)),
        })),
        tax_percentage: gst.enabled ? Number(gst.percentage || 18) : 0,
        basic_discount_percentage: basicDiscountPercent,
        other_discount_type: isOtherPercent ? 'percentage' : 'amount',
        other_discount_value: otherDiscountVal,
        payment_method: paymentMethod || 'cash',
        remark: remark.trim() || 'Estimate only',
        subtotal,
        payableAmount: grandTotal,
        coupon_code: discount?.selectedOfferName || discount?.code || '',
        referral_code: referral?.applied ? (referral.code || '') : '',
        referral_customer_discount: referral?.applied ? Number(referral.customerDiscount || 0) : 0,
      };

      const response = await orderService.createEstimateOrder(payload);
      const serverData = response?.data || response;
      const orderNo = serverData?.order_no || serverData?.orderNumber || `EST-${Date.now()}`;
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      const resolvedShop = serverData?.shop_details || getShopDetails();

      const estimateRecord = {
        ...serverData,
        id: serverData?.id || Date.now(),
        orderNumber: orderNo,
        order_no: orderNo,
        date: dateStr,
        created_at: serverData?.created_at || now.toISOString(),
        is_estimate: '1',
        isEstimate: true,
        order_type: 'offline',
        customer: {
          name: trimmedName,
          mobile: mobile.trim(),
          address: address.trim() || 'Chennai',
          postalcode: postalcode.trim() || '600001',
        },
        customer_name: trimmedName,
        customer_mobile: mobile.trim(),
        address: address.trim() || 'Chennai',
        postalcode: postalcode.trim() || '600001',
        items: [...cartItems],
        subtotal,
        originalSubtotal,
        taxPercentage: gst.enabled ? Number(gst.percentage || 18) : 0,
        tax_percentage: gst.enabled ? Number(gst.percentage || 18) : 0,
        gstAmount,
        tax_amount: gstAmount,
        basicDiscountPercentage: basicDiscountPercent,
        basicDiscountAmount: Number(serverData?.basic_discount_amount || (subtotal * basicDiscountPercent / 100)),
        otherDiscountType: isOtherPercent ? 'percentage' : 'amount',
        otherDiscountValue: otherDiscountVal,
        discountAmount,
        grandTotal,
        payableAmount: grandTotal,
        paidAmount: grandTotal,
        remainingAmount: 0,
        paymentStatus: 'paid',
        paymentMethod: paymentMethod === 'upi' ? 'UPI' : paymentMethod === 'card' ? 'Card' : 'Cash',
        payment_method: paymentMethod,
        paymentType: 'full',
        remark: remark.trim() || 'Estimate only',
        requirement_note: remark.trim() || 'Estimate only',
        requirementNote: remark.trim() || 'Estimate only',
        notes: remark.trim() || 'Estimate only',
        order_notes: remark.trim() || 'Estimate only',
        shop_details: resolvedShop,
        shopDetails: resolvedShop,
      };

      // Save to localStorage history so it can be viewed and printed anytime
      try {
        const prev = JSON.parse(localStorage.getItem('billing_orders') || '[]');
        const exists = prev.some(o => o.orderNumber === orderNo);
        if (!exists) {
          prev.unshift(estimateRecord);
          localStorage.setItem('billing_orders', JSON.stringify(prev));
        }
      } catch (storageErr) {
        console.warn('Failed to save estimate to local billing_orders:', storageErr);
      }

      if (!keepCart) {
        clearCart();
        removeReferral?.();
        setRequirementNote?.('');
        setCustomer?.({ name: '', mobile: '' });
      }

      onClose();
      if (onSuccess) {
        onSuccess(estimateRecord);
      }
    } catch (err) {
      console.error('Failed to create estimate:', err);
      setError(err?.message || 'Failed to create estimate billing. Please check network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay estimate-modal-overlay" onClick={() => !loading && onClose()}>
      <div className="estimate-modal clay-card" onClick={e => e.stopPropagation()}>
        <div className="estimate-modal-header">
          <div className="estimate-header-icon-wrap">
            <FileSpreadsheet size={22} className="estimate-header-icon" />
          </div>
          <div className="estimate-header-text">
            <h3>Estimate Billing (Quotation)</h3>
            <p>Generate an official price estimate without deducting store stock</p>
          </div>
          <button
            type="button"
            className="estimate-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="estimate-modal-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="estimate-modal-body">
          <div className="estimate-form-grid">
            <div className="estimate-field-group">
              <label htmlFor="estimate-customer-name">
                <User size={14} />
                <span>Customer Name</span>
              </label>
              <input
                id="estimate-customer-name"
                type="text"
                className="estimate-input"
                placeholder="Walk-in Customer"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                autoFocus
              />
            </div>

            <div className="estimate-field-group">
              <label htmlFor="estimate-customer-mobile">
                <Phone size={14} />
                <span>Customer Mobile (Optional)</span>
              </label>
              <input
                id="estimate-customer-mobile"
                type="tel"
                maxLength={10}
                className="estimate-input"
                placeholder="9876543210"
                value={mobile}
                onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
              />
            </div>

            <div className="estimate-field-group">
              <label htmlFor="estimate-address">
                <MapPin size={14} />
                <span>Address</span>
              </label>
              <input
                id="estimate-address"
                type="text"
                className="estimate-input"
                placeholder="Chennai"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="estimate-field-group">
              <label htmlFor="estimate-postalcode">
                <span>Postal Code</span>
              </label>
              <input
                id="estimate-postalcode"
                type="text"
                maxLength={6}
                className="estimate-input"
                placeholder="600001"
                value={postalcode}
                onChange={e => setPostalcode(e.target.value)}
              />
            </div>
          </div>

          <div className="estimate-field-group full-width">
            <label htmlFor="estimate-remark">
              <ReceiptText size={14} />
              <span>Remark / Requirement Note</span>
            </label>
            <textarea
              id="estimate-remark"
              rows={2}
              className="estimate-textarea"
              placeholder="e.g. Estimate only, valid for 7 days..."
              value={remark}
              onChange={e => setRemark(e.target.value)}
            />
          </div>

          {/* Cart Breakdown preview */}
          <div className="estimate-summary-card">
            <div className="estimate-summary-row">
              <span>Items in Estimate</span>
              <strong>{cartItems.length} Products ({totalQuantity} units)</strong>
            </div>
            <div className="estimate-summary-row">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="estimate-summary-row estimate-discount-row">
                <span>Discount Applied</span>
                <span>-{fmt(discountAmount)}</span>
              </div>
            )}
            {gst.enabled && (
              <div className="estimate-summary-row">
                <span>GST ({gst.percentage}%)</span>
                <span>{fmt(gstAmount)}</span>
              </div>
            )}
            <div className="estimate-summary-divider" />
            <div className="estimate-summary-row estimate-total-row">
              <span>Estimated Payable Amount</span>
              <strong className="estimate-total-amount">{fmt(grandTotal)}</strong>
            </div>
          </div>

          <div className="estimate-checkbox-row">
            <label className="estimate-keep-cart-label">
              <input
                type="checkbox"
                checked={keepCart}
                onChange={e => setKeepCart(e.target.checked)}
              />
              <span>Keep products in cart after generating estimate</span>
            </label>
          </div>

          <div className="estimate-modal-actions">
            <button
              type="button"
              className="clay-btn estimate-cancel-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="clay-btn clay-btn-primary estimate-apply-btn"
              disabled={loading || cartItems.length === 0}
            >
              {loading ? (
                <>
                  <LoaderCircle size={16} className="spin-icon" />
                  <span>Generating Estimate...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  <span>Apply & Generate Estimate ({fmt(grandTotal)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
