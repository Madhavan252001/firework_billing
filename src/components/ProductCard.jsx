import React, { useState } from 'react';
import { Flame, Minus, Package, PackagePlus, PartyPopper, Plus, Sparkles, Star, Sun, Zap } from 'lucide-react';
import { useCart, fmt } from '../context/CartContext';
import useLongPress from '../hooks/useLongPress';

export default function ProductCard({ product, highlighted, availableStock = (product.stock_count !== undefined ? product.stock_count : product.stock), onRestock }) {
  const [burstKey, setBurstKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [tempQty, setTempQty] = useState('');
  const [cardError, setCardError] = useState('');
  const { addToCart, cartItems, updateQuantity, removeFromCart, triggerStockError } = useCart();
  const cartItem = cartItems.find(item => item.id === product.id);
  const cartQuantity = cartItem?.quantity || 0;
  const isAdded = cartQuantity > 0;
  const outOfStock = !product.isAvailable || availableStock === 0;
  const remainingStock = Math.max(0, availableStock - cartQuantity);

  const increaseQuantity = () => {
    if (outOfStock || cartQuantity >= availableStock) return;
    if (cartItem) {
      updateQuantity(product.id, cartQuantity + 1);
    } else {
      addToCart({ ...product, stock: availableStock, stock_count: availableStock }, 1);
    }
    setBurstKey(value => value + 1);
  };

  const decreaseQuantity = () => {
    if (!cartItem) return;
    if (cartQuantity === 1) {
      removeFromCart(product.id);
      return;
    }
    updateQuantity(product.id, cartQuantity - 1);
  };

  const decLP = useLongPress(decreaseQuantity);
  const incLP = useLongPress(increaseQuantity);

  return (
    <article
      className={`product-card ${outOfStock ? 'out-of-stock' : ''} ${isAdded ? 'added' : ''} ${highlighted ? 'product-focus-highlight' : ''}`}
      data-product-id={product.id}
    >
        <div className="product-card-inner">
          <div className="product-image-wrap">
            <img
              src={product.image}
              alt={product.name}
              className="product-image"
              loading="lazy"
              onError={event => {
                if (product.fallbackImage && event.currentTarget.src !== product.fallbackImage) {
                  event.currentTarget.src = product.fallbackImage;
                  return;
                }
                event.currentTarget.style.display = 'none';
              }}
            />
            {product.discountPercentage > 0 && !outOfStock && (
              <span className="product-image-discount-badge">-{product.discountPercentage}%</span>
            )}
            {outOfStock && <div className="out-of-stock-overlay"><span>Out of Stock</span></div>}
          </div>

          <div className="product-info">
            <div className="product-info-top">
              <h3 className="product-name" title={product.name}>{product.name}</h3>
              {(product.product_code || product.code) && (
                <span className="product-code-pill" title={`Product Code: ${product.product_code || product.code}`}>
                  #{String(product.product_code || product.code).replace(/^#/, '')}
                </span>
              )}
            </div>
            {product.packageInfo && (
              <span className="product-package">
                <Package size={13} className="package-icon" />
                <span><small>Pack details</small>{String(product.packageInfo).replace(/^pack\s*details[:\s-]*/i, '')}</span>
              </span>
            )}

            {/* Mobile-only rich price and stock block (exact match to user design) */}
            <div className="product-mobile-meta">
              <div className="product-mobile-pricing">
                <span className="mobile-price-current">{fmt(product.discountedPrice)}</span>
                {product.originalPrice > product.discountedPrice && (
                  <span className="mobile-price-original">{fmt(product.originalPrice)}</span>
                )}
                {product.discountPercentage > 0 && (
                  <span className="mobile-discount-pill">-{product.discountPercentage}%</span>
                )}
              </div>
              <div className="product-mobile-stock">
                <span
                  className={`mobile-stock-badge ${outOfStock || remainingStock === 0 ? 'out-stock' : remainingStock <= 5 ? 'low-stock' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestock?.(product);
                  }}
                  role="button"
                  tabIndex={0}
                  title="Click to Add / Update Stock (Admin)"
                >
                  {outOfStock || remainingStock === 0 ? 'Out of stock' : `${remainingStock} in stock`}
                  <PackagePlus size={11} className="mobile-stock-add-icon" />
                </span>
              </div>
            </div>
          </div>

          <div
            className={`product-stock-cell ${onRestock ? 'interactive-stock-cell' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onRestock?.(product);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRestock?.(product);
              }
            }}
            title={`Current Stock: ${remainingStock}. Click to Add / Update Stock`}
          >
            <strong>{remainingStock}</strong>
            <span>available</span>
            <span className="stock-admin-pill" aria-hidden="true">
              <PackagePlus size={11} /> +Stock
            </span>
          </div>
          <div className="original-price product-price-cell">
            <span className="original-price-value">{fmt(product.originalPrice)}</span>
          </div>
          <div className="discounted-price product-price-cell">
            {fmt(product.discountedPrice)}
            <small>{product.discountPercentage}% off</small>
          </div>

          <div className="product-actions">
            {outOfStock ? (
              <button
                type="button"
                className="product-add-btn product-restock-btn"
                onClick={() => onRestock?.(product)}
                aria-label={`Restock ${product.name}`}
              >
                <PackagePlus size={15} /> Add Stock
              </button>
            ) : (
              <>
                {!isAdded && (
                  <button
                    type="button"
                    className="mobile-add-btn"
                    onClick={increaseQuantity}
                    aria-label={`Add ${product.name} to cart`}
                  >
                    <Plus size={15} strokeWidth={2.6} />
                    <span>Add</span>
                  </button>
                )}
                <div className={`qty-controls ${isAdded ? 'active' : ''} ${!isAdded ? 'desktop-only-qty' : ''}`}>
                  {burstKey > 0 && (
                    <span key={burstKey} className="diwali-icon-burst" aria-hidden="true">
                      <span><Sparkles /></span>
                      <span><Flame /></span>
                      <span><PartyPopper /></span>
                      <span><Zap /></span>
                      <span><Star /></span>
                      <span><Sun /></span>
                    </span>
                  )}
                  <button
                    type="button"
                    className="qty-btn qty-btn-minus"
                    onMouseDown={e => e.preventDefault()}
                    {...decLP}
                    disabled={!isAdded}
                    aria-label={`Decrease ${product.name} quantity`}
                  ><Minus size={15} strokeWidth={2.6} /></button>
                  {isEditing ? (
                    <input
                      type="number"
                      min="1"
                      max={availableStock}
                      className="qty-inline-input"
                      value={tempQty}
                      autoFocus
                      onChange={e => setTempQty(e.target.value)}
                      onBlur={() => {
                        setIsEditing(false);
                        const parsed = parseInt(tempQty, 10);
                        if (isNaN(parsed) || parsed <= 0) {
                          setCardError('');
                          if (cartItem) removeFromCart(product.id);
                        } else if (parsed > availableStock) {
                          const errMsg = `Max ${availableStock}!`;
                          setCardError(errMsg);
                          triggerStockError(`Only ${availableStock} items available in stock for ${product.name}!`);
                          setTimeout(() => setCardError(''), 3000);
                          if (cartItem) {
                            updateQuantity(product.id, availableStock);
                          } else {
                            addToCart({ ...product, stock: availableStock, stock_count: availableStock }, availableStock);
                          }
                        } else {
                          setCardError('');
                          if (cartItem) {
                            updateQuantity(product.id, parsed);
                          } else {
                            addToCart({ ...product, stock: availableStock, stock_count: availableStock }, parsed);
                          }
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          setIsEditing(false);
                          setTempQty(cartQuantity);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="qty-value"
                      onClick={() => {
                        if (isAdded) {
                          setTempQty(cartQuantity || '');
                          setIsEditing(true);
                        }
                      }}
                      title={isAdded ? "Click to enter quantity" : "Add to cart"}
                    >{cartQuantity}</span>
                  )}
                  <button
                    type="button"
                    className="qty-btn qty-btn-plus"
                    onMouseDown={e => e.preventDefault()}
                    {...incLP}
                    disabled={cartQuantity >= availableStock}
                    aria-label={`Increase ${product.name} quantity`}
                  ><Plus size={15} strokeWidth={2.6} /></button>
                </div>
              </>
            )}
            {cardError && <span className="product-qty-error-badge">{cardError}</span>}
          </div>
        </div>
    </article>
  );
}
