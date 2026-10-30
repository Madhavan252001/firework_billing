import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PackageCheck, Printer, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { fmt } from '../context/CartContext';
import { getShopDetails, orderService } from '../services';
import { printThreeBills, printA4Bill, generateInvoiceCopyHtml } from '../utils/printUtils';
import './billing.css';

export default function ViewBill() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBillData() {
      // 1. Check window.location.hash (#b=...) or query param for instant preview
      const hash = window.location.hash;
      let hashData = '';
      if (hash && hash.includes('b=')) {
        hashData = hash.split('b=')[1];
      }

      const dataParam = hashData || searchParams.get('d') || searchParams.get('data');
      if (dataParam) {
        try {
          let jsonString = '';
          try {
            jsonString = decodeURIComponent(atob(dataParam));
          } catch {
            jsonString = decodeURIComponent(escape(atob(dataParam)));
          }
          const parsed = JSON.parse(jsonString);

          // Map ultra-compact schema if present
          if (parsed.n && parsed.i) {
            const restoredItems = parsed.i.map(item => {
              const prodRef = item[0];
              const explicitName = item[3] || '';
              const explicitCode = item[4] || '';
              return {
                name: explicitName || String(prodRef),
                product_code: explicitCode || '',
                code: explicitCode || '',
                quantity: Number(item[1]),
                discountedPrice: Number(item[2]),
                price: Number(item[2]),
              };
            });

            const isArrayCust = Array.isArray(parsed.c);
            const custName = isArrayCust ? parsed.c[0] : parsed.c?.n;
            const custMobile = isArrayCust ? parsed.c[1] : parsed.c?.m;

            const isArrayTotals = Array.isArray(parsed.t);
            const sub = isArrayTotals ? parsed.t[0] : parsed.s;
            const gst = isArrayTotals ? parsed.t[1] : parsed.g;
            const disc = isArrayTotals ? parsed.t[2] : parsed.dc;
            const grand = isArrayTotals ? parsed.t[3] : parsed.t;

            const restoredShop = parsed.s ? {
              shop_name: parsed.s.n,
              gst_no: parsed.s.g,
              license_no: parsed.s.l,
              address: parsed.s.a,
              footer_logo_url: parsed.s.lo,
              phone: parsed.s.p,
            } : null;

            const reqNote = parsed.rn || parsed.requirement_note || parsed.requirementNote || parsed.notes || parsed.order_notes || '';

            const restoredOrder = {
              orderNumber: parsed.n,
              date: parsed.d,
              customer: { name: custName || '', mobile: custMobile || '' },
              customer_name: custName || '',
              customer_mobile: custMobile || '',
              requirement_note: reqNote,
              requirementNote: reqNote,
              order_notes: reqNote,
              notes: reqNote,
              items: restoredItems,
              subtotal: sub,
              gstAmount: gst,
              tax_amount: gst,
              discountAmount: disc,
              grandTotal: grand,
              payableAmount: grand,
              paymentMethod: parsed.p || 'Cash',
              paymentType: parsed.k ? 'credit' : (parsed.pt || 'full'),
              paidAmount: parsed.k ? parsed.k[0] : parsed.pa,
              balanceDue: parsed.k ? parsed.k[1] : parsed.bd,
              shop_details: restoredShop || getShopDetails(),
              shopDetails: restoredShop || getShopDetails(),
            };

            if (isMounted) {
              setOrderData(restoredOrder);
              setLoading(false);
            }
          } else {
            if (isMounted) {
              setOrderData(parsed);
              setLoading(false);
            }
          }
        } catch (e) {
          console.warn('Unable to parse hash bill data, falling back to API:', e);
        }
      }

      // 2. Fetch authoritative order & shop_details from live API
      // GET /orders/offline/:id or lookup from GET /orders/offline / estimat
      try {
        const targetId = orderId || (hashData ? null : undefined);
        if (targetId) {
          const apiOrder = await orderService.getOrderById(targetId);
          if (apiOrder && isMounted) {
            // If API returned order without items, check localStorage for item data fallback
            if (!Array.isArray(apiOrder.items) || apiOrder.items.length === 0) {
              try {
                const savedOrders = JSON.parse(localStorage.getItem('billing_orders') || '[]');
                const localMatch = savedOrders.find(o =>
                  String(o.orderNumber || o.order_no || o.id).toLowerCase() === String(targetId).toLowerCase()
                );
                if (localMatch && Array.isArray(localMatch.items) && localMatch.items.length > 0) {
                  apiOrder.items = localMatch.items;
                  if (!apiOrder.subtotal) apiOrder.subtotal = localMatch.subtotal;
                  if (!apiOrder.grandTotal) apiOrder.grandTotal = localMatch.grandTotal || localMatch.payableAmount;
                  if (!apiOrder.payableAmount) apiOrder.payableAmount = localMatch.payableAmount || localMatch.grandTotal;
                }
              } catch (e) {}
            }

            setOrderData(apiOrder);
            setLoading(false);
            setError(false);
            return;
          }
        }
      } catch (apiErr) {
        console.warn('API getOrderById failed in ViewBill:', apiErr);
      }

      // 3. Fallback to local storage orders if API unavailable
      try {
        const savedOrders = JSON.parse(localStorage.getItem('billing_orders') || '[]');
        const found = savedOrders.find(o =>
          String(o.orderNumber || o.order_no || o.id).toLowerCase() === String(orderId).toLowerCase()
        );
        if (found && isMounted) {
          setOrderData(found);
          setLoading(false);
          setError(false);
          return;
        }
      } catch (storageErr) {
        console.warn('LocalStorage order search failed:', storageErr);
      }

      // 4. If we already have preview orderData from hash, keep it; else set error
      if (isMounted) {
        setLoading(false);
        setOrderData(prev => {
          if (!prev) {
            setError(true);
          }
          return prev;
        });
      }
    }

    loadBillData();

    return () => {
      isMounted = false;
    };
  }, [orderId, searchParams]);

  const handlePrint = () => {
    if (orderData) {
      printThreeBills(orderData);
    } else {
      window.print();
    }
  };

  const handleA4Print = () => {
    if (orderData) printA4Bill(orderData);
  };

  if (loading && !orderData) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: 20, textAlign: 'center', background: '#f8fafc', color: '#1e293b'
      }}>
        <Loader2 size={44} className="button-spinner" style={{ color: '#4f46e5', marginBottom: 14 }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
          Loading Digital Invoice...
        </h3>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          Fetching order details from store...
        </p>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: 20, textAlign: 'center', background: '#f8fafc', color: '#1e293b'
      }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <h2>Bill Not Found</h2>
        <p style={{ color: '#64748b', maxWidth: 400, marginTop: 8 }}>
          The requested bill link <strong>#{orderId}</strong> is invalid or may have expired.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16, padding: '8px 16px', background: '#4f46e5', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const shopDetails = getShopDetails(orderData);
  const isCredit = orderData.paymentType === 'credit';
  const isEstimate = Boolean(
    orderData.is_estimate === '1' ||
    orderData.is_estimate === 1 ||
    orderData.is_estimate === true ||
    orderData.isEstimate ||
    orderData.order_type === 'estimate'
  );
  const totalQty = (orderData.items || []).reduce((s, i) => s + (Number(i.quantity) || 1), 0);

  return (
    <div className="view-bill-page-wrapper" style={{ background: '#f1f5f9', minHeight: '100vh', padding: '20px 12px' }}>
      <div className="view-bill-screen-card" style={{ maxWidth: 600, margin: '0 auto', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{
          background: isEstimate
            ? 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)'
            : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          padding: '24px 20px',
          color: '#ffffff',
          textAlign: 'center'
        }}>
          {shopDetails.footer_logo_url && (
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <img
                src={shopDetails.footer_logo_url}
                alt={shopDetails.shop_name}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                style={{
                  maxHeight: 56,
                  maxWidth: 160,
                  objectFit: 'contain',
                  background: '#ffffff',
                  padding: '5px 12px',
                  borderRadius: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
            </div>
          )}
          <span style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {shopDetails.shop_name.toUpperCase()} - {isEstimate ? 'ESTIMATE / QUOTATION' : 'DIGITAL INVOICE'}
          </span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
            {isEstimate ? 'Estimate #' : 'Invoice #'}{orderData.orderNumber || orderData.order_no}
          </h1>
          <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: 13 }}>{orderData.date}</p>
        </div>

        {/* Action Bar */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isEstimate ? '#2563eb' : '#10b981', fontSize: 13, fontWeight: 700 }}>
            <PackageCheck size={18} /> {isEstimate ? 'Official Quotation / Estimate' : 'Verified Purchase'}
          </div>
          <button
            type="button"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#ffffff', color: '#1e293b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <Printer size={14} /> {isEstimate ? 'Print Estimate' : 'Print Bill'}
          </button>
          <button
            type="button"
            onClick={handleA4Print}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#ffffff', color: '#1e293b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <Printer size={14} /> A4 Sheet
          </button>
        </div>

        {/* Customer & Store Info */}
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderBottom: '1px solid #cbd5e1' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Customer Details</span>
            <h3 style={{ margin: '4px 0 2px', fontSize: 16, fontWeight: 800, color: '#000000' }}>{orderData.customer?.name || 'Walk-in Customer'}</h3>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>{orderData.customer?.mobile || '-'}</p>
            {(orderData.referral_code || orderData.referralCode) && (
              <span style={{ display: 'inline-block', marginTop: 4, padding: '2.5px 8px', background: '#e0e7ff', color: '#312e81', borderRadius: 6, fontSize: 11.5, fontWeight: 800 }}>
                Ref: {orderData.referral_code || orderData.referralCode} ({orderData.referral_customer_discount || orderData.referralDiscountPercentage || 0}% off)
              </span>
            )}
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Payment & Store Info</span>
            <h3 style={{ margin: '4px 0 2px', fontSize: 14.5, fontWeight: 800, color: '#312e81' }}>{orderData.paymentMethod} ({isCredit ? 'Credit' : 'Paid'})</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{shopDetails.shop_name}</p>
            {shopDetails.gst_no && <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>GSTIN: {shopDetails.gst_no}</p>}
            {shopDetails.license_no && <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>Lic No: {shopDetails.license_no}</p>}
            {shopDetails.address && <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: '#334155' }}>{shopDetails.address}</p>}
            {(shopDetails.phone || shopDetails.mobile || shopDetails.mobile_no) && (
              <p style={{ margin: '3px 0 0', fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                Store Mobile: <a href={`tel:${shopDetails.phone || shopDetails.mobile || shopDetails.mobile_no}`} style={{ color: '#4338ca', textDecoration: 'none', fontWeight: 800 }}>{shopDetails.phone || shopDetails.mobile || shopDetails.mobile_no}</a>
              </p>
            )}
          </div>
        </div>

        {/* Requirement Note (if present) */}
        {(orderData.requirement_note || orderData.requirementNote || orderData.order_notes || orderData.notes) && (
          <div style={{ padding: '12px 20px', background: '#fef3c7', borderBottom: '1px solid #fde68a', color: '#92400e' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <FileText size={16} style={{ marginTop: 2, flexShrink: 0, color: '#b45309' }} />
              <div>
                <strong style={{ display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2, color: '#92400e', fontWeight: 800 }}>Requirement Note:</strong>
                <span style={{ fontSize: 13, fontWeight: 700, wordBreak: 'break-word', color: '#78350f' }}>{orderData.requirement_note || orderData.requirementNote || orderData.order_notes || orderData.notes}</span>
              </div>
            </div>
          </div>
        )}

        {/* Product Items Table */}
        <div style={{ padding: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#000000', textTransform: 'uppercase', display: 'block', marginBottom: 12, letterSpacing: '0.4px' }}>Items Summary ({(orderData.items || []).length} items / {totalQty} qty)</span>
          <div style={{ border: '1.5px solid #cbd5e1', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', color: '#000000', fontSize: 12.5 }}>
                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Product</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800 }}>Qty</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>Price</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(orderData.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 13 }}>
                      No items found for this record.
                    </td>
                  </tr>
                ) : (
                  (orderData.items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#000000' }}>
                        <div>{item.name || item.product_name || `Item ${idx + 1}`}</div>
                        {(item.product_code || item.code) && (
                          <small style={{ fontSize: 11, color: '#4338ca', fontWeight: 800, letterSpacing: '0.3px' }}>
                            {item.product_code || item.code}
                          </small>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#4338ca' }}>x{item.quantity}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{fmt(item.discountedPrice ?? item.price ?? item.unit_price ?? 0)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#000000' }}>{fmt(Number(item.discountedPrice ?? item.price ?? item.unit_price ?? 0) * Number(item.quantity || 1))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total Summary */}
        {(() => {
          const billSubtotal = Number(orderData.subtotal) || (orderData.items || []).reduce((s, i) => s + ((Number(i.discountedPrice || i.price || 0)) * Number(i.quantity || 1)), 0);
          const billGst = Number(orderData.gstAmount || 0);
          const billDisc = Number(orderData.discountAmount || 0);
          const billGrandTotal = Number(orderData.grandTotal || orderData.total) || Math.max(0, billSubtotal + billGst - billDisc);

          return (
            <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', maxWidth: 300, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1.5px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontWeight: 700 }}>
                  <span>Subtotal</span><strong style={{ fontWeight: 800 }}>{fmt(billSubtotal)}</strong>
                </div>
                {billGst > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontWeight: 700 }}>
                    <span>GST ({Number(orderData.taxPercentage ?? orderData.tax_percentage ?? orderData.gstPercentage ?? orderData.gst?.percentage ?? 18)}%)</span>
                    <strong style={{ fontWeight: 800 }}>{fmt(billGst)}</strong>
                  </div>
                )}
                {(() => {
                  const refPercent = Number(orderData.referral_customer_discount || orderData.referralDiscountPercentage || 0);
                  let refDisc = Number(orderData.referralDiscountAmount || orderData.referral_discount_amount || 0);
                  if (refDisc <= 0 && refPercent > 0) {
                    refDisc = (billSubtotal * refPercent) / 100;
                  }
                  const otherDisc = Math.max(0, billDisc - refDisc);

                  return (
                    <>
                      {refDisc > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#312e81', fontWeight: 700 }}>
                          <span>Referral Discount ({refPercent}%)</span>
                          <strong style={{ fontWeight: 800 }}>-{fmt(refDisc)}</strong>
                        </div>
                      )}
                      {otherDisc > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#065f46', fontWeight: 700 }}>
                          <span>{refDisc > 0 ? 'Other Discount' : 'Discount'}</span>
                          <strong style={{ fontWeight: 800 }}>-{fmt(otherDisc)}</strong>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div style={{ borderTop: '2px solid #0f172a', paddingTop: 9, marginTop: 2, display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900, color: '#000000' }}>
                  <span>Grand Total</span><span style={{ color: '#312e81' }}>{fmt(billGrandTotal)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #cbd5e1', padding: '16px 20px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span>Thank you for your business! - {shopDetails.shop_name}</span>
        </div>
      </div>

      {/* On-Page Bill Print Layout (Customer Copy only) */}
      <div
        className="printable-three-bills"
        dangerouslySetInnerHTML={{
          __html: `
            <div class="invoice-wrap">
              ${generateInvoiceCopyHtml(orderData, 'CUSTOMER COPY')}
            </div>
          `
        }}
      />

      <style>{`
        @media screen {
          .printable-three-bills {
            display: none !important;
          }

          /* Dark Mode styling for Digital Invoice View */
          .dark .view-bill-page-wrapper {
            background: #0b1120 !important;
          }
          .dark .view-bill-screen-card {
            background: #111827 !important;
            border-color: #1f2937 !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
          }
          .dark .view-bill-screen-card span,
          .dark .view-bill-screen-card p,
          .dark .view-bill-screen-card h3,
          .dark .view-bill-screen-card td,
          .dark .view-bill-screen-card th,
          .dark .view-bill-screen-card strong {
            color: #f8fafc !important;
          }
          .dark .view-bill-screen-card div[style*="background: rgb(248, 250, 252)"],
          .dark .view-bill-screen-card div[style*="background: #f8fafc"] {
            background: #1f2937 !important;
            border-color: #374151 !important;
          }
          .dark .view-bill-screen-card tr[style*="background: rgb(241, 245, 249)"],
          .dark .view-bill-screen-card tr[style*="background: #f1f5f9"] {
            background: #1f2937 !important;
            border-bottom-color: #374151 !important;
          }
          .dark .view-bill-screen-card button {
            background: #1f2937 !important;
            border-color: #374151 !important;
            color: #f8fafc !important;
          }
        }

        @media print {
          /* Hide screen UI */
          body * {
            visibility: hidden;
          }
          .view-bill-page-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          .view-bill-screen-card,
          .view-bill-screen-card * {
            display: none !important;
          }

          /* Show receipt container only */
          .printable-three-bills,
          .printable-three-bills * {
            visibility: visible;
          }
          .printable-three-bills {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0;
            margin: 0;
          }

          .printable-three-bills * {
            box-sizing: border-box;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .printable-three-bills .invoice-wrap {
            max-width: 320px;
            margin: 0 auto;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            line-height: 1.35;
            font-size: 12.5px;
            font-weight: 600;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-copy {
            width: 100%;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-copy-label {
            text-align: center;
            border: 1.5px solid #000000 !important;
            padding: 3px 6px;
            margin-bottom: 8px;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-header {
            text-align: center;
            margin-bottom: 8px;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-logo {
            text-align: center;
            margin-bottom: 6px;
          }
          .printable-three-bills .invoice-logo img {
            max-height: 55px;
            max-width: 140px;
            object-fit: contain;
          }
          .printable-three-bills .invoice-header h2 {
            margin: 0 0 2px;
            font-size: 17px;
            font-weight: 800;
            letter-spacing: -0.2px;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-header p {
            margin: 1.5px 0;
            font-size: 12px;
            font-weight: 600;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-divider {
            border-top: 1.5px dashed #000000 !important;
            margin: 7px 0;
          }
          .printable-three-bills .invoice-requirement-row {
            margin: 5px 0 6px;
            padding: 4px 6px;
            border: 1px dashed #000000 !important;
            border-radius: 4px;
            background: #fafafa !important;
            font-size: 11.5px;
            line-height: 1.3;
          }
          .printable-three-bills .invoice-requirement-title {
            font-weight: 800;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-requirement-text {
            font-weight: 600;
            word-break: break-word;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 600;
            padding: 1.5px 0;
            line-height: 1.35;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-row span,
          .printable-three-bills .invoice-row strong {
            color: #000000 !important;
          }
          .printable-three-bills .invoice-item {
            font-size: 12px;
            font-weight: 600;
            padding: 2px 0;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-item-header {
            font-weight: 800;
            font-size: 13px;
            margin-bottom: 2px;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-total {
            font-weight: 900;
            font-size: 14.5px;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-total span,
          .printable-three-bills .invoice-total strong {
            font-weight: 900;
            font-size: 14.5px;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-footer {
            text-align: center;
            margin-top: 8px;
            font-size: 12px;
            font-weight: 600;
            color: #000000 !important;
          }
          .printable-three-bills .invoice-footer p {
            margin: 2px 0;
            color: #000000 !important;
            font-weight: 600;
          }
        }
      `}</style>
    </div>
  );
}
