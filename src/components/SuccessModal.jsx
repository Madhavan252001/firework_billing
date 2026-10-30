import React, { useState } from 'react';
import { CheckCircle2, MessageCircle, Printer, X, Copy, Check } from 'lucide-react';
import { fmt } from '../context/CartContext';
import { getShopName, getShopDetails } from '../services';
import { printThreeBills, printA4Bill } from '../utils/printUtils';

const STORE_ADDRESS = 'Enamel Factory Road, Mettupatti, Dindigul - 624002';
const STORE_GST_NUMBER = '33ABCDE1234F1Z5';
const BILL_PAGE_SIZE = 12;

export default function SuccessModal({ orderData, onClose }) {
  const invoiceRef = React.useRef(null);
  const [copied, setCopied] = useState(false);
  const isCredit = orderData.paymentType === 'credit';
  const isEstimate = Boolean(
    orderData.is_estimate === '1' ||
    orderData.is_estimate === 1 ||
    orderData.is_estimate === true ||
    orderData.isEstimate ||
    orderData.order_type === 'estimate'
  );
  const totalQuantity = (orderData.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const shopDetails = getShopDetails(orderData);

  const handlePrint = () => {
    printThreeBills(orderData);
  };

  const handleA4Print = () => printA4Bill(orderData);

  const getCleanBillLink = () => {
    const origin = window.location.origin;
    const orderIdentifier = orderData.orderNumber || orderData.order_no || orderData.id;
    return `${origin}/billing/bill/${encodeURIComponent(orderIdentifier)}`;
  };

  const handleShareBill = () => {
    try {
      const mobile = String(orderData.customer?.mobile || orderData.customer_mobile || '').replace(/\D/g, '');
      const whatsappNumber = mobile.length === 10 ? `91${mobile}` : mobile;
      
      // Save order in localStorage so it can be fetched via short URL
      const existingOrders = JSON.parse(localStorage.getItem('billing_orders') || '[]');
      const orderExists = existingOrders.some(o => o.orderNumber === orderData.orderNumber);
      if (!orderExists) {
        existingOrders.push(orderData);
        localStorage.setItem('billing_orders', JSON.stringify(existingOrders));
      }

      const shopDisplayName = (shopDetails.shop_name || getShopName() || 'FIREWORKS').toUpperCase();
      const orderNum = orderData.orderNumber || orderData.order_no || orderData.id || '';
      const custName = orderData.customer?.name || orderData.customer_name || 'Customer';
      const custMobile = orderData.customer?.mobile || orderData.customer_mobile || '';
      const orderDate = orderData.date || (orderData.created_at ? new Date(orderData.created_at).toLocaleString('en-IN') : new Date().toLocaleDateString('en-IN'));
      const reqNote = (orderData.requirement_note || orderData.requirementNote || orderData.order_notes || orderData.notes || orderData.remark || '').trim();

      const itemsList = (orderData.items || []).map((item, idx) => {
        const itemName = item.name || item.product_name || `Item ${idx + 1}`;
        const qty = Number(item.quantity ?? item.qty ?? 1);
        const price = Number(item.price ?? item.discountedPrice ?? item.unit_price ?? 0);
        const itemTotal = Number(item.total ?? item.total_price ?? (price * qty));
        return `${idx + 1}. *${itemName}* x ${qty} = ₹${itemTotal.toLocaleString('en-IN')}`;
      });

      const subtotal = Number(orderData.subtotal || 0);
      const discount = Number(orderData.discountAmount ?? orderData.basicDiscountAmount ?? orderData.discount_amount ?? 0);
      const tax = Number(orderData.taxAmount ?? orderData.gstAmount ?? orderData.tax_amount ?? 0);
      const grandTotal = Number(orderData.grandTotal ?? orderData.payableAmount ?? orderData.total_amount ?? 0);
      const paid = Number(orderData.paidAmount ?? grandTotal);
      const balance = Number(orderData.balanceDue ?? orderData.remaing_amount ?? 0);
      const payMethod = orderData.paymentMethod || orderData.payment_method;

      const lines = [
        `🎆 *${shopDisplayName}* 🎆`,
        `*${isEstimate ? 'ESTIMATE / QUOTATION' : 'SALES INVOICE / BILL'}*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `📄 *${isEstimate ? 'Estimate No' : 'Bill No'}:* ${orderNum}`,
        `📅 *Date:* ${orderDate}`,
        `👤 *Customer:* ${custName}${custMobile ? ` (${custMobile})` : ''}`,
        reqNote ? `📝 *${isEstimate ? 'Remark' : 'Note'}:* ${reqNote}` : '',
        `━━━━━━━━━━━━━━━━━━━━`,
        `🛒 *ITEMS ORDERED (${(orderData.items || []).length} items / ${totalQuantity} qty):*`,
        ...itemsList,
        `━━━━━━━━━━━━━━━━━━━━`,
        subtotal > 0 ? `*Subtotal:* ₹${subtotal.toLocaleString('en-IN')}` : '',
        discount > 0 ? `*Discount:* -₹${discount.toLocaleString('en-IN')}` : '',
        tax > 0 ? `*GST / Tax:* +₹${tax.toLocaleString('en-IN')}` : '',
        `*Net Total:* *₹${grandTotal.toLocaleString('en-IN')}*`,
        !isEstimate && payMethod ? `*Payment Mode:* ${payMethod}` : '',
        !isEstimate && paid < grandTotal && balance > 0 ? `*Paid:* ₹${paid.toLocaleString('en-IN')} | *Balance Due:* ₹${balance.toLocaleString('en-IN')}` : '',
        isEstimate ? `\n_Note: This is an estimate only, not a tax invoice._` : '',
        `━━━━━━━━━━━━━━━━━━━━`,
        shopDetails.phone || shopDetails.mobile ? `📞 *Contact:* ${shopDetails.phone || shopDetails.mobile}` : '',
        shopDetails.address ? `📍 *Address:* ${shopDetails.address}` : '',
        shopDetails.gst_no ? `🏢 *GSTIN:* ${shopDetails.gst_no}` : '',
        ``,
        isEstimate ? `Thank you for inquiring with us!` : `Thank you for shopping with us! Have a sparkling day! ✨`,
        `*${shopDetails.shop_name}*`
      ].filter(Boolean);

      const message = lines.join('\n');

      const waUrl = whatsappNumber 
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      window.open(waUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Unable to generate WhatsApp message. Please try again.');
    }
  };

  const handleCopyBillLink = () => {
    try {
      const link = getCleanBillLink();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.warn('Copy link failed:', e);
    }
  };

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) return; };

  React.useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="success-modal clay-card" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="success-mobile-close"
          onClick={onClose}
          aria-label="Close order success"
          title="Close"
        >
          <X size={18} />
        </button>

        {shopDetails.footer_logo_url && (
          <div
            className="success-store-brand"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <img
              src={shopDetails.footer_logo_url}
              alt={shopDetails.shop_name}
              className="success-store-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{
                maxHeight: 52,
                maxWidth: 160,
                objectFit: 'contain',
                marginLeft: 'auto',
                marginRight: 'auto',
                display: 'block',
                background: '#ffffff',
                padding: '6px 14px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
              }}
            />
          </div>
        )}

        <div className="success-icon"><CheckCircle2 size={46} /></div>
        <h2 className="success-title">
          {isEstimate
            ? 'Estimate Successfully Generated'
            : isCredit
            ? 'Credit Order Successfully Processed'
            : 'Order Successfully Processed'}
        </h2>
        <p className="success-order-num">{isEstimate ? 'Estimate No' : 'Order'}: {orderData.orderNumber || orderData.order_no}</p>
        <p className="success-date">{orderData.date}</p>

        {isEstimate && (
          <div className="estimate-notice-badge" style={{
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#2563eb',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12.5,
            fontWeight: 700,
            margin: '0 auto 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span>📄 Quotation / Estimate Only (Stock Not Deducted)</span>
          </div>
        )}

        <div className="success-details">
          <div className="success-detail-row"><span>Customer</span><span>{orderData.customer?.name || orderData.customer_name || 'Walk-in Customer'}</span></div>
          <div className="success-detail-row"><span>Mobile</span><span>{orderData.customer?.mobile || orderData.customer_mobile || '-'}</span></div>
          {(orderData.referral_code || orderData.referralCode) && (
            <div className="success-detail-row referral-detail-row">
              <span>Referral Code</span>
              <span className="success-referral-badge">
                <strong className="referral-code-text">{orderData.referral_code || orderData.referralCode}</strong>
                {Number(orderData.referral_customer_discount || orderData.referralDiscountPercentage || 0) > 0 && (
                  <span className="referral-percent-tag">
                    ({orderData.referral_customer_discount || orderData.referralDiscountPercentage}% off)
                  </span>
                )}
              </span>
            </div>
          )}
          {(orderData.requirement_note || orderData.requirementNote || orderData.order_notes || orderData.notes || orderData.remark) && (
            <div className="success-detail-row note-detail-row">
              <span>{isEstimate ? 'Estimate Remark' : 'Requirement Note'}</span>
              <span className="success-note-text">{orderData.requirement_note || orderData.requirementNote || orderData.order_notes || orderData.notes || orderData.remark}</span>
            </div>
          )}
          <div className="success-detail-row"><span>Payment Mode</span><span className="payment-label-text">{orderData.paymentMethod || orderData.payment_method || 'Cash'}</span></div>
          <div className="success-detail-row"><span>Type</span><span>{isEstimate ? 'Estimate Quotation' : isCredit ? 'Credit' : 'Full Payment'}</span></div>
          <div className="success-detail-row"><span>Products</span><span>{(orderData.items || []).length} items / {totalQuantity} qty</span></div>
        </div>

        <div className="success-summary">
          <div className="success-summary-row"><span>Subtotal</span><span>{fmt(orderData.subtotal)}</span></div>
          {orderData.gstAmount > 0 && (
            <div className="success-summary-row">
              <span>GST ({Number(orderData.taxPercentage ?? orderData.tax_percentage ?? orderData.gstPercentage ?? orderData.gst?.percentage ?? 18)}%)</span>
              <span>{fmt(orderData.gstAmount)}</span>
            </div>
          )}
          {(() => {
            const refPercent = Number(orderData.referral_customer_discount || orderData.referralDiscountPercentage || 0);
            let refDisc = Number(orderData.referralDiscountAmount || orderData.referral_discount_amount || 0);
            if (refDisc <= 0 && refPercent > 0) {
              refDisc = (Number(orderData.subtotal || 0) * refPercent) / 100;
            }
            const totalDisc = Number(orderData.discountAmount || 0);
            const otherDisc = Math.max(0, totalDisc - refDisc);

            return (
              <>
                {refDisc > 0 && (
                  <div className="success-summary-row discount-row referral-discount-row">
                    <span>Referral Discount ({refPercent}%)</span>
                    <span>-{fmt(refDisc)}</span>
                  </div>
                )}
                {otherDisc > 0 && (
                  <div className="success-summary-row discount-row">
                    <span>{refDisc > 0 ? 'Other / Coupon Discount' : 'Discount'}</span>
                    <span>-{fmt(otherDisc)}</span>
                  </div>
                )}
              </>
            );
          })()}
          <div className="success-summary-row success-grand"><span>{isEstimate ? 'Estimate Total' : (isCredit ? 'Total Amount' : 'Total Paid')}</span><span>{fmt(orderData.grandTotal)}</span></div>
          {!isEstimate && isCredit && <div className="success-summary-row success-paid"><span>Amount Paid</span><span>{fmt(orderData.paidAmount)}</span></div>}
          {!isEstimate && isCredit && <div className="success-summary-row success-balance"><span>Balance Due</span><span>{fmt(orderData.balanceDue)}</span></div>}
        </div>

        <div className="success-actions">
          <button className="clay-btn clay-btn-primary" onClick={handlePrint}>
            <Printer size={16} /> {isEstimate ? 'Print Estimate' : 'Print Bill'}
          </button>
          <button className="clay-btn" onClick={handleA4Print}>
            <Printer size={16} /> A4 Sheet
          </button>
          <button className="clay-btn whatsapp-share-btn" onClick={handleShareBill}>
            <MessageCircle size={16} /> {isEstimate ? 'Share Estimate' : 'Share Bill'}
          </button>
          <button className="clay-btn copy-link-btn" onClick={handleCopyBillLink} title="Copy digital bill link">
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
            <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        <div id="printable-invoice" ref={invoiceRef} style={{ display: 'none' }}>
          <InvoiceCopy orderData={orderData} copyLabel="CUSTOMER COPY" />
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
async function createBillPdf(orderData) {
  const { jsPDF } = await import('jspdf');
  const imageBlobs = await createBillImages(orderData);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 6;

  for (let index = 0; index < imageBlobs.length; index += 1) {
    if (index > 0) pdf.addPage('a4', 'portrait');
    const blob = imageBlobs[index];
    const dataUrl = await blobToDataUrl(blob);
    const dimensions = await getImageDimensions(blob);
    const scale = Math.min(
      (pageWidth - (margin * 2)) / dimensions.width,
      (pageHeight - (margin * 2)) / dimensions.height
    );
    const renderWidth = dimensions.width * scale;
    const renderHeight = dimensions.height * scale;
    pdf.addImage(
      dataUrl,
      'PNG',
      (pageWidth - renderWidth) / 2,
      (pageHeight - renderHeight) / 2,
      renderWidth,
      renderHeight,
      undefined,
      'FAST'
    );
  }

  return pdf.output('blob');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function getImageDimensions(blob) {
  if ('createImageBitmap' in window) {
    const bitmap = await window.createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(blob);
    const image = new window.Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(imageUrl);
    };
    image.onerror = error => {
      reject(error);
      URL.revokeObjectURL(imageUrl);
    };
    image.src = imageUrl;
  });
}

// eslint-disable-next-line no-unused-vars
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createBillImages(orderData) {
  if (document.fonts?.ready) await document.fonts.ready;

  const pages = [];
  for (let index = 0; index < orderData.items.length; index += BILL_PAGE_SIZE) {
    pages.push(orderData.items.slice(index, index + BILL_PAGE_SIZE));
  }

  const billImages = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    billImages.push(await createBillImagePage(
      orderData,
      pages[pageIndex],
      pageIndex,
      pages.length,
      pageIndex === pages.length - 1
    ));
  }
  return billImages;
}

async function createBillImagePage(orderData, pageItems, pageIndex, pageCount, showSummary) {
  const summaryRows = showSummary
    ? 2
      + (orderData.gstAmount > 0 ? 1 : 0)
      + (orderData.discountAmount > 0 ? 1 : 0)
      + (orderData.paymentType === 'credit' ? 2 : 0)
    : 0;
  const width = 1080;
  const height = 550 + (pageItems.length * 66) + (summaryRows * 54) + (showSummary ? 210 : 90);
  const renderScale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * renderScale;
  canvas.height = height * renderScale;
  const ctx = canvas.getContext('2d');
  ctx.scale(renderScale, renderScale);
  const padding = 64;
  const contentWidth = width - (padding * 2);
  const isCredit = orderData.paymentType === 'credit';
  const totalQuantity = orderData.items.reduce((sum, item) => sum + item.quantity, 0);

  ctx.fillStyle = '#f3f6fb';
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 24, '#ffffff');

  drawRoundedRect(ctx, 36, 36, width - 72, 154, 24, '#5b4ff5');
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = '800 42px Inter, Arial, sans-serif';
  ctx.fillText(getShopName(), padding, 96);
  ctx.font = '600 20px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText('FIREWORKS POS', padding, 132);
  ctx.font = '600 16px Inter, Arial, sans-serif';
  ctx.fillText(`GSTIN: ${STORE_GST_NUMBER}`, padding, 160);
  ctx.textAlign = 'right';
  ctx.font = '800 24px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(isCredit ? 'CREDIT INVOICE' : 'TAX INVOICE', width - padding, 96);
  ctx.font = '600 18px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(orderData.orderNumber, width - padding, 130);
  ctx.font = '700 15px Inter, Arial, sans-serif';
  ctx.fillText(`PAGE ${pageIndex + 1} / ${pageCount}`, width - padding, 158);

  let y = 226;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7b869a';
  ctx.font = '700 16px Inter, Arial, sans-serif';
  ctx.fillText('CUSTOMER', padding, y);
  ctx.fillText('MOBILE', 430, y);
  ctx.fillText('DATE', 720, y);
  y += 34;
  ctx.fillStyle = '#172033';
  ctx.font = '700 21px Inter, Arial, sans-serif';
  ctx.fillText(trimCanvasText(ctx, orderData.customer.name, 300), padding, y);
  ctx.fillText(orderData.customer.mobile, 430, y);
  ctx.fillText(trimCanvasText(ctx, orderData.date, 290), 720, y);

  y += 50;
  drawRoundedRect(ctx, padding, y, contentWidth, 50, 8, '#eeecff');
  ctx.fillStyle = '#4d43ce';
  ctx.font = '800 16px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('#', padding + 18, y + 31);
  ctx.fillText(`ITEM (${orderData.items.length} PRODUCTS / ${totalQuantity} QTY)`, padding + 56, y + 31);
  ctx.textAlign = 'center';
  ctx.fillText('QTY', 704, y + 31);
  ctx.textAlign = 'right';
  ctx.fillText('UNIT PRICE', 862, y + 31);
  ctx.fillText('AMOUNT', width - padding - 18, y + 31);
  y += 54;

  pageItems.forEach((item, index) => {
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8f9fc';
    ctx.fillRect(padding, y, contentWidth, 62);
    ctx.fillStyle = '#172033';
    ctx.textAlign = 'left';
    ctx.font = '700 18px Inter, Arial, sans-serif';
    ctx.fillText(String((pageIndex * BILL_PAGE_SIZE) + index + 1), padding + 18, y + 36);
    ctx.fillText(trimCanvasText(ctx, item.name, 500), padding + 56, y + 26);
    ctx.fillStyle = '#7b869a';
    ctx.font = '500 14px Inter, Arial, sans-serif';
    ctx.fillText(trimCanvasText(ctx, item.packageInfo || '', 500), padding + 56, y + 48);
    ctx.fillStyle = '#273248';
    ctx.font = '700 18px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(item.quantity), 704, y + 36);
    ctx.textAlign = 'right';
    ctx.fillText(fmt(item.discountedPrice), 862, y + 36);
    ctx.fillStyle = '#5b4ff5';
    ctx.font = '800 18px Inter, Arial, sans-serif';
    ctx.fillText(fmt(item.discountedPrice * item.quantity), width - padding - 18, y + 36);
    y += 66;
  });

  y += 18;
  if (showSummary) {
    const addSummaryRow = (label, value, color = '#273248', bold = false) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#667188';
      ctx.font = `${bold ? 800 : 600} 18px Inter, Arial, sans-serif`;
      ctx.fillText(label, 620, y + 30);
      ctx.textAlign = 'right';
      ctx.fillStyle = color;
      ctx.font = `${bold ? 800 : 700} 19px Inter, Arial, sans-serif`;
      ctx.fillText(value, width - padding, y + 30);
      y += 48;
    };

    addSummaryRow('Subtotal', fmt(orderData.subtotal));
    if (orderData.gstAmount > 0) addSummaryRow('GST', fmt(orderData.gstAmount));
    if (orderData.discountAmount > 0) addSummaryRow('Discount', `-${fmt(orderData.discountAmount)}`, '#159447');

    drawRoundedRect(ctx, 600, y, width - padding - 600, 64, 10, '#eeecff');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4238c2';
    ctx.font = '800 21px Inter, Arial, sans-serif';
    ctx.fillText(isCredit ? 'Total Amount' : 'Total Paid', 620, y + 40);
    ctx.textAlign = 'right';
    ctx.font = '800 25px Inter, Arial, sans-serif';
    ctx.fillText(fmt(orderData.grandTotal), width - padding - 18, y + 40);
    y += 78;

    if (isCredit) {
      addSummaryRow('Amount Paid', fmt(orderData.paidAmount), '#159447', true);
      addSummaryRow('Balance Due', fmt(orderData.balanceDue), '#dc2626', true);
    }

    y += 10;
    ctx.strokeStyle = '#dfe4ec';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    y += 40;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#7b869a';
    ctx.font = '700 15px Inter, Arial, sans-serif';
    ctx.fillText('PAYMENT', padding, y);
    ctx.fillText('PAYMENT TYPE', 390, y);
    ctx.fillStyle = '#172033';
    ctx.font = '800 19px Inter, Arial, sans-serif';
    ctx.fillText(orderData.paymentMethod, padding, y + 32);
    ctx.fillText(isCredit ? 'Credit' : 'Full Payment', 390, y + 32);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5b4ff5';
    ctx.font = '800 18px Inter, Arial, sans-serif';
    ctx.fillText(`Continued on page ${pageIndex + 2}`, width / 2, y + 38);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#159447';
  ctx.font = '800 20px Inter, Arial, sans-serif';
  ctx.fillText('Thank you for your purchase!', width / 2, height - 92);
  ctx.fillStyle = '#8a94a7';
  ctx.font = '600 14px Inter, Arial, sans-serif';
  ctx.fillText(`${getShopName()} | ${STORE_ADDRESS}`, width / 2, height - 62);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to create bill image'));
    }, 'image/png', 0.95);
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius, fill) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function trimCanvasText(ctx, text, maxWidth) {
  const value = String(text || '');
  if (ctx.measureText(value).width <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function InvoiceCopy({ orderData, copyLabel }) {
  const shopDetails = getShopDetails(orderData);
  const isCredit = orderData.paymentType === 'credit';
  const totalQuantity = orderData.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="invoice-copy">
      <div className="invoice-copy-label">{copyLabel}</div>
      <div className="invoice-header">
        {shopDetails.footer_logo_url && (
          <div className="invoice-logo" style={{ textAlign: 'center', marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
            <img src={shopDetails.footer_logo_url} alt={shopDetails.shop_name} style={{ maxHeight: 55, maxWidth: 140, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          </div>
        )}
        <h2>{shopDetails.shop_name}</h2>
        <p>{shopDetails.address}</p>
        {shopDetails.gst_no && <p>GSTIN: {shopDetails.gst_no}</p>}
        {shopDetails.license_no && <p>Lic No: {shopDetails.license_no}</p>}
        {shopDetails.phone && <p>Phone: {shopDetails.phone}</p>}
      </div>
      <div className="invoice-divider" />
      <div className="invoice-row"><span>Order: {orderData.orderNumber}</span></div>
      <div className="invoice-row"><span>Date: {orderData.date}</span></div>
      <div className="invoice-row"><span>Customer: {orderData.customer?.name || orderData.customer_name || 'Walk-in Customer'}</span></div>
      <div className="invoice-row"><span>Mobile: {orderData.customer?.mobile || orderData.customer_mobile || '-'}</span></div>
      {(orderData.referral_code || orderData.referralCode) && (
        <div className="invoice-row">
          <span>Referral Code: {orderData.referral_code || orderData.referralCode}</span>
          {Number(orderData.referral_customer_discount || orderData.referralDiscountPercentage || 0) > 0 && (
            <span>({orderData.referral_customer_discount || orderData.referralDiscountPercentage}% off)</span>
          )}
        </div>
      )}
      <div className="invoice-row"><span>Products: {orderData.items.length}</span><span>Total Qty: {totalQuantity}</span></div>
      <div className="invoice-divider" />
      <div className="invoice-item invoice-item-header">Items:</div>
      {orderData.items.map((item, idx) => (
        <div key={idx} className="invoice-row">
          <span>{idx + 1}. {item.product_code || item.code ? `[${item.product_code || item.code}] ` : ''}{item.name} x{item.quantity}</span>
          <span>{fmt((item.discountedPrice || item.price || 0) * item.quantity)}</span>
        </div>
      ))}
      <div className="invoice-divider" />
      {orderData.gstAmount > 0 && (
        <div className="invoice-row">
          <span>GST ({Number(orderData.taxPercentage ?? orderData.tax_percentage ?? orderData.gstPercentage ?? orderData.gst?.percentage ?? 18)}%)</span>
          <span>{fmt(orderData.gstAmount)}</span>
        </div>
      )}
      {(() => {
        const refPercent = Number(orderData.referral_customer_discount || orderData.referralDiscountPercentage || 0);
        let refDisc = Number(orderData.referralDiscountAmount || orderData.referral_discount_amount || 0);
        if (refDisc <= 0 && refPercent > 0) {
          refDisc = (Number(orderData.subtotal || 0) * refPercent) / 100;
        }
        const totalDisc = Number(orderData.discountAmount || 0);
        const otherDisc = Math.max(0, totalDisc - refDisc);

        return (
          <>
            {refDisc > 0 && (
              <div className="invoice-row">
                <span>Referral Discount ({refPercent}%)</span>
                <span>-{fmt(refDisc)}</span>
              </div>
            )}
            {otherDisc > 0 && (
              <div className="invoice-row">
                <span>{refDisc > 0 ? 'Other Discount' : 'Discount'}</span>
                <span>-{fmt(otherDisc)}</span>
              </div>
            )}
          </>
        );
      })()}
      <div className="invoice-row invoice-total"><span>Total</span><span>{fmt(orderData.grandTotal)}</span></div>
      {isCredit && <div className="invoice-row"><strong>Amount Paid</strong><strong>{fmt(orderData.paidAmount)}</strong></div>}
      {isCredit && <div className="invoice-row invoice-total"><span>Balance Due</span><span>{fmt(orderData.balanceDue)}</span></div>}
      <div className="invoice-row"><span>Payment: {orderData.paymentMethod}</span></div>
      <div className="invoice-row"><span>Type: {isCredit ? 'CREDIT' : 'FULL PAYMENT'}</span></div>
      <div className="invoice-divider" />
      <div className="invoice-footer">
        <p>{copyLabel === 'DELIVERY COPY' ? 'Goods dispatched in good condition' : (isCredit ? 'Please retain this bill until the balance is paid.' : 'Thank you for your purchase!')}</p>
        <p>Visit us again at {shopDetails.shop_name}</p>
      </div>
    </div>
  );
}
