import React from 'react';
import { Check, ShoppingCart, Trash2, Zap, Tag, LoaderCircle, X, FileText, FileSpreadsheet } from 'lucide-react';
import { useCart, fmt } from '../context/CartContext';
import { discountService, referralService } from '../services';
import CartItem from './CartItem';
import EstimateBillingModal from './EstimateBillingModal';
import SuccessModal from './SuccessModal';

export default function CurrentOrderPanel({ onCheckout, onViewProduct }) {
  const {
    cartItems, addToCart, clearCart,
    setCustomer,
    setDiscount, setGst, gst, discount,
    referral, applyReferral, removeReferral, referralDiscountAmount,
    requirementNote, setRequirementNote,
    grandTotal, subtotal, originalSubtotal, gstAmount, discountAmount,
  } = useCart();
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [showEstimateModal, setShowEstimateModal] = React.useState(false);
  const [estimateSuccessData, setEstimateSuccessData] = React.useState(null);
  const [removalToast, setRemovalToast] = React.useState(null);
  const [apiDiscounts, setApiDiscounts] = React.useState([]);
  const [referralInput, setReferralInput] = React.useState('');
  const [referralLoading, setReferralLoading] = React.useState(false);
  const [referralError, setReferralError] = React.useState('');
  const removalToastTimerRef = React.useRef(null);

  React.useEffect(() => {
    if (!referral?.applied) {
      setReferralInput('');
      setReferralError('');
    }
  }, [referral?.applied]);

  React.useEffect(() => () => window.clearTimeout(removalToastTimerRef.current), []);

  React.useEffect(() => {
    let isMounted = true;
    discountService.getDiscounts().then(list => {
      if (isMounted) {
        setApiDiscounts(list);
      }
    }).catch(err => {
      console.warn('Failed to load discounts:', err);
    });
    return () => { isMounted = false; };
  }, []);

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

  const handleProcessClick = () => {
    onCheckout();
  };

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

    return (
      <aside className="order-panel">
        <div className="order-panel-inner">
          <div className="order-panel-header">
            <div className="order-title">
              <span className="order-title-icon"><ShoppingCart size={20} /></span>
              <h2>Current Order</h2>
            </div>
            <div className="order-header-actions">
              {cartItems.length > 0 && (
                <span className="order-count" aria-label={`${cartItems.length} unique products`} title="Unique product count">
                  <strong>{cartItems.length}</strong>
                <small>{cartItems.length === 1 ? 'Item' : 'Items'}</small>
              </span>
            )}
            <button
              className="clear-order-btn"
              onClick={() => setShowClearConfirm(true)}
              disabled={cartItems.length === 0}
            >
              Clear
            </button>
          </div>
        </div>


        <div className="order-table-head" aria-hidden="true">
          <span>Image</span>
          <span>Product Name</span>
          <span>Unit Price</span>
          <span>Total Price</span>
          <span>Qty</span>
          <span>Remove</span>
        </div>

        <div className="order-items-scroll">
          {cartItems.length === 0 ? (
            <div className="order-empty">
              <ShoppingCart size={30} />
              <strong>No items in cart</strong>
              <span>Add products to start an order</span>
            </div>
          ) : (
            cartItems.map(item => (
              <CartItem
                key={item.id}
                item={item}
                compact
                onViewProduct={onViewProduct}
                onRemoved={showRemovalToast}
              />
            ))
          )}
        </div>

        <div className="order-summary">
          <div className="summary-row">
            <span>Subtotal</span>
            <strong className="subtotal-prices">
              <del title="Original price total">{fmt(originalSubtotal)}</del>
              <span title="Offer price total">{fmt(subtotal)}</span>
            </strong>
          </div>
          <div className="summary-row tax-summary-row">
            <label className="summary-check">
              <input
                type="checkbox"
                checked={gst.enabled}
                onChange={event => setGst({ ...gst, enabled: event.target.checked, percentage: 18 })}
              />
              <span>Tax (GST)</span>
              <small>18%</small>
            </label>
            <strong>{fmt(gstAmount)}</strong>
          </div>
          <div className="summary-row">
            <label htmlFor="order-discount">Basic Discount</label>
            <div className="discount-percentage">
              <input
                id="order-discount"
                type="number"
                min="0"
                max="100"
                value={discount.enabled ? discount.value : ''}
                placeholder="0"
                onChange={event => updateBasicDiscount(event.target.value)}
              />
              <span>%</span>
            </div>
          </div>
          <div className="summary-row summary-row-discount-container">
            <div className="other-discount-header-row">
              <label htmlFor="other-discount">Other Discount</label>
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
                    id="other-discount-select"
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
                      id="other-discount"
                      type="number"
                      min="0"
                      max={(discount.otherType || 'fixed') === 'percentage' ? 100 : subtotal}
                      value={discount.otherValue || ''}
                      placeholder="0"
                      onChange={event => updateOtherDiscount(event.target.value)}
                    />
                    {discount.otherType === 'percentage' && <span>%</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Referral Code Row */}
          <div className="summary-row summary-referral-container">
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

          {referral?.applied && referralDiscountAmount > 0 && (
            <div className="summary-row discount-deduction referral-discount-deduction">
              <span>Referral Discount ({referral.customerDiscount}%)</span>
              <strong>-{fmt(referralDiscountAmount)}</strong>
            </div>
          )}

          {discountAmount > 0 && (discountAmount - (referralDiscountAmount || 0)) > 0 && (
            <div className="summary-row discount-deduction">
              <span>{referral?.applied && referralDiscountAmount > 0 ? 'Other Discount' : 'Discount'}</span>
              <strong>-{fmt(discountAmount - (referralDiscountAmount || 0))}</strong>
            </div>
          )}

          {/* Requirement Note */}
          <div className="summary-row summary-note-container">
            <div className="note-input-wrapper">
              <label htmlFor="order-requirement-note" className="note-input-label">
                <FileText size={12} className="note-icon" />
                <span>Requirement Note</span>
              </label>
              <textarea
                id="order-requirement-note"
                className="order-requirement-note-input"
                placeholder="Special requirement / note (will print on bill)..."
                rows={2}
                value={requirementNote || ''}
                onChange={e => setRequirementNote(e.target.value)}
              />
            </div>
          </div>

          <div className="summary-divider" />
          <div className="summary-row grand-total">
            <span>Payable Amount</span>
            <strong>{fmt(grandTotal)}</strong>
          </div>
        </div>

        <div className="order-actions-container">
          <button
            type="button"
            className="estimate-bill-btn"
            onClick={() => setShowEstimateModal(true)}
            disabled={cartItems.length === 0}
            title="Create and apply Estimate Billing (Quotation)"
          >
            <FileSpreadsheet size={16} />
            <span>Estimate Bill</span>
          </button>
          <button className="process-btn" onClick={handleProcessClick} disabled={cartItems.length === 0}>
            <Zap size={18} />
            <span>Process Order ({fmt(grandTotal)})</span>
          </button>
        </div>
      </div>

      <EstimateBillingModal
        isOpen={showEstimateModal}
        onClose={() => setShowEstimateModal(false)}
        onSuccess={(est) => setEstimateSuccessData(est)}
      />

      {estimateSuccessData && (
        <SuccessModal
          orderData={estimateSuccessData}
          onClose={() => setEstimateSuccessData(null)}
        />
      )}

      {showClearConfirm && (
        <div className="modal-overlay confirm-modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="confirm-modal clay-card" onClick={event => event.stopPropagation()}>
            <Trash2 size={26} className="confirm-icon" />
            <h3>Clear Order?</h3>
            <p>Are you sure you want to clear the current order?</p>
            <div className="confirm-actions">
              <button className="clay-btn" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="clay-btn clay-btn-danger" onClick={() => { clearCart(); removeReferral?.(); setRequirementNote?.(''); setCustomer?.({ name: '', mobile: '' }); setShowClearConfirm(false); }}>Clear Order</button>
            </div>
          </div>
        </div>
      )}
      {removalToast && (
        <div className="order-remove-toast" role="status" aria-live="polite">
          <Check size={15} />
          <span>{removalToast.message}</span>
          <button type="button" onClick={undoRemoval}>Undo</button>
        </div>
      )}
    </aside>
  );
}
