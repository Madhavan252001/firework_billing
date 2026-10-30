import React from 'react';
import { Eye, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart, fmt } from '../context/CartContext';
import useLongPress from '../hooks/useLongPress';

export default function CartItem({ item, compact, onViewProduct, onRemoved }) {
  const { updateQuantity, removeFromCart, triggerStockError } = useCart();
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempQty, setTempQty] = React.useState('');
  const [itemError, setItemError] = React.useState('');
  const removeTimerRef = React.useRef(null);
  const dec = useLongPress(() => updateQuantity(item.id, item.quantity - 1));
  const inc = useLongPress(() => updateQuantity(item.id, item.quantity + 1));

  React.useEffect(() => () => window.clearTimeout(removeTimerRef.current), []);

  const animateRemove = () => {
    if (isRemoving) return;
    setIsRemoving(true);
    removeTimerRef.current = window.setTimeout(() => {
      removeFromCart(item.id);
      onRemoved?.(item);
    }, 280);
  };

  const handleCommitQuantity = () => {
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

  if (compact) {
    return (
      <div className={`cart-item cart-item-compact ${isRemoving ? 'is-removing' : ''}`}>
        <div className="cart-item-thumb">
          <img
            src={item.image}
            alt=""
            onError={event => {
              if (item.fallbackImage && event.currentTarget.src !== item.fallbackImage) event.currentTarget.src = item.fallbackImage;
            }}
          />
          {onViewProduct && (
            <button
              type="button"
              className="cart-item-view-btn"
              onClick={() => onViewProduct(item)}
              aria-label={`View ${item.name} in product list`}
              title="View product"
            >
              <Eye size={12} />
            </button>
          )}
        </div>
        <div className="cart-item-info">
          <span className="cart-item-name" title={item.name}>{item.name}</span>
        </div>
        <span className="cart-item-unit">{fmt(item.discountedPrice)}</span>
        <span className="cart-item-total">{fmt(item.discountedPrice * item.quantity)}</span>
        <div className="cart-qty">
          <button onMouseDown={e => e.preventDefault()} {...dec} disabled={item.quantity <= 1} aria-label="Decrease quantity"><Minus size={11} /></button>
          {isEditing ? (
            <input
              type="number"
              min="1"
              max={item.stock}
              className="qty-inline-input"
              value={tempQty}
              autoFocus
              onChange={e => setTempQty(e.target.value)}
              onBlur={handleCommitQuantity}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur();
                else if (e.key === 'Escape') { setIsEditing(false); setTempQty(item.quantity); }
              }}
            />
          ) : (
            <span
              className="qty-value"
              onClick={() => { setTempQty(item.quantity); setIsEditing(true); }}
              title="Click to edit quantity"
            >{item.quantity}</span>
          )}
          <button onMouseDown={e => e.preventDefault()} {...inc} disabled={item.quantity >= item.stock} aria-label="Increase quantity"><Plus size={11} /></button>
        </div>
        <button
          className="cart-remove-btn"
          onClick={animateRemove}
          disabled={isRemoving}
          aria-label={`Remove ${item.name}`}
          title="Remove item"
        ><Trash2 size={14} /></button>
      </div>
    );
  }

  return (
    <div className={`cart-item ${isRemoving ? 'is-removing' : ''}`}>
      <div className="cart-item-thumb">
        <img
          src={item.image}
          alt={item.name}
          onError={event => {
            if (item.fallbackImage && event.currentTarget.src !== item.fallbackImage) event.currentTarget.src = item.fallbackImage;
          }}
        />
      </div>
      <div className="cart-item-info">
        <div className="cart-item-header">
          <span className="cart-item-name">{item.name}</span>
          {(item.product_code || item.code) && (
            <span className="cart-item-code">{item.product_code || item.code}</span>
          )}
        </div>
        <div className="cart-item-details">
          <span className="cart-item-unit">{fmt(item.discountedPrice)}</span>
          <div className="cart-qty">
            <button className="qty-btn-sm" onMouseDown={e => e.preventDefault()} {...dec} disabled={item.quantity <= 1}><Minus size={12} /></button>
            {isEditing ? (
              <input
                type="number"
                min="1"
                max={item.stock}
                className="qty-inline-input"
                value={tempQty}
                autoFocus
                onChange={e => setTempQty(e.target.value)}
                onBlur={handleCommitQuantity}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  else if (e.key === 'Escape') { setIsEditing(false); setTempQty(item.quantity); }
                }}
              />
            ) : (
              <span
                className="qty-val qty-value"
                onClick={() => { setTempQty(item.quantity); setIsEditing(true); }}
                title="Click to edit quantity"
              >{item.quantity}</span>
            )}
            <button className="qty-btn-sm" onMouseDown={e => e.preventDefault()} {...inc} disabled={item.quantity >= item.stock}><Plus size={12} /></button>
          </div>
          {itemError && <span className="product-qty-error-badge">{itemError}</span>}
          <span className="cart-item-total">{fmt(item.discountedPrice * item.quantity)}</span>
          <button className="cart-remove-btn" onClick={animateRemove} disabled={isRemoving} aria-label="Remove item"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}
