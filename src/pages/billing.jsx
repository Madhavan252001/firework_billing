import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BadgeIndianRupee,
  Boxes,
  Check,
  CheckCircle2,
  ImageIcon,
  ListPlus,
  Loader2,
  Minus,
  PackagePlus,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Tag,
  X,
} from 'lucide-react';
import { authService, categoryService, productService, getShopName, orderService } from '../services';
import { useCart, fmt } from '../context/CartContext';
import Header from '../components/Header';
import CategorySidebar from '../components/CategorySidebar';
import CategoryChips from '../components/CategoryChips';
import ProductCard from '../components/ProductCard';
import CurrentOrderPanel from '../components/CurrentOrderPanel';
import DesktopQuickEntry from '../components/DesktopQuickEntry';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import PurchaseHistory from '../components/PurchaseHistory';
import Checkout from './checkout';
import ConfirmModal from '../components/ConfirmModal';
import networkErrorGif from '../assets/videos/Network error.gif';
import './billing.css';

export default function Billing() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [entryLoading, setEntryLoading] = useState(
    () => sessionStorage.getItem('billing_entry_loader') === 'true'
  );
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [desktopMode, setDesktopMode] = useState(() => {
    const saved = localStorage.getItem('billing_desktop_mode');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('billing_desktop_mode', String(desktopMode));
  }, [desktopMode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // F2 or Ctrl+B / Cmd+B toggles Barcode / QR Scanner
      if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB'))) {
        e.preventDefault();
        setShowScannerModal(prev => !prev);
        return;
      }
      // Alt+D / Option+D toggles Desktop Mode
      if (e.altKey && (e.key === 'd' || e.key === 'D' || e.code === 'KeyD')) {
        e.preventDefault();
        setDesktopMode(prev => !prev);
        return;
      }
      // Ctrl+M or Cmd+K / Ctrl+K opens/focuses Quick Entry
      if ((e.ctrlKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) ||
          ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK'))) {
        e.preventDefault();
        setDesktopMode(true);
        setTimeout(() => {
          document.getElementById('quick-product-input')?.focus();
          document.getElementById('quick-product-input')?.select();
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [showCategory, setShowCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [loadingCategory, setLoadingCategory] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [focusedProductId, setFocusedProductId] = useState(null);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockMode, setRestockMode] = useState('add'); // 'add' | 'set'
  const [restockQuantity, setRestockQuantity] = useState('10');
  const [isRestocking, setIsRestocking] = useState(false);
  const [restockNotice, setRestockNotice] = useState(null);
  const [stockLevels, setStockLevels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('billing_inventory') || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  });
  const categoryTimerRef = useRef(null);
  const focusTimerRef = useRef(null);
  const navigate = useNavigate();
  const { cartItems, grandTotal, removeReferral } = useCart();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!entryLoading) return undefined;

    sessionStorage.removeItem('billing_entry_loader');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => setEntryLoading(false), 1200);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [entryLoading]);

  const handleLogout = () => {
    authService.logout();
    setShowLogoutConfirm(false);
    navigate('/login', { replace: true });
  };

  const cartCategories = useMemo(
    () => new Set(cartItems.map(item => item.category).filter(Boolean)),
    [cartItems]
  );

  const [apiCategories, setApiCategories] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      const data = await categoryService.getCategories();
      if (isMounted && data && data.length > 0) {
        setApiCategories(data);
      }
    }
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    orderService.getOfflineOrders().catch(err => {
      console.warn('Background preload orders and shop details error:', err);
    });
  }, []);

  const categoriesList = useMemo(() => {
    const formatted = apiCategories.map(cat => ({
      id: String(cat.id),
      name: cat.name,
      images: cat.images,
      admin_id: cat.admin_id,
      position: cat.position,
    }));
    return [
      { id: 'all', name: 'All Products' },
      ...formatted,
    ];
  }, [apiCategories]);

  const [apiProducts, setApiProducts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadProducts() {
      const data = await productService.getProducts();
      if (isMounted && data && data.length > 0) {
        setApiProducts(data);
        setStockLevels(currentLevels => {
          const next = { ...currentLevels };
          data.forEach(p => {
            const apiStock = p.stock_count !== undefined ? p.stock_count : (p.stock !== undefined ? p.stock : 0);
            next[p.id] = Number(apiStock ?? 0);
          });
          try {
            localStorage.setItem('billing_inventory', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    }
    loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeProducts = useMemo(() => {
    return (apiProducts || []).map(p => {
      const curStock = Number(
        stockLevels[p.id] !== undefined
          ? stockLevels[p.id]
          : (p.stock_count !== undefined ? p.stock_count : (p.stock ?? 0))
      );
      return {
        ...p,
        stock: curStock,
        stock_count: curStock,
        isAvailable: curStock > 0 && p.rawItem?.is_active !== 0,
      };
    });
  }, [apiProducts, stockLevels]);

  const productCounts = useMemo(() => {
    const counts = { all: activeProducts.length };
    categoriesList.forEach(cat => {
      if (cat.id !== 'all') counts[cat.id] = activeProducts.filter(p => String(p.category) === String(cat.id)).length;
    });
    return counts;
  }, [categoriesList, activeProducts]);

  const filteredProducts = useMemo(() => {
    let result = activeProducts;
    if (selectedCategory !== 'all') {
      result = result.filter(p => String(p.category) === String(selectedCategory));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.product_code && p.product_code.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.category && String(p.category).toLowerCase().includes(q)) ||
        (p.packageInfo && p.packageInfo.toLowerCase().includes(q))
      );
    }
    return result;
  }, [activeProducts, selectedCategory, searchQuery]);

  useEffect(() => () => {
    clearTimeout(categoryTimerRef.current);
    clearTimeout(focusTimerRef.current);
  }, []);

  useEffect(() => {
    if (!showCheckout) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showCheckout]);

  useEffect(() => {
    if (!restockTarget) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isRestocking) {
        setRestockTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [restockTarget, isRestocking]);

  useEffect(() => {
    if (!showCategory) return undefined;

    const scrollPosition = window.scrollY;
    const previousStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = previousStyles.overflow;
      document.body.style.position = previousStyles.position;
      document.body.style.top = previousStyles.top;
      document.body.style.width = previousStyles.width;
      window.scrollTo(0, scrollPosition);
    };
  }, [showCategory]);

  useEffect(() => {
    if (!loadingCategory) return undefined;

    const scrollPosition = window.scrollY;
    const previousStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousStyles.overflow;
      document.body.style.position = previousStyles.position;
      document.body.style.top = previousStyles.top;
      document.body.style.width = previousStyles.width;
      document.body.style.overscrollBehavior = previousStyles.overscrollBehavior;
      window.scrollTo(0, scrollPosition);
    };
  }, [loadingCategory]);

  useEffect(() => {
    localStorage.setItem('billing_inventory', JSON.stringify(stockLevels));
  }, [stockLevels]);

  const handleCategorySelect = categoryId => {
    if (categoryId === selectedCategory && !loadingCategory) return;
    clearTimeout(categoryTimerRef.current);
    clearTimeout(focusTimerRef.current);
    setFocusedProductId(null);
    setSelectedCategory(categoryId);
    setLoadingCategory(categoryId);
    categoryTimerRef.current = setTimeout(() => {
      setLoadingCategory(null);
    }, 1200);
  };

  const handleViewProduct = product => {
    clearTimeout(categoryTimerRef.current);
    clearTimeout(focusTimerRef.current);
    const categoryChanged = selectedCategory !== product.category;

    setSearchQuery('');
    setSelectedCategory(product.category);
    setFocusedProductId(null);
    setLoadingCategory(categoryChanged ? product.category : null);

    categoryTimerRef.current = window.setTimeout(() => {
      setLoadingCategory(null);
      setFocusedProductId(product.id);
      window.requestAnimationFrame(() => {
        document.querySelector(`[data-product-id="${product.id}"]`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
      focusTimerRef.current = window.setTimeout(() => setFocusedProductId(null), 2200);
    }, categoryChanged ? 1200 : 0);
  };

  const handleOrderProcessed = soldItems => {
    removeReferral?.();
    setStockLevels(currentLevels => {
      const nextLevels = { ...currentLevels };
      soldItems.forEach(item => {
        const prod = activeProducts.find(product => product.id === item.id);
        const catalogStock = prod ? (prod.stock_count !== undefined ? prod.stock_count : prod.stock) : 0;
        const currentStock = Number(currentLevels[item.id] ?? catalogStock);
        nextLevels[item.id] = Math.max(0, currentStock - item.quantity);
      });
      return nextLevels;
    });
  };

  const openRestock = product => {
    const currentStock = Number(
      stockLevels[product.id] !== undefined
        ? stockLevels[product.id]
        : (product.stock_count !== undefined ? product.stock_count : (product.stock ?? 0))
    );
    setRestockTarget({ ...product, currentStock });
    setRestockMode('add');
    setRestockQuantity('10');
    setIsRestocking(false);
    setRestockNotice(null);
  };

  const applyRestock = async () => {
    if (!restockTarget || isRestocking) return;
    const inputVal = Math.max(0, parseInt(restockQuantity, 10) || 0);
    const currentStock = Number(
      stockLevels[restockTarget.id] !== undefined
        ? stockLevels[restockTarget.id]
        : (restockTarget.stock_count !== undefined ? restockTarget.stock_count : (restockTarget.stock ?? 0))
    );
    const targetStock = restockMode === 'add' ? currentStock + inputVal : inputVal;

    setIsRestocking(true);
    setRestockNotice(null);

    try {
      // 1. Call API update for ProERP & Admin backend
      const res = await productService.updateProductStock(restockTarget.id, targetStock);

      // 2. Update stockLevels state & localStorage
      setStockLevels(prev => {
        const next = { ...prev, [restockTarget.id]: targetStock };
        try {
          localStorage.setItem('billing_inventory', JSON.stringify(next));
        } catch (e) {}
        return next;
      });

      // 3. Update apiProducts in page state
      setApiProducts(prev =>
        prev.map(p => {
          if (p.id === restockTarget.id) {
            return {
              ...p,
              stock: targetStock,
              stock_count: targetStock,
              isAvailable: targetStock > 0 && p.rawItem?.is_active !== 0,
              proerp: { ...(p.proerp || {}), stock_count: targetStock, stock: targetStock },
              proerp_data: { ...(p.proerp_data || {}), stock_count: targetStock, stock: targetStock },
            };
          }
          return p;
        })
      );

      if (res.success) {
        setRestockNotice({
          type: 'success',
          message: `Stock updated to ${targetStock} units for ${restockTarget.name} in Admin & ProERP!`,
        });
        setTimeout(() => {
          setRestockTarget(null);
          setIsRestocking(false);
          setRestockNotice(null);
        }, 850);
      } else {
        setRestockNotice({
          type: 'warning',
          message: `Stock saved locally (${res.error || 'Server sync pending'})`,
        });
        setTimeout(() => {
          setRestockTarget(null);
          setIsRestocking(false);
          setRestockNotice(null);
        }, 1250);
      }
    } catch (err) {
      console.error('Error during restock update:', err);
      setIsRestocking(false);
      setRestockNotice({
        type: 'error',
        message: err.message || 'Failed to update stock',
      });
    }
  };

  return (
    <div className="billing-page">
      {entryLoading && (
        <div className="billing-entry-loader" role="status" aria-live="polite">
          <div className="diwali-loader-art" aria-hidden="true">
            <span className="diya-glow" />
            <span className="diya-flame" />
            <span className="diya-bowl" />
            <span className="spark spark-one" />
            <span className="spark spark-two" />
            <span className="spark spark-three" />
            <span className="spark spark-four" />
          </div>
          <strong>{getShopName()}</strong>
          <span>Preparing your billing counter...</span>
        </div>
      )}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onToggleCategory={() => setShowCategory(p => !p)}
        onLogout={() => setShowLogoutConfirm(true)}
        onViewOrders={() => setShowOrders(true)}
        desktopMode={desktopMode}
        onToggleDesktopMode={() => setDesktopMode(prev => !prev)}
        onOpenScanner={() => setShowScannerModal(true)}
      />

      <div className="billing-workspace billing-container">
        <CategorySidebar
          selected={selectedCategory}
          onSelect={handleCategorySelect}
          productCounts={productCounts}
          searchQuery={categorySearch}
          onSearchChange={setCategorySearch}
          cartCategories={cartCategories}
          categories={categoriesList}
        />

        <main className="product-area">
          {desktopMode && (
            <DesktopQuickEntry
              products={activeProducts}
              onClose={() => setDesktopMode(false)}
              onOpenScanner={() => setShowScannerModal(true)}
              onRestock={openRestock}
            />
          )}

          <CategoryChips
            selected={selectedCategory}
            onSelect={handleCategorySelect}
            productCounts={productCounts}
            cartCategories={cartCategories}
            categories={categoriesList}
          />

          {loadingCategory && (
            <div className="category-loader" role="status" aria-live="polite">
              <div className="diwali-loader-art" aria-hidden="true">
                <span className="spark spark-one" />
                <span className="spark spark-two" />
                <span className="spark spark-three" />
                <span className="spark spark-four" />
                <span className="diya-flame" />
                <span className="diya-bowl" />
                <span className="diya-glow" />
              </div>
              <strong>Lighting up {categoriesList.find(category => category.id === loadingCategory)?.name}</strong>
              <span>Bringing festive products...</span>
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <h3>No products found</h3>
              <p>Try a different product name or category</p>
            </div>
          ) : (
            <div className="product-table product-table-container">
              <div className="product-table-head" role="row">
                <span role="columnheader"><ImageIcon size={15} /><strong>Product Image</strong></span>
                <span className="product-head-name" role="columnheader">
                  <span className="head-label"><PackageSearch size={15} /><strong>Product Details</strong></span>
                  <small>{categoriesList.find(c => c.id === selectedCategory)?.name || 'Products'} · {filteredProducts.length} items</small>
                </span>
                <span role="columnheader"><Boxes size={15} /><strong>Stock</strong></span>
                <span role="columnheader"><Tag size={15} /><strong>Original Price</strong></span>
                <span role="columnheader"><BadgeIndianRupee size={15} /><strong>Offer Price</strong></span>
                <span role="columnheader"><ListPlus size={15} /><strong>Select Quantity</strong></span>
              </div>
              <div className="product-grid">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    highlighted={focusedProductId === product.id}
                    availableStock={Number(stockLevels[product.id] ?? (product.stock_count !== undefined ? product.stock_count : product.stock))}
                    onRestock={openRestock}
                  />
                ))}
              </div>
            </div>
          )}
        </main>

        <CurrentOrderPanel onCheckout={() => setShowCheckout(true)} onViewProduct={handleViewProduct} />
      </div>

      {/* Mobile sticky cart bar */}
      {cartItems.length > 0 && (
        <div className="mobile-cart-bar clay-card" onClick={() => setShowCheckout(true)}>
          <div className="cart-bar-left">
            <ShoppingCart size={18} />
            <span className="cart-bar-count">
              {cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'}
            </span>
            <span className="cart-bar-sep">•</span>
            <span className="cart-bar-total">{fmt(grandTotal)}</span>
          </div>
          <button className="clay-btn clay-btn-primary clay-btn-sm cart-bar-btn">View Order</button>
        </div>
      )}

      {/* Mobile category drawer */}
      {showCategory && (
        <div className="modal-overlay category-drawer-overlay" onClick={() => setShowCategory(false)}>
          <div className="category-drawer" onClick={e => e.stopPropagation()}>
            <div className="category-drawer-header">
              <h3 className="drawer-title">Categories</h3>
              <button type="button" onClick={() => setShowCategory(false)} aria-label="Close categories">
                <X size={18} />
              </button>
            </div>
            <div className="category-search-box">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search categories"
                aria-label="Search categories"
                value={categorySearch}
                onChange={event => setCategorySearch(event.target.value)}
              />
              {categorySearch && (
                <button onClick={() => setCategorySearch('')} aria-label="Clear category search"><X size={14} /></button>
              )}
            </div>
            {categoriesList.filter(category => category.name.toLocaleLowerCase().includes(categorySearch.trim().toLocaleLowerCase())).map(cat => {
              const count = productCounts[cat.id] || 0;
              const isActive = selectedCategory === cat.id;
              const hasCartItems = cartCategories.has(cat.id);
              return (
                <button
                  key={cat.id}
                  className={`drawer-item ${isActive ? 'active' : ''} ${hasCartItems ? 'has-cart-items' : ''}`}
                  onClick={() => { handleCategorySelect(cat.id); setShowCategory(false); }}
                >
                  <span>{cat.name}</span>
                  <span className="drawer-count">{count}</span>
                </button>
              );
            })}
            {categoriesList.filter(category => category.name.toLocaleLowerCase().includes(categorySearch.trim().toLocaleLowerCase())).length === 0 && (
              <p className="category-search-empty">No categories found</p>
            )}
          </div>
        </div>
      )}

      {restockTarget && (() => {
        const currentStock = Number(
          stockLevels[restockTarget.id] !== undefined
            ? stockLevels[restockTarget.id]
            : (restockTarget.stock_count !== undefined ? restockTarget.stock_count : (restockTarget.stock ?? 0))
        );
        const inputNum = Math.max(0, parseInt(restockQuantity, 10) || 0);
        const projectedStock = restockMode === 'add' ? currentStock + inputNum : inputNum;
        const codeDisplay = restockTarget.product_code || restockTarget.code;

        return (
          <div
            className="modal-overlay restock-modal-overlay"
            onMouseDown={event => event.target === event.currentTarget && !isRestocking && setRestockTarget(null)}
          >
            <div
              className="restock-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="restock-title"
              onMouseDown={event => event.stopPropagation()}
            >
              {/* Header */}
              <div className="restock-modal-header">
                <div className="restock-header-icon-wrap">
                  <PackagePlus size={22} />
                </div>
                <div className="restock-header-text">
                  <div className="restock-badge-row">
                    <span className="restock-admin-badge">Admin Stock Control</span>
                    <span className="restock-proerp-pill">
                      <span className="proerp-dot"></span> ProERP Sync
                    </span>
                  </div>
                  <h3 id="restock-title">Add / Update Stock</h3>
                  <div className="restock-product-subtitle" title={restockTarget.name}>
                    <span className="restock-prod-name">{restockTarget.name}</span>
                    {codeDisplay && (
                      <span className="restock-prod-code">
                        #{String(codeDisplay).replace(/^#/, '')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="restock-modal-close-btn"
                  onClick={() => !isRestocking && setRestockTarget(null)}
                  disabled={isRestocking}
                  title="Close (Esc)"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="restock-modal-body">
                {/* Current Stock Banner / Grid */}
                <div className="restock-stock-status-bar">
                  <div className="restock-stock-stat">
                    <span className="stat-label">Current Live Stock</span>
                    <div className="stat-value-group">
                      <strong className={`stat-val ${currentStock === 0 ? 'zero-stock' : 'has-stock'}`}>
                        {currentStock}
                      </strong>
                      <span className="stat-unit">units</span>
                      <span className={`stat-pill ${currentStock === 0 ? 'pill-out' : 'pill-in'}`}>
                        {currentStock === 0 ? 'Out of Stock' : 'In Stock'}
                      </span>
                    </div>
                  </div>
                  {restockTarget.packageInfo ? (
                    <div className="restock-stock-stat">
                      <span className="stat-label">Packaging Spec</span>
                      <div className="stat-pack-box">
                        <Boxes size={15} className="stat-pack-icon" />
                        <span className="stat-val-pack">{restockTarget.packageInfo}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="restock-stock-stat">
                      <span className="stat-label">Catalog Price</span>
                      <div className="stat-pack-box">
                        <span className="stat-val-pack">₹{restockTarget.discountedPrice || restockTarget.price || 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mode Selection Tabs */}
                <div className="restock-tabs-wrap">
                  <div className="restock-tabs">
                    <button
                      type="button"
                      className={`restock-tab ${restockMode === 'add' ? 'active' : ''}`}
                      onClick={() => setRestockMode('add')}
                      disabled={isRestocking}
                    >
                      <Plus size={15} />
                      <span>Add to Stock (+)</span>
                    </button>
                    <button
                      type="button"
                      className={`restock-tab ${restockMode === 'set' ? 'active' : ''}`}
                      onClick={() => setRestockMode('set')}
                      disabled={isRestocking}
                    >
                      <Check size={15} />
                      <span>Set Exact Stock (=)</span>
                    </button>
                  </div>
                  <div className="restock-mode-hint">
                    {restockMode === 'add'
                      ? '➕ Adds specified units to current stock balance (Restock / Inward)'
                      : '🎯 Overrides inventory with the specified exact count (Physical audit)'}
                  </div>
                </div>

                {/* Quick Preset Buttons (in Add mode) */}
                {restockMode === 'add' && (
                  <div className="restock-presets">
                    <span className="presets-label">Quick add amount:</span>
                    <div className="presets-group">
                      {[5, 10, 25, 50, 100].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className={`preset-btn ${restockQuantity === String(amt) ? 'selected' : ''}`}
                          onClick={() => setRestockQuantity(String(amt))}
                          disabled={isRestocking}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity Input */}
                <div className="restock-field-group">
                  <label className="restock-field-label" htmlFor="restock-quantity">
                    <span>{restockMode === 'add' ? 'Quantity to Add (+)' : 'New Total Stock count (=)'}</span>
                    <span className="restock-field-sub">Units count</span>
                  </label>
                  <div className="restock-input-row">
                    <span className="restock-input-sign">
                      {restockMode === 'add' ? '+' : '='}
                    </span>
                    <input
                      id="restock-quantity"
                      className="restock-qty-input"
                      type="number"
                      min="0"
                      max="99999"
                      step="1"
                      inputMode="numeric"
                      value={restockQuantity}
                      disabled={isRestocking}
                      onChange={event => setRestockQuantity(event.target.value)}
                      onKeyDown={event => event.key === 'Enter' && !isRestocking && applyRestock()}
                      autoFocus
                    />
                    <div className="restock-stepper-btns">
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => setRestockQuantity(String(Math.max(0, (parseInt(restockQuantity, 10) || 0) - 1)))}
                        disabled={isRestocking || (parseInt(restockQuantity, 10) || 0) <= 0}
                        title="Decrease by 1"
                      >
                        <Minus size={14} />
                      </button>
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => setRestockQuantity(String((parseInt(restockQuantity, 10) || 0) + 1))}
                        disabled={isRestocking}
                        title="Increase by 1"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Projected Stock Preview */}
                <div className="restock-preview-box">
                  <div className="preview-top-row">
                    <span className="preview-label">PROJECTED STOCK CALCULATION</span>
                    <span className="preview-sync-tag">⚡ Live ProERP</span>
                  </div>
                  <div className="preview-calc-bar">
                    {restockMode === 'add' ? (
                      <div className="calc-segments">
                        <div className="calc-chip">
                          <span className="chip-lbl">Current</span>
                          <span className="chip-val">{currentStock}</span>
                        </div>
                        <span className="calc-operator">+</span>
                        <div className="calc-chip highlight">
                          <span className="chip-lbl">Adding</span>
                          <span className="chip-val">+{inputNum}</span>
                        </div>
                        <span className="calc-operator">=</span>
                        <div className="calc-chip result">
                          <span className="chip-lbl">New Balance</span>
                          <strong className="chip-val-bold">{projectedStock} units</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="calc-segments">
                        <div className="calc-chip">
                          <span className="chip-lbl">Current</span>
                          <span className="chip-val">{currentStock}</span>
                        </div>
                        <span className="calc-operator">➔</span>
                        <div className="calc-chip result">
                          <span className="chip-lbl">Updated Total</span>
                          <strong className="chip-val-bold">{projectedStock} units</strong>
                        </div>
                      </div>
                    )}
                  </div>
                  <small className="preview-note">
                    Synchronizes live with Admin backend and ProERP cloud database
                  </small>
                </div>

                {/* Notice Message */}
                {restockNotice && (
                  <div className={`restock-notice-banner ${restockNotice.type}`}>
                    {restockNotice.type === 'success' ? (
                      <CheckCircle2 size={16} className="notice-icon" />
                    ) : (
                      <AlertCircle size={16} className="notice-icon" />
                    )}
                    <span>{restockNotice.message}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="restock-actions">
                <button
                  type="button"
                  className="restock-btn-cancel"
                  disabled={isRestocking}
                  onClick={() => setRestockTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="restock-confirm"
                  onClick={applyRestock}
                  disabled={isRestocking || (restockMode === 'add' && inputNum <= 0)}
                >
                  {isRestocking ? (
                    <>
                      <Loader2 size={16} className="spinner-icon animate-spin" />
                      <span>Updating ProERP...</span>
                    </>
                  ) : (
                    <>
                      <PackagePlus size={16} />
                      <span>Save Stock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showLogoutConfirm && (
        <ConfirmModal
          title="Logout Confirmation"
          message="Are you sure you want to log out of the billing system?"
          confirmText="Yes, Logout"
          cancelText="Cancel"
          danger
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
      {!isOnline && (
        <div className="offline-screen-overlay" role="alertdialog" aria-modal="true" aria-labelledby="offline-title">
          <div className="offline-card">
            <div className="offline-gif-wrap">
              <img src={networkErrorGif} alt="Network Error" className="offline-gif" />
            </div>
            <h2 id="offline-title" className="offline-title">No Internet Connection</h2>
            <p className="offline-subtitle">
              Please check your network cables, Wi-Fi, or router connection.
            </p>
            <div className="offline-actions">
              <button
                type="button"
                className="offline-retry-btn"
                onClick={() => setIsOnline(navigator.onLine)}
              >
                <RefreshCw size={16} /> Try Again
              </button>
            </div>
          </div>
        </div>
      )}
      {showCheckout && <Checkout onClose={() => setShowCheckout(false)} onOrderProcessed={handleOrderProcessed} />}
      {showOrders && <PurchaseHistory onClose={() => setShowOrders(false)} />}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        products={activeProducts}
      />
      <p className="powered-by billing-footer">Powered By <strong>SDS</strong></p>
    </div>
  );
}
