import React, { useEffect, useState } from 'react';
import { LogOut, Menu, Monitor, QrCode, Search, ShoppingBag, User, X } from 'lucide-react';
import { authService, getShopName } from '../services';
import logoStackedImg from '../assets/images/pattaz_brand_stacked.png';
import logoTopImg from '../assets/images/pattaz_logo_top.png';
import logoImg from '../assets/images/logo.png';

export default function Header({
  searchQuery,
  setSearchQuery,
  onToggleCategory,
  onLogout,
  onViewOrders,
  desktopMode,
  onToggleDesktopMode,
  onOpenScanner,
}) {
  const [now, setNow] = useState(() => new Date());
  const user = authService.getUser();
  const roleName = authService.getRole();
  const shopName = getShopName();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const dateLabel = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-left">
          <button type="button" className="menu-toggle clay-btn clay-btn-sm" onClick={onToggleCategory} aria-label="Toggle categories" title="Categories">
            <Menu size={20} />
          </button>
          <div className="brand brand-stacked" title={`${shopName} - Fireworks POS`}>
            <img src={logoStackedImg || logoTopImg || logoImg} alt={`${shopName} Fireworks POS`} className="header-brand-stacked-img" />
          </div>
        </div>

        <div className="header-center">
          <div className="search-box">
            <Search className="search-icon" size={19} />
            <input
              type="text"
              className="search-input"
              placeholder="Search products by name"
              aria-label="Search products"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
            />
            {searchQuery && (
              <button type="button" className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search" title="Clear search">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="header-right">
          {user && (
            <div className="user-profile-badge" title={`${user.name || user.email} (${roleName})`}>
              <User size={15} />
              <span className="user-name">{user.name || user.email?.split('@')[0] || 'User'}</span>
              <span className={`user-role-chip ${roleName.toLowerCase() === 'admin' ? 'role-admin' : 'role-staff'}`}>
                {roleName}
              </span>
            </div>
          )}
          <span className="header-divider" />
          <div className="shift-summary">
            <span className="shift-state"><i /> Shift Open</span>
            <span className="shift-time"><strong>{timeLabel}</strong><small>{dateLabel}</small></span>
          </div>
          <span className="header-divider" />
          <button
            type="button"
            className={`desktop-mode-btn ${desktopMode ? 'active' : ''}`}
            onClick={onToggleDesktopMode}
            aria-pressed={desktopMode}
            title="Toggle Desktop Quick Entry Mode (⌥D / Alt+D)"
          >
            <Monitor size={17} />
            <span className="desktop-mode-label">Desktop Mode</span>
            <span className="desktop-mode-dot" />
          </button>
          <span className="header-divider" />
          <button
            type="button"
            className="scanner-header-btn"
            onClick={onOpenScanner}
            title="Open Barcode / QR Scanner (F2 / Ctrl+B)"
            aria-label="Barcode / QR Scanner"
          >
            <QrCode size={17} />
            <span className="scanner-btn-label">Scanner</span>
          </button>
          <span className="header-divider" />
          <button className="orders-btn" type="button" onClick={onViewOrders} aria-label="Purchase history" title="Orders">
            <ShoppingBag size={18} />
            <span className="orders-btn-label">Orders</span>
          </button>
          <span className="header-divider" />
          <button type="button" className="logout-btn" aria-label="Logout" title="Logout" onClick={onLogout}>
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
