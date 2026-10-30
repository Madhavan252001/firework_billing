import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmText, cancelText, danger }) {
  React.useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onCancel(); };

  return (
    <div className="modal-overlay confirm-modal-overlay" onClick={handleBackdrop}>
      <div className="confirm-modal clay-card" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon"><AlertTriangle size={32} /></div>
        <h3>{title || 'Confirm'}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="clay-btn" onClick={onCancel}>{cancelText || 'Cancel'}</button>
          <button className={`clay-btn ${danger ? 'clay-btn-danger' : 'clay-btn-primary'}`} onClick={onConfirm}>{confirmText || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
