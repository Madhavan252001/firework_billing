import { getShopDetails } from '../services';

// Thermal/printer apps may not support the Unicode rupee glyph (₹) and can
// decode it as a character such as Z or 2. Keep the on-screen formatter intact
// and use an ASCII-only currency label for printable receipts.
const printFmt = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const sellingPriceOf = (item) => Number(item.discountedPrice ?? item.price ?? item.unit_price ?? 0);
const originalPriceOf = (item) => Number(item.originalPrice ?? item.original_price ?? item.mrp ?? item.mrp_price ?? sellingPriceOf(item));
const printPriceTotals = (orderData) => {
  const items = orderData.items || [];
  const sellingTotal = Number(orderData.subtotal) || items.reduce((sum, item) => sum + sellingPriceOf(item) * Number(item.quantity || 1), 0);
  const originalTotal = Number(orderData.originalSubtotal ?? orderData.original_subtotal) || items.reduce((sum, item) => sum + originalPriceOf(item) * Number(item.quantity || 1), 0);
  return { sellingTotal, originalTotal: Math.max(originalTotal, sellingTotal) };
};

export function generateInvoiceCopyHtml(orderData, copyLabel) {
  const shopDetails = getShopDetails(orderData);
  const isCredit = orderData.paymentType === 'credit';
  const isEstimate = Boolean(
    orderData.is_estimate === '1' ||
    orderData.is_estimate === 1 ||
    orderData.is_estimate === true ||
    orderData.isEstimate ||
    orderData.order_type === 'estimate'
  );
  const items = orderData.items || [];
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const { sellingTotal: subtotal, originalTotal } = printPriceTotals(orderData);
  const gstAmount = Number(orderData.gstAmount || 0);
  const gstPercent = Number(
    orderData.taxPercentage ??
    orderData.tax_percentage ??
    orderData.gstPercentage ??
    orderData.gst_percentage ??
    (orderData.gst?.percentage) ??
    18
  );
  const discountAmount = Number(orderData.discountAmount || 0);
  const grandTotal = Number(orderData.grandTotal || orderData.total) || Math.max(0, subtotal + gstAmount - discountAmount);
  const custName = orderData.customer?.name || orderData.customer_name || 'Walk-in Customer';
  const custMobile = orderData.customer?.mobile || orderData.customer_mobile || '-';
  const reqNote = (orderData.requirement_note || orderData.requirementNote || orderData.notes || orderData.order_notes || orderData.note || orderData.remark || '').trim();

  const refPercent = Number(orderData.referral_customer_discount || orderData.referralDiscountPercentage || 0);
  let refDisc = Number(orderData.referralDiscountAmount || orderData.referral_discount_amount || 0);
  if (refDisc <= 0 && refPercent > 0) {
    refDisc = (subtotal * refPercent) / 100;
  }
  const otherDiscount = Math.max(0, discountAmount - refDisc);

  const itemsHtml = items.map((item, idx) => {
    const pCode = item.product_code || item.code ? `[${item.product_code || item.code}] ` : '';
    const sellingPrice = sellingPriceOf(item);
    const originalPrice = originalPriceOf(item);
    return `
    <div class="invoice-row">
      <span>${idx + 1}. ${pCode}${item.name} x${item.quantity}<small class="invoice-selling-label">Selling ${printFmt(sellingPrice)}${originalPrice > sellingPrice ? ` (Original ${printFmt(originalPrice)})` : ''}</small></span>
      <span>${printFmt(sellingPrice * item.quantity)}</span>
    </div>
  `;
  }).join('');

  const displayCopyLabel = isEstimate ? 'ESTIMATE BILL (NOT A TAX INVOICE)' : copyLabel;

  return `
    <div class="invoice-copy">
      <div class="invoice-copy-label">${displayCopyLabel}</div>
      <div class="invoice-header">
        ${shopDetails.footer_logo_url ? `
        <div class="invoice-logo">
          <img src="${shopDetails.footer_logo_url}" alt="${shopDetails.shop_name}" />
        </div>` : ''}
        <h2>${shopDetails.shop_name}</h2>
        <p>${shopDetails.address}</p>
        ${shopDetails.gst_no ? `<p>GSTIN: ${shopDetails.gst_no}</p>` : ''}
        ${shopDetails.license_no ? `<p>Lic No: ${shopDetails.license_no}</p>` : ''}
        ${shopDetails.phone || shopDetails.mobile || shopDetails.mobile_no ? `<p>Store Mobile: ${shopDetails.phone || shopDetails.mobile || shopDetails.mobile_no}</p>` : ''}
      </div>
      <div class="invoice-divider"></div>
      <div class="invoice-row"><span>${isEstimate ? 'Estimate No' : 'Order'}: ${orderData.orderNumber || orderData.order_no || ''}</span></div>
      <div class="invoice-row"><span>Date: ${orderData.date || ''}</span></div>
      <div class="invoice-row"><span>Customer: ${custName}</span></div>
      <div class="invoice-row"><span>Mobile: ${custMobile}</span></div>
      ${(orderData.referral_code || orderData.referralCode) ? `
      <div class="invoice-row">
        <span>Referral Code</span>
        <span>${orderData.referral_code || orderData.referralCode} (${refPercent}% off)</span>
      </div>` : ''}
      ${reqNote ? `
      <div class="invoice-requirement-row">
        <div class="invoice-requirement-title">${isEstimate ? 'Estimate Remark / Note:' : 'Requirement Note:'}</div>
        <div class="invoice-requirement-text">${reqNote}</div>
      </div>` : ''}
      <div class="invoice-row"><span>Products: ${items.length}</span><span>Total Qty: ${totalQuantity}</span></div>
      <div class="invoice-divider"></div>
      <div class="invoice-item invoice-item-header">Items:</div>
      ${itemsHtml}
      <div class="invoice-divider"></div>
      <div class="invoice-row"><span>Original Price Total</span><span>${printFmt(originalTotal)}</span></div>
      <div class="invoice-row"><span>Selling Price Total</span><span>${printFmt(subtotal)}</span></div>
      ${refDisc > 0 ? `
      <div class="invoice-row">
        <span>Referral Discount (${refPercent}%)</span>
        <span>-${printFmt(refDisc)}</span>
      </div>` : (orderData.referral_code || orderData.referralCode) ? `
      <div class="invoice-row">
        <span>Referral (${orderData.referral_code || orderData.referralCode})</span>
        <span>${refPercent}%</span>
      </div>` : ''}
      ${gstAmount > 0 ? `<div class="invoice-row"><span>GST (${gstPercent}%)</span><span>${printFmt(gstAmount)}</span></div>` : ''}
      ${otherDiscount > 0 ? `<div class="invoice-row"><span>${refDisc > 0 ? 'Other Discount' : 'Discount'}</span><span>-${printFmt(otherDiscount)}</span></div>` : ''}
      <div class="invoice-row invoice-total"><span>${isEstimate ? 'Estimate Total' : 'Total'}</span><span>${printFmt(grandTotal)}</span></div>
      ${!isEstimate && isCredit ? `<div class="invoice-row"><strong>Amount Paid</strong><strong>${printFmt(orderData.paidAmount || 0)}</strong></div>` : ''}
      ${!isEstimate && isCredit ? `<div class="invoice-row invoice-total"><span>Balance Due</span><span>${printFmt(orderData.balanceDue || 0)}</span></div>` : ''}
      <div class="invoice-row"><span>Payment: ${orderData.paymentMethod || 'Cash'}</span></div>
      <div class="invoice-row"><span>Type: ${isEstimate ? 'ESTIMATE / QUOTATION' : (isCredit ? 'CREDIT' : 'FULL PAYMENT')}</span></div>
      <div class="invoice-divider"></div>
      <div class="invoice-footer">
        <p>${isEstimate ? 'This is an estimate only, not a tax invoice. Prices are subject to confirmation.' : (copyLabel === 'DELIVERY COPY' ? 'Goods dispatched in good condition' : (isCredit ? 'Please retain this bill until the balance is paid.' : 'Thank you for your purchase!'))}</p>
        <p>Visit us again at ${shopDetails.shop_name}</p>
      </div>
    </div>
  `;
}

export function printSingleBill(orderData) {
  if (!orderData) return;
  const isEstimate = Boolean(
    orderData.is_estimate === '1' ||
    orderData.is_estimate === 1 ||
    orderData.is_estimate === true ||
    orderData.isEstimate ||
    orderData.order_type === 'estimate'
  );
  const copyTitle = isEstimate ? 'ESTIMATE BILL (NOT A TAX INVOICE)' : 'CUSTOMER COPY';
  const customerCopy = generateInvoiceCopyHtml(orderData, copyTitle);

  const printStyles = `
    @page { margin: 3mm; size: auto; }
    * { 
      box-sizing: border-box; 
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
      margin: 0; 
      padding: 10px; 
      color: #000000 !important; 
      background: #ffffff !important; 
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      line-height: 1.35;
      font-size: 12.5px;
      font-weight: 600;
    }
    .invoice-wrap { max-width: 320px; margin: 0 auto; color: #000000 !important; }
    .invoice-copy { width: 100%; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; color: #000000 !important; }
    .invoice-copy-label { 
      text-align: center; 
      border: 1.5px solid #000000 !important; 
      padding: 3px 6px; 
      margin-bottom: 8px; 
      font-size: 12px; 
      font-weight: 800; 
      letter-spacing: 0.5px; 
      color: #000000 !important;
    }
    .invoice-header { text-align: center; margin-bottom: 8px; color: #000000 !important; }
    .invoice-logo { text-align: center; margin-bottom: 6px; }
    .invoice-logo img { max-height: 55px; max-width: 140px; object-fit: contain; display: block; margin: 0 auto; }
    .invoice-header h2 { margin: 0 0 2px; font-size: 17px; font-weight: 800; letter-spacing: -0.2px; color: #000000 !important; }
    .invoice-header p { margin: 1.5px 0; font-size: 12px; font-weight: 600; color: #000000 !important; }
    .invoice-divider { border-top: 1.5px dashed #000000 !important; margin: 7px 0; }
    .invoice-requirement-row {
      margin: 5px 0 6px;
      padding: 4px 6px;
      border: 1px dashed #000000 !important;
      border-radius: 4px;
      background: #fafafa !important;
      font-size: 11.5px;
      line-height: 1.3;
    }
    .invoice-requirement-title {
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
      color: #000000 !important;
    }
    .invoice-requirement-text {
      font-weight: 600;
      word-break: break-word;
      color: #000000 !important;
    }
    .invoice-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 600; padding: 1.5px 0; line-height: 1.35; color: #000000 !important; }
    .invoice-selling-label { display: block; font-size: 9px; font-weight: 500; color: #555 !important; }
    .invoice-row span, .invoice-row strong { color: #000000 !important; }
    .invoice-item { font-size: 12px; font-weight: 600; padding: 2px 0; color: #000000 !important; }
    .invoice-item-header { font-weight: 800; font-size: 13px; margin-bottom: 2px; color: #000000 !important; }
    .invoice-total { font-weight: 900; font-size: 14.5px; color: #000000 !important; }
    .invoice-total span, .invoice-total strong { font-weight: 900; font-size: 14.5px; color: #000000 !important; }
    .invoice-footer { text-align: center; margin-top: 8px; font-size: 12px; font-weight: 600; color: #000000 !important; }
    .invoice-footer p { margin: 2px 0; color: #000000 !important; font-weight: 600; }
    .invoice-footer-logo img { max-height: 48px; max-width: 150px; object-fit: contain; }
    @media print { 
      body { padding: 0; margin: 0; color: #000000 !important; } 
      * { color: #000000 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      .invoice-copy { page-break-inside: avoid; break-inside: avoid; }
    }
  `;

  const fullHtml = `<!DOCTYPE html><html><head><title>Invoice - ${orderData.orderNumber || 'Print'}</title><style>${printStyles}</style></head><body><div class="invoice-wrap">${customerCopy}</div></body></html>`;

  // 1. Try on-page hidden iframe printing (instant, directly on current page, no popup window)
  try {
    let iframe = document.getElementById('print-invoice-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-invoice-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          fallbackPrintWindow(fullHtml);
        }
      }, 300);
      return;
    }
  } catch (err) {
    console.warn('On-page iframe print failed, falling back to window.open', err);
  }

  // 2. Fallback to popup window if iframe is not allowed
  fallbackPrintWindow(fullHtml);
}

function fallbackPrintWindow(fullHtml) {
  const win = window.open('', '_blank');
  if (!win) {
    window.print();
    return;
  }
  win.document.write(`${fullHtml}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},250);};</script>`);
  win.document.close();
}

export const printBill = printSingleBill;
export const printThreeBills = printSingleBill;
export const printTwoBills = printSingleBill;

// A4 stationery layout.  The thermal receipt above intentionally remains
// unchanged; this is a separate print path for full-page invoices/quotations.
export function generateA4BillHtml(orderData) {
  const shop = getShopDetails(orderData);
  const isEstimate = Boolean(
    orderData.is_estimate === '1' || orderData.is_estimate === 1 ||
    orderData.is_estimate === true || orderData.isEstimate ||
    orderData.order_type === 'estimate'
  );
  const items = orderData.items || [];
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 1), 0);
  const customer = orderData.customer || {};
  const customerName = customer.name || orderData.customer_name || 'Walk-in Customer';
  const customerMobile = customer.mobile || orderData.customer_mobile || '-';
  const address = customer.address || orderData.address || '';
  const postalCode = customer.postalcode || customer.postal_code || orderData.postalcode || '';
  const orderNo = orderData.orderNumber || orderData.order_no || orderData.id || '-';
  const date = orderData.date || orderData.created_at || new Date().toLocaleString('en-IN');
  const status = String(orderData.paymentStatus || orderData.payment_status || (orderData.paymentMethod ? 'pending' : 'pending')).toUpperCase();
  const payment = String(orderData.paymentMethod || orderData.payment_method || 'COD').toUpperCase();
  const { sellingTotal: subtotal, originalTotal } = printPriceTotals(orderData);
  const gst = Number(orderData.gstAmount ?? orderData.taxAmount ?? orderData.tax_amount ?? 0);
  const taxPercent = Number(orderData.taxPercentage ?? orderData.tax_percentage ?? orderData.gstPercentage ?? orderData.gst_percentage ?? 0);
  const discount = Number(orderData.discountAmount ?? orderData.discount_amount ?? orderData.basicDiscountAmount ?? 0);
  const total = Number(orderData.grandTotal ?? orderData.payableAmount ?? orderData.total ?? orderData.total_amount) || Math.max(0, subtotal + gst - discount);
  const note = (orderData.requirement_note || orderData.requirementNote || orderData.remark || orderData.notes || '').trim();
  const phone = shop.phone || shop.mobile || shop.mobile_no || '';

  const rows = items.map((item, index) => {
    const qty = Number(item.quantity || item.qty || 1);
    const rate = Number(item.discountedPrice ?? item.price ?? item.unit_price ?? 0);
    const name = item.name || item.product_name || `Item ${index + 1}`;
    const code = item.product_code || item.code || '';
    const originalRate = originalPriceOf(item);
    return `<tr><td class="a4-sno">${index + 1}</td><td class="a4-description"><strong>${name}</strong>${code ? `<small>${code}</small>` : ''}</td><td class="a4-qty">${qty}</td><td class="a4-money">${printFmt(originalRate)}</td><td class="a4-money">${printFmt(rate)}</td><td class="a4-money">${printFmt(rate * qty)}</td></tr>`;
  }).join('');

  return `<section class="a4-sheet ${isEstimate ? 'a4-estimate' : 'a4-sales'}">
    <div class="a4-topline"><span>${new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span><span>Admin Panel - Fireworks POS</span></div>
    <header class="a4-header">
      ${shop.footer_logo_url ? `<img class="a4-logo" src="${shop.footer_logo_url}" alt="${shop.shop_name}" />` : ''}
      <h1>${shop.shop_name || 'SUBITAS CRACKERS'}</h1>
      <p>${shop.address || ''}</p>
      <p>${shop.gst_no ? `GST: ${shop.gst_no}` : ''}${shop.gst_no && shop.license_no ? ' | ' : ''}${shop.license_no ? `License: ${shop.license_no}` : ''}</p>
    </header>
    <div class="a4-rule"></div>
    <div class="a4-meta-head"><div><b>${isEstimate ? 'ESTIMATE QUOTATION' : 'TAX INVOICE'}</b><strong>${orderNo}</strong></div><div class="a4-meta-right"><span>Date <b>${date}</b></span><span>Payment <b>${payment}</b></span></div></div>
    <div class="a4-count-summary"><span><b>PRODUCTS</b> ${items.length}</span><span><b>TOTAL QTY</b> ${totalQuantity}</span></div>
    <div class="a4-customer-block"><div><label>BILL TO</label><strong>${customerName}</strong><span>${customerMobile}</span><span>${address}${postalCode ? `, ${postalCode}` : ''}</span></div><div class="a4-status"><label>PAYMENT<br/>STATUS</label><b>${isEstimate ? 'QUOTATION' : status}</b></div></div>
    ${note ? `<div class="a4-note"><b>${isEstimate ? 'REMARK / NOTE' : 'REQUIREMENT NOTE'}</b><span>${note}</span></div>` : ''}
    <table class="a4-items"><thead><tr><th>#</th><th>ITEM DESCRIPTION</th><th>QTY</th><th>ORIGINAL PRICE</th><th>SELLING RATE</th><th>AMOUNT</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="a4-empty">No items found</td></tr>'}</tbody></table>
    <div class="a4-summary"><div><span>Original Price Total</span><b>${printFmt(originalTotal)}</b></div><div><span>Selling Price Total</span><b>${printFmt(subtotal)}</b></div>${discount > 0 ? `<div><span>Additional Discount</span><b>- ${printFmt(discount)}</b></div>` : ''}${gst > 0 ? `<div><span>GST (${taxPercent}%)</span><b>${printFmt(gst)}</b></div>` : ''}<div class="a4-grand"><span>${isEstimate ? 'ESTIMATE TOTAL' : 'NET PAYABLE'}</span><b>${printFmt(total)}</b></div></div>
    <footer class="a4-footer"><span>${phone ? `${phone} | ` : ''}${shop.shop_name || 'Fireworks POS'}</span><span>Page <span class="a4-page-number"></span></span></footer>
  </section>`;
}

export function printA4Bill(orderData) {
  if (!orderData) return;
  const styles = `
    @page { size: A4 portrait; margin: 11mm 12mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    body { font-size: 9.5px; }
    .a4-sheet { width: 100%; min-height: 271mm; position: relative; padding-bottom: 12mm; }
    .a4-topline { display:flex; justify-content:space-between; font-size:8px; margin-bottom:8mm; color:#111827; }
    .a4-header { text-align:center; }
    .a4-logo { width:auto; max-width:44mm; height:16mm; object-fit:contain; display:block; margin:0 auto 2mm; }
    .a4-header h1 { margin:0; font-size:20px; letter-spacing:.2px; color:#111827; }
    .a4-header p { margin:1mm 0 0; font-size:8.5px; color:#374151; }
    .a4-rule { border-top:1px dashed #9ca3af; margin:3mm 0 2.5mm; }
    .a4-meta-head { display:flex; justify-content:space-between; align-items:flex-start; min-height:13mm; }
    .a4-meta-head b { display:block; font-size:8px; letter-spacing:.8px; color:#6b7280; }
    .a4-meta-head strong { display:block; margin-top:1.5mm; font-size:15px; color:#111827; }
    .a4-meta-right { display:flex; flex-direction:column; align-items:flex-end; gap:1.5mm; font-size:8.5px; color:#6b7280; }
    .a4-meta-right b { display:inline; margin-left:5mm; font-size:8.5px; color:#111827; letter-spacing:0; }
    .a4-count-summary { display:flex; gap:8mm; align-items:center; border:1px solid #d1d5db; background:#f9fafb; padding:2.2mm 3mm; margin:1mm 0 3mm; font-size:8.5px; color:#374151; }
    .a4-count-summary b { margin-right:2mm; font-size:7px; letter-spacing:.7px; color:#6b7280; }
    .a4-customer-block { border-top:1px solid #d1d5db; border-bottom:1px dashed #9ca3af; padding:3mm 0; display:flex; justify-content:space-between; min-height:25mm; }
    .a4-customer-block label, .a4-status label { display:block; font-size:7px; font-weight:700; letter-spacing:.8px; color:#6b7280; margin-bottom:1mm; }
    .a4-customer-block strong, .a4-customer-block span { display:block; max-width:115mm; font-size:9px; line-height:1.35; color:#374151; }
    .a4-customer-block strong { color:#111827; font-size:10px; }
    .a4-status { text-align:right; min-width:25mm; }
    .a4-status b { border:1px solid #9ca3af; border-radius:2px; padding:1.5mm 2mm; font-size:7px; display:inline-block; color:#111827; }
    .a4-note { margin:3mm 0; padding:2mm 3mm; border:1px dashed #9ca3af; display:flex; gap:5mm; font-size:8.5px; }
    .a4-note b { font-size:7px; letter-spacing:.6px; color:#6b7280; white-space:nowrap; }
    .a4-items { width:100%; border-collapse:collapse; table-layout:fixed; margin-top:4mm; }
    .a4-items thead { border-top:1px dashed #9ca3af; border-bottom:1px solid #111827; }
    .a4-items th { padding:2.5mm 1.5mm; text-align:left; font-size:7px; letter-spacing:.2px; color:#111827; }
    .a4-items th:nth-child(1) { width:6%; text-align:center; } .a4-items th:nth-child(2) { width:40%; } .a4-items th:nth-child(3) { width:9%; text-align:center; } .a4-items th:nth-child(4), .a4-items th:nth-child(5), .a4-items th:nth-child(6) { width:15%; text-align:right; }
    .a4-items td { padding:2.1mm 1.5mm; border-bottom:1px dotted #cbd5e1; font-size:8.5px; color:#1f2937; vertical-align:top; }
    .a4-sno, .a4-qty { text-align:center; } .a4-money { text-align:right; white-space:nowrap; }
    .a4-description strong { display:block; font-size:8.5px; } .a4-description small { display:block; font-size:7px; color:#6b7280; margin-top:.5mm; }
    .a4-items thead { display:table-header-group; } .a4-items tr { page-break-inside:avoid; }
    .a4-empty { text-align:center; padding:8mm !important; }
    .a4-summary { width:58mm; margin:4mm 0 0 auto; font-size:8.5px; }
    .a4-summary > div { display:flex; justify-content:space-between; padding:1.2mm 0; }
    .a4-summary b { color:#111827; } .a4-grand { border-top:1px solid #111827; margin-top:1mm; padding-top:2mm !important; font-size:9px; font-weight:700; }
    .a4-footer { position:fixed; left:12mm; right:12mm; bottom:5mm; display:flex; justify-content:space-between; font-size:7px; color:#374151; }
    .a4-page-number:after { content: counter(page) "/" counter(pages); }
    @media screen { body { padding:20px; background:#e5e7eb; } .a4-sheet { background:#fff; width:210mm; min-height:297mm; margin:auto; padding:11mm 12mm 15mm; box-shadow:0 2px 15px #0002; } }
  `;
  const html = `<!doctype html><html><head><title>${orderData.orderNumber || 'Bill'} - A4</title><style>${styles}</style></head><body>${generateA4BillHtml(orderData)}</body></html>`;
  try {
    let iframe = document.getElementById('print-a4-invoice-iframe');
    if (!iframe) { iframe = document.createElement('iframe'); iframe.id = 'print-a4-invoice-iframe'; Object.assign(iframe.style, { position:'fixed', right:'0', bottom:'0', width:'0', height:'0', border:'0', opacity:'0', pointerEvents:'none' }); document.body.appendChild(iframe); }
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) { doc.open(); doc.write(html); doc.close(); setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 350); return; }
  } catch (err) { console.warn('A4 iframe print failed:', err); }
  fallbackPrintWindow(html);
}

