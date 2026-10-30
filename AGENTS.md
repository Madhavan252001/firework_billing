**AGENTS.md** – Session Summary

## What We Built (Complete POS System)

### Backend
- `server/database.js` – SQLite schema: products, categories, customers, orders, order_items
- `server/server.js` – Express API: CRUD products/categories, place orders, serve static build
- `server/package.json` – Server scripts

### Frontend (React)
- **`src/context/CartContext.js`** – Cart state + customer + gst/discount + payment/credit
- **`src/context/ThemeContext.js`** – Dark mode toggle (persisted)
- **`src/services/config.js`** – Base API URL configuration (`https://offer360.in/fireworks/crackers`) & endpoints: `REFERRAL_CODE` (`/referrals/code/:code`), `REFERRAL_CODE_ALT` (`/referals/code/:code`), and `REFERRAL_CODE_MY` (`/myreferral/code/:code`)
- **`src/services/apiClient.js`** – Generic HTTP fetch client wrapper handling headers, errors, and token attachment
- **`src/services/productService.js`** – Products API fetching (`GET /products`) mapping `product_code`, resolving live `stock_count` from `item.stock_count` / `proerp` (`item.proerp?.stock_count` / `item.available_stock` / `item.stock_qty`), preserving `proerp` metadata, and calculating active `isAvailable` status
- **`src/services/orderService.js`** – Order creation & retrieval via `POST /orders/offline` (and `/crackers/myorders`) with exact schema (`customer_name`, `customer_mobile`, `coupon_code`, `address`, `postalcode`, `payment_method`, `coupon_discount`, `referral_code`, `referral_customer_discount`, `delivery_fee`, `payable_amount`, and items array with `product_id`, `product_name`, `quantity`, `price`), with offline fallback support
- **`src/services/referralService.js`** – Referral code verification service calling `GET /referrals/code/:code` (with auto-auth token acquisition, `/referals/code/:code` and `/myreferral/code/:code` fallbacks), normalizing `customer_discount`, and supporting demo/test codes like `len389mg` and `RAJ3210XF`
- **`src/services/index.js`** – Services barrel export
- **`src/components/Header.jsx`** – Header with branding, shift status, order history, and **Desktop Mode toggle button** (`[ 🖥️ Desktop Mode 🟣 ]`)
- **`src/components/DesktopQuickEntry.jsx`** – Fast desktop keyboard-first product entry card (`⌥D | Ctrl+M / ⌘K`, search/barcode by name or `product_code`, quantity, subtotal, and instant Enter-to-cart flow)
- **`src/components/BarcodeScannerModal.jsx`** – High-fidelity Barcode & QR Scanner modal dialog:
  - Supports continuous video camera scanning via `html5-qrcode` (1D barcodes: EAN-13, CODE-128, CODE-39, UPC; 2D: QR code)
  - Laser sweep animation, targeting reticles, front/rear camera switching
  - Hardware barcode scanner mode with auto-focused monospace input and pulsing ready indicator
  - Product lookup matching `product_code`, `code`, `id`, or `name` with out-of-stock validation and audio beep confirmation
  - Keyboard shortcuts: `F2` or `Ctrl+B / ⌘B` to open scanner anytime
- **`src/context/CartContext.js`** – Cart state + customer + gst/discount + payment/credit + **Requirement Note** (`requirementNote`, `setRequirementNote`, localStorage persistence)
- **`src/components/CurrentOrderPanel.jsx`** – Desktop sidebar with inline validation, Basic & Other discount, Referral Code API apply, **Requirement Note** input field, and **Estimate Bill button** with instant estimation workflow
- **`src/components/EstimateBillingModal.jsx`** – Quick Estimate billing modal with customer details, remark/requirement note, live breakdown preview, and 1-click apply (Proposed Payment Mode selection removed from estimation as payment is not collected for quotations)
- **`src/pages/checkout.jsx`** – Mobile checkout with customer form, payment method, discounts, **Requirement Note** editing, offline order processing, and dedicated **Estimate Bill** button
- **`src/utils/printUtils.js`** – Bill printing utility (`printSingleBill`) generating **CUSTOMER COPY** or **ESTIMATE BILL (NOT A TAX INVOICE)** with store logo, dynamic shop details, GST, referral discount, and prominent Requirement Note / Remark
- **`src/services/config.js`** – API config with `CREATE_ESTIMATE_ORDER` & `ESTIMATE_ORDERS` endpoints (`/orders/estimates`, `/crackers/orders/estimates`)
- **`src/services/orderService.js`** – Order creation & retrieval via `POST /orders/offline` and `POST /orders/estimates` matching exact API schema (`customer_name`, `customer_mobile`, `address`, `postalcode`, `items: [{ product_id, quantity }]`, `tax_percentage`, `basic_discount_percentage`, `payment_method`, `remark`), plus `getEstimateOrders` and fallback retrieval in `getOrderById`
- **`src/services/apiClient.js`** – HTTP fetch client wrapper with automatic token acquisition (`getOrAcquireToken`) and transparent 401/403 auto-refresh retry so public bill & estimate shared links load seamlessly without authentication roadblocks.
- **`src/services/productService.js`** – Products API fetching (`GET /products`) with in-memory caching (`cachedProducts`), `getProductById` lookup, resolving live `stock_count` and proerp metadata (`item.stock_count` / `item.proerp`), and mapping product codes (`product_code`).
- **`src/services/orderService.js`** – Single order and estimate retrieval in `getOrderById`:
  - Directly handles alphanumeric order identifiers (e.g. `ORD-20261006-DG3D` or `RS-2026-...`) by searching offline orders and estimate orders lists.
  - Automatically fetches full order detail with items from `/orders/estimates/:id` or `/orders/offline/:id`.
  - Integrates proerp product catalog (`productService.getProducts()`) to enrich order items with live `product_code`, `proerp` stock and packaging data, accurate pricing, and totals.
  - Recovers items from client-side `billing_orders` as an additional fallback.
- **`src/pages/ViewBill.jsx`** – Full-fidelity digital bill & quotation view page:
  - Fetches and displays authoritative items table with Product name, `product_code`, Qty, Price, and Total.
  - Displays dynamic header `Items Summary (N items / M qty)` matching live order details.
  - Seamlessly handles shared links (`/billing/bill/:orderId`) for both Sales Orders and Estimates Quotations (`ORD-...`).
  - Displays **Store Mobile** number (`9876543210`) with direct one-touch `tel:` call link in the Store Info section and printed receipts.

- **`src/services/config.js`** – API config with `DELETE_ESTIMATE_ORDER` & alt endpoints (`/order/estimates/:id`, `/crackers/order/estimates/:id`, `/orders/estimates/:id`)
- **`src/services/orderService.js`** – Added `deleteEstimateOrder(estimateId)` calling `DELETE /crackers/order/estimates/:id` and `/order/estimates/:id` fallbacks with safe error handling and offline cleanup
- **`src/components/PurchaseHistory.jsx` & `src/pages/billing.css`** – Web View Redesign & Master-Detail Workspace:
  - Replaced the narrow 640px mobile drawer on desktop with a spacious, centered dashboard modal dialog (`width: min(1380px, 96vw)`, `height: min(90vh, 900px)`).
  - Implemented a two-column Master-Detail workspace layout for web view (`min-width: 768px`):
    - **Left Master Stream (`history-web-list-col`)**: Sleek order list with selection indicator, status pills, customer name, mobile, item count, and bold totals. Accordion expansion is cleanly suppressed on web so the list stays fast, clean, and scannable.
    - **Right Document Inspector (`history-web-detail-col`)**: Full-fidelity bill/quotation inspector with Hero header card, large document type badge (`SALES INVOICE` vs `ESTIMATE QUOTATION`), quick order number copy button, and bold Net Payable card.
    - **Full Action Toolbar**: Spacious, accessible buttons with zero horizontal clipping or cut-off (`Print Bill / Estimate`, `Share WhatsApp`, `Edit Bill Data`, `Convert to Order`, `Load to Active Cart`, and `Delete Estimate`).
    - **Information Cards & Items Table**: 2-column customer details card with clickable `tel:` phone call link, payment & referral details, prominent requirement note alert banner, enterprise-grade items table with monospace product code tags, and comprehensive financial breakdown.
    - Added `flex-wrap: wrap;` and min-width to mobile action buttons to eliminate button clipping across all viewport sizes.
  - **Mobile Purchase History Tabs & Controls Redesign (`@media (max-width: 767px)`)**:
    - Extracted and defined comprehensive base styling for `.history-tab-btn`, `.history-type-tabs`, `.history-top-controls-bar`, and search box so mobile and web share a robust design system.
    - Implemented segmented pill tabs on mobile with `flex: 1 1 0 !important;` so `All`, `Sales`, and `Estimates` fit perfectly side-by-side without horizontal wrapping or overflow.
    - Added responsive tab labels: `<span className="tab-lbl-short">Estimates</span>` / `<span className="tab-lbl-short">Sales</span>` on mobile, while preserving full names (`Estimates / Quotations` / `Sales Invoices`) on desktop.
    - Applied distinctive color branding for `.history-tab-btn.estimates` (soft blue tint when inactive, vibrant blue gradient with shadow when active) and `.history-tab-btn.sales` (emerald tint and active gradient).
  - **Order Payment Status Editing in Purchase History**:
    - Added Payment Status editing in both Mobile accordion (`history-edit-form`) and Web Document Inspector (`Payment & Referral Details` card).
    - Supports 5 selectable payment statuses: **PAID**, **PARTIAL**, **UNPAID / PENDING**, **REFUNDED**, and **FAILED**.
    - When selecting **PARTIAL**, dynamically provides a numeric `Paid Amount (₹)` input field with automatic `balanceDue` recalculation.
    - Automatic state transitions: selecting **PAID** zeroes out balance due; selecting **UNPAID** or **FAILED** sets paid amount to 0; selecting **REFUNDED** marks refunded status.
    - Extended `.payment-status-badge` styling with dedicated colors: Emerald for `PAID`, Amber for `PARTIAL`, Crimson for `FAILED`/`UNPAID`, and Purple for `REFUNDED` with dark mode support.
    - Updated `orderService.js` and local `billing_orders` synchronization to persist `payment_status`, `paymentStatus`, `paid_amount`, and `balance_due`.

  - **Admin / ProERP Stock Control Modal Redesign (`billing.jsx` & `billing.css`)**:
    - Replaced unstyled, cramped layout with a modern ProERP enterprise modal dialog (`max-width: 480px`, rounded 20px, backdrop blur, enter animations).
    - **Header**: Added ProERP Live Sync badge with glowing emerald status indicator, Admin Stock Control tag, product name + `#CODE` monospace tag, and dedicated `X` close button with `Esc` key shortcut support.
    - **Live Stock & Packaging Stat Cards**: Two-column dashboard cards displaying current stock with big bold numbers, dynamic `In Stock` / `Out of Stock` pills, and packaging specs with box icons.
    - **Segmented Mode Switcher**: Clean pill-style toggle between `➕ Add to Stock (+)` (Restock / Inward) and `🎯 Set Exact Stock (=)` (Audit / Physical Count) with helpful contextual hints.
    - **Quick Add Presets**: Styled pill buttons (`+5`, `+10`, `+25`, `+50`, `+100`) with active highlight states and hover animations.
    - **Quantity Stepper Input**: Enhanced numeric input group with `+` / `=` sign indicator, focus ring, and quick decrement/increment stepper buttons (`-` and `+`).
    - **Live Projected Stock Preview Card**: Clean calculation card with individual badges for Current, Adding, and New Balance, plus instant ProERP cloud synchronization note.
    - **Notice Banners & Action Buttons**: Polished success/warning/error banners with icons, neutral Cancel button, and vibrant ProERP Save button with animated loading spinner.
    - Full Light and Dark Mode support.

  - **Complete Removal of Mock Data**:
    - Purged static mock catalog, categories, unsplash images, mock pricing, and mock stock generators from `src/data/products.js`.
    - Created lightweight `src/utils/imageUtils.js` with pure SVG fallback generator (`getImageSVG`) without any hardcoded product lists.
    - Updated `src/services/productService.js` to rely exclusively on the live `/products` API backend and import SVG generator from `imageUtils`.
    - Cleaned `src/services/orderService.js` to eliminate static mock product imports and fallbacks; item enrichment now matches directly against the live product catalog.
    - Updated `src/context/CartContext.js` to initialize saved cart items and load orders directly without referencing static mock product dictionaries.
    - Updated `src/pages/ViewBill.jsx` to parse items from live API orders and shared payload without mock product resolution.
    - Cleaned `src/services/referralService.js` by removing hardcoded test referral codes (`LEN389MG`, `RAJ3210XF`); referral codes are now strictly verified against live backend endpoints.
    - Cleaned `src/services/config.js` default shop details to remove mock placeholder strings (`'test gst'`, `'test license'`).
    - Updated referral input placeholders in `checkout.jsx` and `CurrentOrderPanel.jsx` to neutral prompt text.

  - **Removal of Mock Login Token & Auto-Login Calls**:
    - Purged hardcoded login credentials (`shivacrackers@gmail.com` / `12345678`) and automatic `/Adminlogin` background acquisition from `src/services/apiClient.js`.
    - Removed redundant manual token acquisition lines from `orderService.js` and `referralService.js`.
    - Authentication is strictly user-driven via `/billing/login` using `authService.login()`; all API requests dynamically attach the authentic `auth_token` stored from legitimate user login.
    - If a session expires or returns 401/403, `apiClient` cleanly purges stale credentials and redirects to `/billing/login` instead of fabricating fake credentials.
    - **Staff Login via Email ID**: Staff and Admin login now strictly applies the user's **Email ID** rather than arbitrary usernames, featuring email regex validation, email input type, dedicated `<Mail />` iconography, and automatic lowercase normalization across `login.jsx` and `authService.staffLogin()`.

  - **Full ProERP API Integration Across Project**:
    - **ProERP Products & Catalog (`GET /products`)**: Real-time product catalog fetching with dynamic `product_code`, packaging specs (`pack_quantity`, `type`, `height`), live `stock_count` resolution, and ProERP metadata synchronization.
    - **ProERP Cloud Stock Updates (`PUT /products/:id`)**: Instant inventory synchronization from the Admin Stock Control modal directly updating the ProERP cloud database.
    - **ProERP Categories (`GET /category`)**: Live category list fetching and dynamic sidebar filtering.
    - **ProERP Discounts (`GET /discounts`)**: Real-time offer fetching.
    - **ProERP Offline Sales Orders (`POST /orders/offline` & `GET /orders/offline`)**: Official sales order creation with full items array, customer metadata, and transaction history.
    - **ProERP Quotation Estimates (`POST /orders/estimates` & `GET /orders/estimates`)**: Live estimation quotation management with seamless deletion (`DELETE /order/estimates/:id`).
    - **ProERP Referral Partner Verification (`GET /referrals/code/:code`)**: Live referral partner validation and commission discount computation.

  - **Purchase History – 100% Live API Data**:
    - Purged local `billing_orders` injection from `PurchaseHistory.jsx`'s `fetchOrders()`.
    - Purchase History now fetches and displays **strictly authoritative live data from backend GET APIs**:
      - Sales orders via `orderService.getOfflineOrders()` (`GET /orders/offline`)
      - Estimate quotations via `orderService.getEstimateOrders()` (`GET /orders/estimates`)
    - Stale or mock local storage records are no longer merged into the order list stream, ensuring the table matches only real server transactions.

  - **Removal of `x-shop-domain` Header**:
    - Purged the `'x-shop-domain'` header from `src/services/apiClient.js` default request headers so requests rely strictly on standard headers and Bearer authentication token.

  - **Complete User Logout & Token Purge**:
    - Enhanced `authService.logout()` to completely remove all authentication credentials and tokens (`auth_token`, `token`, `bmes_logged_in`, `user_info`, `user_role`, `auth_email`, `auth_password`).
    - Flushes all session state using `sessionStorage.clear()`.
    - Resets in-memory catalog caches via `productService.clearCache()`.
    - Hardened route protection in `src/App.js` (`ProtectedRoute`) and `src/pages/login.jsx` so unauthenticated users without an authentic `auth_token` cannot access billing or checkout routes and are immediately redirected to `/billing/login`.
    - Enhanced `handleUnauthorizedSession()` in `apiClient.js` with identical thorough cleanup on expired or 401/403 sessions.

  - **WhatsApp Share – Text Receipt Format (No URL Link)**:
    - Removed URL/link from WhatsApp sharing in both `SuccessModal.jsx` and `PurchaseHistory.jsx`.
    - Formatted comprehensive, readable text receipts containing Store details, Bill/Estimate No, Date, Customer info, Requirement Note / Remark, full itemized breakdown (items, qty, rates), subtotal, discounts, GST/tax, net total, and payment status.

## Running
- Frontend dev: `npm start` (port 3000)
- Backend: `cd server && node server.js` (port 5000)
- Production build: `npm run build`, then serve via `node server/server.js`



