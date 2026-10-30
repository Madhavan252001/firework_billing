import React from 'react';
import { Banknote, CreditCard, Smartphone, QrCode, Check } from 'lucide-react';

const methods = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'upi', label: 'GPay / UPI', icon: Smartphone },
  { id: 'qr', label: 'QR Code', icon: QrCode },
];

export default function PaymentMethods({ compact, selected, onSelect }) {
  const visibleMethods = compact
    ? [methods[0], methods[1], { id: 'upi', label: 'UPI/QR', icon: QrCode }]
    : methods;

  return (
    <div className={`payment-methods ${compact ? 'payment-methods-compact' : ''}`}>
      {!compact && <h4 className="payment-label">Payment Method</h4>}
      <div className="payment-grid">
        {visibleMethods.map(({ id, label, icon: Icon }) => {
          const isActive = selected === id;
          return (
            <button
              key={id}
              className={`payment-card clay-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelect && onSelect(id)}
              aria-pressed={isActive}
            >
              <Icon size={compact ? 20 : 24} />
              <span className="payment-label-text">{label}</span>
              {isActive && <Check size={16} className="payment-check" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
