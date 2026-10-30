import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Keyboard, Search, Plus, X, QrCode, PackagePlus } from 'lucide-react';
import { useCart, fmt } from '../context/CartContext';

export default function DesktopQuickEntry({ products = [], onClose, onOpenScanner, onRestock }) {
  const { addToCart, triggerStockError } = useCart();
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [addedAnimation, setAddedAnimation] = useState(false);

  const productInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const animationTimerRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    productInputRef.current?.focus();
    return () => window.clearTimeout(animationTimerRef.current);
  }, []);

  // Filter products matching query
  const matchingProducts = useMemo(() => {
    const q = (productQuery || '').trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(q);
      const codeMatch = p.code?.toLowerCase().includes(q);
      const prodCodeMatch = p.product_code?.toLowerCase().includes(q);
      return nameMatch || codeMatch || prodCodeMatch;
    }).slice(0, 8); // Top 8 suggestions
  }, [productQuery, products]);

  // Handle product input changes
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setProductQuery(val);
    setSelectedProduct(null);
    setHighlightedIndex(0);
    setIsDropdownOpen(val.trim().length > 0);
  };

  // Select a product from suggestions or exact match
  const handleSelectProduct = (product) => {
    if (!product) return;
    setSelectedProduct(product);
    setProductQuery(product.name);
    setIsDropdownOpen(false);
    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
  };

  // Keyboard navigation inside product input
  const handleProductKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isDropdownOpen && matchingProducts.length > 0) {
        setIsDropdownOpen(true);
        return;
      }
      setHighlightedIndex(prev => (prev + 1) % Math.max(1, matchingProducts.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + matchingProducts.length) % Math.max(1, matchingProducts.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingProducts.length > 0 && isDropdownOpen) {
        const target = matchingProducts[highlightedIndex] || matchingProducts[0];
        handleSelectProduct(target);
      } else if (selectedProduct) {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }
    } else if (e.key === 'Tab') {
      if (matchingProducts.length > 0 && !selectedProduct) {
        e.preventDefault();
        const target = matchingProducts[highlightedIndex] || matchingProducts[0];
        handleSelectProduct(target);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // Keyboard navigation inside quantity input
  const handleQtyKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  // Calculate subtotal
  const subtotalAmount = useMemo(() => {
    if (!selectedProduct) return 0;
    const qty = Math.max(1, Number(quantity) || 1);
    return selectedProduct.discountedPrice * qty;
  }, [selectedProduct, quantity]);

  // Add Item to cart
  const handleAddItem = () => {
    let productToAdd = selectedProduct;

    // If user typed and didn't explicitly pick, take exact or top match
    if (!productToAdd && productQuery.trim()) {
      const q = productQuery.trim().toLowerCase();
      const exactMatch = products.find(p =>
        (p.product_code && p.product_code.toLowerCase() === q) ||
        (p.code && p.code.toLowerCase() === q) ||
        p.name.toLowerCase() === q
      );
      productToAdd = exactMatch || matchingProducts[0];
    }

    if (!productToAdd) {
      productInputRef.current?.focus();
      return;
    }

    const qty = Math.max(1, Number(quantity) || 1);
    const availableStock = productToAdd.stock_count !== undefined ? productToAdd.stock_count : (productToAdd.stock ?? 0);
    if (availableStock < qty) {
      triggerStockError(`Only ${availableStock} units available for ${productToAdd.name}`);
      return;
    }

    addToCart({ ...productToAdd, stock: availableStock, stock_count: availableStock }, qty);

    // Trigger visual celebration feedback
    setAddedAnimation(true);
    window.clearTimeout(animationTimerRef.current);
    animationTimerRef.current = window.setTimeout(() => setAddedAnimation(false), 800);

    // Reset fields for rapid consecutive entry
    setProductQuery('');
    setSelectedProduct(null);
    setQuantity('1');
    setIsDropdownOpen(false);

    // Refocus product input for next item immediately
    productInputRef.current?.focus();
  };

  return (
    <div className={`desktop-quick-entry-card ${addedAnimation ? 'item-added-burst' : ''}`}>
      {/* Top Header Row */}
      <div className="quick-entry-header">
        <div className="quick-entry-title-group">
          <div className="quick-entry-icon-badge">
            <Keyboard size={16} />
          </div>
          <h3 className="quick-entry-title">Desktop Quick Entry Mode</h3>
          <span className="quick-shortcut-tag">⌥D | Ctrl+M / ⌘K</span>
        </div>

        <div className="quick-flow-instructions" aria-hidden="true">
          <div className="flow-step-pill">
            <span className="flow-badge">Ctrl+M / ⌘K</span>
            <span className="flow-label">Type Product</span>
          </div>
          <span className="flow-arrow">→</span>
          <div className="flow-step-pill">
            <span className="flow-badge">Tab</span>
            <span className="flow-label">Set Qty</span>
          </div>
          <span className="flow-arrow">→</span>
          <div className="flow-step-pill">
            <span className="flow-badge">Enter</span>
            <span className="flow-label">Add to Cart</span>
          </div>
        </div>

        <button
          type="button"
          className="quick-entry-close-btn"
          onClick={onClose}
          aria-label="Close Desktop Mode"
          title="Close Desktop Mode (⌥D / Escape)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Bottom Form Fields Row */}
      <div className="quick-entry-form">
        {/* Product Name / Code Column */}
        <div className="quick-field-group product-field-col">
          <label htmlFor="quick-product-input" className="quick-field-label">
            PRODUCT NAME / CODE
          </label>
          <div className="quick-input-wrapper">
            <Search size={16} className="quick-search-icon" />
            <input
              ref={productInputRef}
              id="quick-product-input"
              type="text"
              className="quick-input quick-product-input"
              placeholder="Type product name or code..."
              value={productQuery}
              onChange={handleQueryChange}
              onKeyDown={handleProductKeyDown}
              autoComplete="off"
            />
            {onOpenScanner && (
              <button
                type="button"
                className="quick-scanner-inline-btn"
                onClick={onOpenScanner}
                title="Scan Barcode / QR Code"
                aria-label="Scan barcode"
              >
                <QrCode size={16} />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {isDropdownOpen && matchingProducts.length > 0 && (
            <ul ref={dropdownRef} className="quick-suggestions-dropdown" role="listbox">
              {matchingProducts.map((p, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const pCode = p.product_code || p.code;
                return (
                  <li
                    key={p.id}
                    className={`quick-suggestion-item ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={() => handleSelectProduct(p)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    role="option"
                    aria-selected={isHighlighted}
                  >
                    <div className="suggestion-main">
                      <strong className="suggestion-name">{p.name}</strong>
                      {pCode && <span className="suggestion-code">{pCode}</span>}
                    </div>
                    <div className="suggestion-meta">
                      <span className="suggestion-price">{fmt(p.discountedPrice)}</span>
                      <div className="suggestion-stock-wrap">
                        <small className={`suggestion-stock ${(p.stock_count !== undefined ? p.stock_count : p.stock) === 0 ? 'out-of-stock-text' : ''}`}>
                          {(p.stock_count !== undefined ? p.stock_count : p.stock)} in stock
                        </small>
                        {onRestock && (
                          <button
                            type="button"
                            className="suggestion-restock-btn"
                            title="Add / Update Stock"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestock(p);
                            }}
                          >
                            <PackagePlus size={11} /> +Stock
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quantity Column */}
        <div className="quick-field-group quantity-field-col">
          <label htmlFor="quick-quantity-input" className="quick-field-label">
            QUANTITY
          </label>
          <input
            ref={qtyInputRef}
            id="quick-quantity-input"
            type="number"
            min="1"
            className="quick-input quick-qty-input"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            onKeyDown={handleQtyKeyDown}
          />
        </div>

        {/* Subtotal Column */}
        <div className="quick-field-group subtotal-field-col">
          <label className="quick-field-label">
            SUBTOTAL
          </label>
          <div className="quick-subtotal-display">
            {fmt(subtotalAmount)}
          </div>
        </div>

        {/* Action Button */}
        <div className="quick-field-group button-field-col">
          <button
            type="button"
            className="quick-add-item-btn"
            onClick={handleAddItem}
            disabled={!selectedProduct && matchingProducts.length === 0 && !productQuery.trim()}
          >
            <Plus size={16} />
            <span>Add Item</span>
          </button>
        </div>
      </div>
    </div>
  );
}
