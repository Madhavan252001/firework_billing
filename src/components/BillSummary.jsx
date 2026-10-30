import React from 'react';
import { useCart, fmt } from '../context/CartContext';

export default function BillSummary({ compact }) {
  const { subtotal, originalSubtotal, gst, gstAmount, discount, referral, referralDiscountAmount, discountAmount, grandTotal } = useCart();
  const basicValue = Math.max(0, Number(discount.value) || 0);
  const basicDiscountAmount = discount.type === 'percentage'
    ? subtotal * Math.min(basicValue, 100) / 100
    : Math.min(basicValue, subtotal);
  const otherValue = Math.max(0, Number(discount.otherValue) || 0);
  const otherDiscountAmount = discount.otherType === 'percentage'
    ? subtotal * Math.min(otherValue, 100) / 100
    : Math.min(otherValue, subtotal);
  return (
    <div className={`bill-summary clay-card ${compact ? 'bill-summary-compact' : ''}`}>
      <div className="summary-row">
        <span>Subtotal</span>
        <strong className="subtotal-prices">
          <del title="Original price total">{fmt(originalSubtotal)}</del>
          <span title="Offer price total">{fmt(subtotal)}</span>
        </strong>
      </div>
      {gst.enabled && (
        <div className="summary-row">
          <span>Tax (GST) ({gst.percentage === 'custom' ? 'Custom' : `${gst.percentage}%`})</span>
          <span>{fmt(gstAmount)}</span>
        </div>
      )}
      {discount.enabled && basicValue > 0 && (
        <div className="summary-row discount-row">
          <span>Basic Discount {discount.type === 'percentage' ? `(${basicValue}%)` : '(Rs)'}</span>
          <span>-{fmt(basicDiscountAmount)}</span>
        </div>
      )}
      {discount.enabled && otherValue > 0 && (
        <div className="summary-row discount-row">
          <span>
            Other Discount{' '}
            {discount.selectedOfferName
              ? `(${discount.selectedOfferName})`
              : discount.otherType === 'percentage'
              ? `(${otherValue}%)`
              : '(Rs)'}
          </span>
          <span>-{fmt(otherDiscountAmount)}</span>
        </div>
      )}
      {referral?.applied && referralDiscountAmount > 0 && (
        <div className="summary-row discount-row referral-discount-row">
          <span>
            Referral Discount ({referral.code} - {referral.customerDiscount}%)
          </span>
          <span>-{fmt(referralDiscountAmount)}</span>
        </div>
      )}
      {discountAmount > 0 && (
        <div className="summary-row total-discount-row">
          <span>Total Discount</span>
          <strong>-{fmt(discountAmount)}</strong>
        </div>
      )}
      <div className="summary-divider" />
      <div className="summary-row grand-total">
        <span>Payable Amount</span>
        <span className="grand-amount">{fmt(grandTotal)}</span>
      </div>
    </div>
  );
}
