import React, { useState, useEffect, useCallback } from 'react';
import { X, Receipt, ShoppingBag, Clock, ChevronDown, ChevronUp, Edit3, Save, Trash2, Plus, Minus, LoaderCircle, Phone, User, CreditCard, ShoppingCart, Search, Printer, MapPin, RefreshCw, Tag, Store, MessageCircle, FileText, CheckCircle2, BadgeIndianRupee, ReceiptText, Copy, Check } from 'lucide-react';
import { fmt, useCart } from '../context/CartContext';
import { orderService, getShopDetails, getShopName } from '../services';
import { saveCustomer } from '../utils/customerStore';
import { printThreeBills, printA4Bill } from '../utils/printUtils';

// Helper to identify all estimate IDs that have been converted to official orders
const getConvertedEstimateIds = (salesOrders = [], localList = []) => {
  const set = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem('converted_estimate_ids') || '[]');
    stored.forEach(id => {
      if (id) set.add(String(id).toLowerCase().trim());
    });
  } catch (e) {}

  [...localList, ...salesOrders].forEach(ord => {
    if (!ord) return;
    if (ord.convertedFromEstimate) set.add(String(ord.convertedFromEstimate).toLowerCase().trim());
    if (ord.converted_from_estimate) set.add(String(ord.converted_from_estimate).toLowerCase().trim());
    const note = String(ord.requirement_note || ord.requirementNote || ord.notes || ord.order_notes || ord.remark || '');
    const match = note.match(/Converted from Estimate #([A-Za-z0-9_-]+)/i);
    if (match && match[1]) {
      set.add(String(match[1]).toLowerCase().trim());
    }
    if (ord.convertedToOrder) {
      set.add(String(ord.orderNumber || ord.order_no || ord.id).toLowerCase().trim());
    }
  });
  return set;
};

const isOrderAnEstimate = (o) => {
  if (!o) return false;
  return Boolean(o.is_estimate === '1' || o.isEstimate || o.order_type === 'estimate');
};

export default function PurchaseHistory({ onClose }) {
  const { loadOrderToCart, triggerStockError } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editingOrderIndex, setEditingOrderIndex] = useState(null);
  const [editedOrderData, setEditedOrderData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [convertingTarget, setConvertingTarget] = useState(null);
  const [convertPaymentMode, setConvertPaymentMode] = useState('cash');
  const [convertRemark, setConvertRemark] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [conversionSuccess, setConversionSuccess] = useState(null);
  const [deletingEstimateId, setDeletingEstimateId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [selectedOrderKey, setSelectedOrderKey] = useState(null);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState(false);

  const handleCopyOrderNumber = (num) => {
    if (!num) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(num));
      }
      setCopiedOrderNumber(true);
      setTimeout(() => setCopiedOrderNumber(false), 2000);
    } catch (e) {}
  };

  const fetchOrders = useCallback(async (showRefreshing = true) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const [apiOrdersResult, apiEstimatesResult] = await Promise.allSettled([
        orderService.getOfflineOrders(),
        orderService.getEstimateOrders(),
      ]);

      const salesList = apiOrdersResult.status === 'fulfilled' && Array.isArray(apiOrdersResult.value) ? apiOrdersResult.value : [];
      const estimatesList = apiEstimatesResult.status === 'fulfilled' && Array.isArray(apiEstimatesResult.value) ? apiEstimatesResult.value : [];

      // Identify all converted estimate IDs from sales orders
      const convertedEstimateSet = getConvertedEstimateIds(salesList, []);

      // Identify all deleted estimate IDs so they do not reappear
      let deletedEstimateSet = new Set();
      try {
        const storedDeleted = JSON.parse(localStorage.getItem('deleted_estimate_ids') || '[]');
        storedDeleted.forEach(id => {
          if (id) deletedEstimateSet.add(String(id).toLowerCase().trim());
        });
      } catch (e) {}

      const isConvertedEstimate = (ord) => {
        if (!isOrderAnEstimate(ord)) return false;
        const keys = [
          String(ord.orderNumber || '').toLowerCase().trim(),
          String(ord.order_no || '').toLowerCase().trim(),
          String(ord.id || '').toLowerCase().trim(),
          String(ord.order_number || '').toLowerCase().trim(),
        ].filter(Boolean);
        return keys.some(k => convertedEstimateSet.has(k)) || Boolean(ord.convertedToOrder || ord.converted_to_order);
      };

      const isDeletedEstimate = (ord) => {
        if (!isOrderAnEstimate(ord)) return false;
        const keys = [
          String(ord.orderNumber || '').toLowerCase().trim(),
          String(ord.order_no || '').toLowerCase().trim(),
          String(ord.id || '').toLowerCase().trim(),
          String(ord.order_number || '').toLowerCase().trim(),
        ].filter(Boolean);
        return keys.some(k => deletedEstimateSet.has(k));
      };

      const seen = new Set();
      const merged = [];

      // Add ONLY authoritative live API data (Sales Orders and active Estimates)
      [...salesList, ...estimatesList].forEach(ord => {
        if (!ord) return;
        // If this item is an estimate that was converted or deleted, DO NOT show it under estimates!
        if (isConvertedEstimate(ord) || isDeletedEstimate(ord)) return;

        const key = String(ord.orderNumber || ord.order_no || ord.id);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(ord);
        }
      });

      setOrders(merged);
    } catch (err) {
      console.warn('Failed to load orders from API:', err);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (convertingTarget) {
          if (!isConverting) setConvertingTarget(null);
        } else {
          onClose();
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose, convertingTarget, isConverting]);

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  const [editingQtyItemIndex, setEditingQtyItemIndex] = useState(null);
  const [tempQtyInput, setTempQtyInput] = useState('');

  const handleStartEdit = async (order, originalIndex) => {
    let fullOrder = order;
    if (!order.items || order.items.length === 0) {
      if (order.id) {
        setLoadingDetailId(order.id);
        const detail = await orderService.getOrderById(order.id);
        setLoadingDetailId(null);
        if (detail && Array.isArray(detail.items) && detail.items.length > 0) {
          fullOrder = { ...order, ...detail };
          setOrders(prev => prev.map(o => (o.id === order.id || o.orderNumber === order.orderNumber ? fullOrder : o)));
        }
      }
    }
    const cloned = JSON.parse(JSON.stringify(fullOrder));
    const gTotal = Number(cloned.grandTotal || cloned.payableAmount || 0);
    const existingStatus = String(cloned.paymentStatus || cloned.payment_status || '').toLowerCase();
    const existingBal = Number(cloned.balanceDue ?? cloned.remainingAmount ?? 0);
    if (['paid', 'partial', 'unpaid', 'pending', 'refunded', 'failed'].includes(existingStatus)) {
      cloned.paymentStatus = existingStatus === 'pending' ? 'unpaid' : existingStatus;
    } else {
      cloned.paymentStatus = existingBal === 0 ? 'paid' : 'partial';
    }
    cloned.payment_status = cloned.paymentStatus;
    if (cloned.paymentStatus === 'paid') {
      cloned.paidAmount = gTotal;
      cloned.balanceDue = 0;
    } else if (cloned.paymentStatus === 'unpaid' || cloned.paymentStatus === 'failed') {
      cloned.paidAmount = 0;
      cloned.balanceDue = gTotal;
    }

    setEditingOrderIndex(originalIndex);
    setEditedOrderData(cloned);
    setEditingQtyItemIndex(null);
  };

  const handlePaymentStatusChange = (newStatus) => {
    if (!editedOrderData) return;
    const gTotal = Number(editedOrderData.grandTotal || editedOrderData.payableAmount || 0);
    const updated = {
      ...editedOrderData,
      paymentStatus: newStatus,
      payment_status: newStatus,
    };
    if (newStatus === 'paid') {
      updated.paidAmount = gTotal;
      updated.balanceDue = 0;
    } else if (newStatus === 'unpaid' || newStatus === 'failed') {
      updated.paidAmount = 0;
      updated.balanceDue = gTotal;
    } else if (newStatus === 'refunded') {
      updated.refunded = true;
    } else if (newStatus === 'partial') {
      const currentPaid = Number(updated.paidAmount || 0);
      if (currentPaid <= 0 || currentPaid >= gTotal) {
        updated.paidAmount = Number((gTotal / 2).toFixed(2));
      }
      updated.balanceDue = Math.max(0, gTotal - Number(updated.paidAmount || 0));
    }
    setEditedOrderData(updated);
  };

  const handlePaidAmountChange = (val) => {
    if (!editedOrderData) return;
    const gTotal = Number(editedOrderData.grandTotal || editedOrderData.payableAmount || 0);
    const numVal = Math.max(0, Math.min(Number(val) || 0, gTotal));
    setEditedOrderData({
      ...editedOrderData,
      paidAmount: numVal,
      balanceDue: Math.max(0, gTotal - numVal),
    });
  };

  const handleCancelEdit = () => {
    setEditingOrderIndex(null);
    setEditedOrderData(null);
  };

  const handlePrintBill = async (order) => {
    let fullOrder = order;
    if (!order.items || order.items.length === 0) {
      if (order.id) {
        setLoadingDetailId(order.id);
        const detail = await orderService.getOrderById(order.id);
        setLoadingDetailId(null);
        if (detail && Array.isArray(detail.items) && detail.items.length > 0) {
          fullOrder = { ...order, ...detail };
          setOrders(prev => prev.map(o => (o.id === order.id || o.orderNumber === order.orderNumber ? fullOrder : o)));
        }
      }
    }
    printThreeBills(fullOrder);
  };

  const handlePrintA4Bill = async (order) => {
    let fullOrder = order;
    if (!order.items || order.items.length === 0) {
      if (order.id) {
        setLoadingDetailId(order.id);
        const detail = await orderService.getOrderById(order.id);
        setLoadingDetailId(null);
        if (detail && Array.isArray(detail.items) && detail.items.length > 0) {
          fullOrder = { ...order, ...detail };
          setOrders(prev => prev.map(o => (o.id === order.id || o.orderNumber === order.orderNumber ? fullOrder : o)));
        }
      }
    }
    printA4Bill(fullOrder);
  };

  const handleShareBill = async (order) => {
    let fullOrder = order;
    if (!order.items || order.items.length === 0) {
      if (order.id) {
        setLoadingDetailId(order.id);
        const detail = await orderService.getOrderById(order.id);
        setLoadingDetailId(null);
        if (detail && Array.isArray(detail.items) && detail.items.length > 0) {
          fullOrder = { ...order, ...detail };
          setOrders(prev => prev.map(o => (o.id === order.id || o.orderNumber === order.orderNumber ? fullOrder : o)));
        }
      }
    }
    const mobile = String(fullOrder.customer?.mobile || fullOrder.customer_mobile || '').replace(/\D/g, '');
    const whatsappNumber = mobile.length === 10 ? `91${mobile}` : mobile;
    const shop = getShopDetails(fullOrder);
    const shopDisplayName = (shop?.shop_name || getShopName() || 'FIREWORKS').toUpperCase();
    const orderIdentifier = fullOrder.orderNumber || fullOrder.order_no || fullOrder.id || '';
    const totalQuantity = (fullOrder.items || []).reduce((s, i) => s + (Number(i.quantity) || 1), 0);
    const isEstimate = Boolean(fullOrder.is_estimate === '1' || fullOrder.isEstimate || fullOrder.order_type === 'estimate');
    const reqNote = (fullOrder.requirement_note || fullOrder.requirementNote || fullOrder.order_notes || fullOrder.notes || fullOrder.remark || '').trim();
    const custName = fullOrder.customer?.name || fullOrder.customer_name || 'Customer';
    const custMobile = fullOrder.customer?.mobile || fullOrder.customer_mobile || '';
    const orderDate = fullOrder.date || (fullOrder.created_at ? new Date(fullOrder.created_at).toLocaleString('en-IN') : new Date().toLocaleDateString('en-IN'));

    const itemsList = (fullOrder.items || []).map((item, idx) => {
      const itemName = item.name || item.product_name || `Item ${idx + 1}`;
      const qty = Number(item.quantity ?? item.qty ?? 1);
      const price = Number(item.price ?? item.discountedPrice ?? item.unit_price ?? 0);
      const itemTotal = Number(item.total ?? item.total_price ?? (price * qty));
      return `${idx + 1}. *${itemName}* x ${qty} = ₹${itemTotal.toLocaleString('en-IN')}`;
    });

    const subtotal = Number(fullOrder.subtotal || 0);
    const discount = Number(fullOrder.discountAmount ?? fullOrder.basicDiscountAmount ?? fullOrder.discount_amount ?? 0);
    const tax = Number(fullOrder.taxAmount ?? fullOrder.gstAmount ?? fullOrder.tax_amount ?? 0);
    const grandTotal = Number(fullOrder.grandTotal ?? fullOrder.payableAmount ?? fullOrder.total_amount ?? 0);
    const paid = Number(fullOrder.paidAmount ?? grandTotal);
    const balance = Number(fullOrder.balanceDue ?? fullOrder.remaing_amount ?? 0);
    const payMethod = fullOrder.paymentMethod || fullOrder.payment_method;

    const lines = [
      `${shopDisplayName}`,
      `${isEstimate ? '*ESTIMATE / QUOTATION*' : '*SALES INVOICE / BILL*'}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `${isEstimate ? '*Estimate No*' : '*Bill No*'}:* ${orderIdentifier}`,
      `*Date:* ${orderDate}`,
      `*Customer:* ${custName}${custMobile ? ` (${custMobile})` : ''}`,
      reqNote ? `${isEstimate ? '*Remark*' : '*Note*'}: ${reqNote}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `*ITEMS ORDERED (${(fullOrder.items || []).length} items / ${totalQuantity} qty):*`,
      ...itemsList,
      `━━━━━━━━━━━━━━━━━━━━`,
      subtotal > 0 ? `*Subtotal:* ₹${subtotal.toLocaleString('en-IN')}` : '',
      discount > 0 ? `*Discount:* -₹${discount.toLocaleString('en-IN')}` : '',
      tax > 0 ? `*GST / Tax:* +₹${tax.toLocaleString('en-IN')}` : '',
      `*Net Total:* ₹${grandTotal.toLocaleString('en-IN')}`,
      !isEstimate && payMethod ? `*Payment Mode:* ${payMethod}` : '',
      !isEstimate && paid < grandTotal && balance > 0 ? `*Paid:* ₹${paid.toLocaleString('en-IN')} | *Balance Due:* ₹${balance.toLocaleString('en-IN')}` : '',
      isEstimate ? `\n_Note: This is an estimate only, not a tax invoice._` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      shop?.phone || shop?.mobile ? `Contact: ${shop?.phone || shop?.mobile}` : '',
      shop?.address ? `Address: ${shop?.address}` : '',
      shop?.gst_no ? `GSTIN: ${shop?.gst_no}` : '',
      ``,
      isEstimate ? `Thank you for inquiring with us!` : `Thank you for shopping with us! Have a sparkling day! ✨`,
      ``,
      `*${shop?.shop_name || getShopName()}*`
    ].filter(Boolean);

    const message = lines.join('\n');

    const waUrl = whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleUpdateItemQty = (itemIndex, newQty) => {
    if (!editedOrderData) return;
    const updatedItems = [...editedOrderData.items];
    const item = updatedItems[itemIndex];
    if (newQty <= 0) {
      updatedItems.splice(itemIndex, 1);
    } else {
      if (item.stock && newQty > item.stock) {
        triggerStockError?.(`Only ${item.stock} available in stock for ${item.name}!`);
        item.quantity = item.stock;
      } else {
        item.quantity = newQty;
      }
    }
    
    // Recalculate totals
    const newSubtotal = updatedItems.reduce((s, i) => s + (i.discountedPrice * i.quantity), 0);
    const newGstAmount = editedOrderData.gst?.enabled ? (newSubtotal * Number(editedOrderData.gst?.percentage || 18)) / 100 : 0;
    
    let newDiscountAmount = 0;
    if (editedOrderData.discount?.enabled) {
      const val = Number(editedOrderData.discount.value) || 0;
      const basicAmount = editedOrderData.discount.type === 'percentage' ? (newSubtotal * Math.min(val, 100)) / 100 : val;
      const otherVal = Math.max(0, Number(editedOrderData.discount.otherValue) || 0);
      const otherAmount = editedOrderData.discount.otherType === 'percentage' ? (newSubtotal * Math.min(otherVal, 100)) / 100 : otherVal;
      newDiscountAmount = Math.min(basicAmount + otherAmount, newSubtotal);
    }

    const newGrandTotal = Math.max(0, newSubtotal + newGstAmount - newDiscountAmount);

    setEditedOrderData({
      ...editedOrderData,
      items: updatedItems,
      subtotal: newSubtotal,
      gstAmount: newGstAmount,
      discountAmount: newDiscountAmount,
      grandTotal: newGrandTotal,
    });
  };

  const handleSaveEdit = async () => {
    if (editingOrderIndex === null || !editedOrderData) return;
    setIsSaving(true);
    setSaveError(null);

    // Optimistic update locally
    const updatedOrders = [...orders];
    updatedOrders[editingOrderIndex] = editedOrderData;
    setOrders(updatedOrders);
    if (editedOrderData.customer) {
      saveCustomer(editedOrderData.customer);
    }

    // Persist changes in local billing_orders
    try {
      const localOrders = JSON.parse(localStorage.getItem('billing_orders') || '[]');
      const matchIdx = localOrders.findIndex(o =>
        (editedOrderData.id && String(o.id) === String(editedOrderData.id)) ||
        (editedOrderData.orderNumber && String(o.orderNumber) === String(editedOrderData.orderNumber)) ||
        (editedOrderData.order_no && String(o.order_no) === String(editedOrderData.order_no))
      );
      if (matchIdx !== -1) {
        localOrders[matchIdx] = { ...localOrders[matchIdx], ...editedOrderData };
        localStorage.setItem('billing_orders', JSON.stringify(localOrders));
      }
    } catch (storageErr) {
      console.warn('Failed to update local billing_orders:', storageErr);
    }

    // Call the API to persist changes
    const orderId = editedOrderData.id;
    if (orderId) {
      try {
        await orderService.updateOfflineOrder(orderId, editedOrderData);
      } catch (err) {
        console.warn('API update failed, changes are saved locally only:', err);
        setSaveError('Saved locally. API sync failed — changes will persist on this device.');
      }
    }

    setIsSaving(false);
    setEditingOrderIndex(null);
    setEditedOrderData(null);
  };

  const handleLoadToCart = async (order) => {
    let fullOrder = order;
    if (!order.items || order.items.length === 0) {
      if (order.id) {
        setLoadingDetailId(order.id);
        const detail = await orderService.getOrderById(order.id);
        setLoadingDetailId(null);
        if (detail && Array.isArray(detail.items) && detail.items.length > 0) {
          fullOrder = { ...order, ...detail };
        }
      }
    }
    loadOrderToCart(fullOrder);
    if (fullOrder.customer) {
      saveCustomer(fullOrder.customer);
    }
    onClose();
  };

  const handleOpenConvertModal = async (order) => {
    let fullOrder = { ...order };
    if (!fullOrder.items || fullOrder.items.length === 0) {
      if (fullOrder.id) {
        setLoadingDetailId(fullOrder.id);
        const detail = await orderService.getOrderById(fullOrder.id);
        setLoadingDetailId(null);
        if (detail && Array.isArray(detail.items) && detail.items.length > 0) {
          fullOrder = { ...fullOrder, ...detail };
          setOrders(prev => prev.map(o => (o.id === fullOrder.id || o.orderNumber === fullOrder.orderNumber ? fullOrder : o)));
        }
      }
    }

    const rawMode = (fullOrder.payment_method || fullOrder.paymentMethod || 'cash').toString().toLowerCase();
    const validMode = ['cash', 'upi', 'card'].includes(rawMode) ? rawMode : 'cash';
    setConvertPaymentMode(validMode);

    const existingNote = (fullOrder.requirement_note || fullOrder.requirementNote || fullOrder.note || fullOrder.notes || fullOrder.remark || '').trim();
    setConvertRemark(existingNote);
    setConvertError('');
    setConvertingTarget(fullOrder);
  };

  const handleExecuteConvertToOrder = async (e) => {
    if (e) e.preventDefault();
    if (!convertingTarget || isConverting) return;
    setIsConverting(true);
    setConvertError('');

    try {
      const fullOrder = convertingTarget;
      const customerName = (fullOrder.customer?.name || fullOrder.customer_name || 'Walk-in Customer').trim();
      const customerMobile = (fullOrder.customer?.mobile || fullOrder.customer_mobile || '').trim();
      const address = (fullOrder.customer?.address || fullOrder.address || 'Chennai').trim();
      const postalcode = (fullOrder.customer?.postalcode || fullOrder.customer?.pincode || fullOrder.postalcode || '600001').trim();

      const subtotal = Number(fullOrder.subtotal || fullOrder.originalSubtotal || 0);
      const taxPercentage = Number(fullOrder.taxPercentage ?? fullOrder.tax_percentage ?? (fullOrder.gstAmount > 0 ? 18 : 0));
      const taxAmount = Number(fullOrder.taxAmount ?? fullOrder.tax_amount ?? fullOrder.gstAmount ?? 0);
      const basicDiscountPercentage = Number(fullOrder.basicDiscountPercentage ?? fullOrder.basic_discount_percentage ?? 0);
      const basicDiscountAmount = Number(fullOrder.basicDiscountAmount ?? fullOrder.basic_discount_amount ?? 0);
      const otherDiscountType = fullOrder.otherDiscountType || fullOrder.other_discount_type || 'amount';
      const otherDiscountValue = Number(fullOrder.otherDiscountValue ?? fullOrder.other_discount_value ?? 0);
      const otherDiscountAmount = Number(fullOrder.otherDiscountAmount ?? fullOrder.other_discount_amount ?? 0);
      const payableAmount = Number(fullOrder.payableAmount ?? fullOrder.payable_amount ?? fullOrder.grandTotal ?? 0);
      const paidAmount = payableAmount;

      // Apply Proposed Payment Mode selected by the user
      const paymentMethod = convertPaymentMode;
      const paymentMethodFormatted = convertPaymentMode === 'upi' ? 'UPI' : convertPaymentMode === 'card' ? 'Card' : 'Cash';

      const userNote = convertRemark.trim();
      const estimateNum = fullOrder.orderNumber || fullOrder.order_no || fullOrder.id;
      const conversionNote = userNote
        ? (userNote.includes(`Estimate #${estimateNum}`) ? userNote : `${userNote} (Converted from Estimate #${estimateNum})`)
        : `Converted from Estimate #${estimateNum}`;

      const items = (fullOrder.items || []).map(item => {
        const unitPrice = Number(item.price ?? item.unit_price ?? item.discountedPrice ?? 0);
        const qty = Number(item.quantity ?? item.qty ?? 1);
        const totalPrice = Number(item.total_price ?? item.total ?? (unitPrice * qty));
        return {
          product_id: item.product_id ?? item.productId ?? item.id,
          product_name: item.product_name ?? item.name ?? 'crackers',
          product_code: item.product_code ?? item.code ?? '',
          quantity: qty,
          price: unitPrice,
          unit_price: unitPrice,
          total_price: totalPrice,
          image: item.image || '',
          fallbackImage: item.fallbackImage || '',
          packageInfo: item.packageInfo || '',
        };
      });

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const tempOrderNo = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const orderPayload = {
        id: Date.now(),
        orderNumber: tempOrderNo,
        order_no: tempOrderNo,
        order_type: 'sales',
        is_estimate: false,
        isEstimate: false,
        date: `${dateStr}, ${timeStr}`,
        created_at: now.toISOString(),
        convertedFromEstimate: estimateNum,
        customer: {
          name: customerName,
          mobile: customerMobile,
          address,
          postalcode,
        },
        customer_name: customerName,
        customer_mobile: customerMobile,
        address,
        postalcode,
        items,
        subtotal: subtotal || items.reduce((s, it) => s + it.total_price, 0),
        gst: { enabled: taxPercentage > 0, percentage: taxPercentage },
        gstAmount: taxAmount,
        taxPercentage,
        tax_percentage: taxPercentage,
        taxAmount,
        tax_amount: taxAmount,
        discount: {
          enabled: basicDiscountPercentage > 0 || otherDiscountValue > 0,
          type: 'percentage',
          value: basicDiscountPercentage,
          otherType: otherDiscountType,
          otherValue: otherDiscountValue,
        },
        basicDiscountPercentage,
        basic_discount_percentage: basicDiscountPercentage,
        basicDiscountAmount,
        basic_discount_amount: basicDiscountAmount,
        otherDiscountType,
        other_discount_type: otherDiscountType,
        otherDiscountValue,
        other_discount_value: otherDiscountValue,
        otherDiscountAmount,
        other_discount_amount: otherDiscountAmount,
        coupon_code: fullOrder.coupon_code || '',
        coupon_discount: Number(fullOrder.coupon_discount || 0),
        referral_code: fullOrder.referral_code || '',
        referral_customer_discount: Number(fullOrder.referral_customer_discount || 0),
        delivery_fee: Number(fullOrder.delivery_fee || 0),
        grandTotal: payableAmount,
        payableAmount,
        payable_amount: payableAmount,
        paidAmount,
        paid_amount: paidAmount,
        balanceDue: 0,
        remainingAmount: 0,
        paymentStatus: 'paid',
        payment_status: 'paid',
        paymentMethod: paymentMethodFormatted,
        payment_method: paymentMethod,
        paymentMethodRaw: paymentMethod,
        requirementNote: conversionNote,
        requirement_note: conversionNote,
        notes: conversionNote,
        shop_details: getShopDetails(),
        shopDetails: getShopDetails(),
      };

      try {
        const apiRes = await orderService.createOfflineOrder(orderPayload);
        const serverOrderNo = apiRes?.data?.order_no || apiRes?.order_no || apiRes?.data?.orderNumber || apiRes?.orderNumber;
        if (serverOrderNo) {
          orderPayload.orderNumber = serverOrderNo;
          orderPayload.order_no = serverOrderNo;
        }
        if (apiRes?.data?.id || apiRes?.id) {
          orderPayload.id = apiRes?.data?.id || apiRes?.id;
        }
        const respShop = apiRes?.shop_details || apiRes?.data?.shop_details || null;
        if (respShop) {
          orderPayload.shop_details = respShop;
          orderPayload.shopDetails = respShop;
        }
      } catch (apiErr) {
        console.warn('API conversion error, persisting order locally:', apiErr);
      }

      // Save estimate keys to converted_estimate_ids in localStorage
      const convertedKeys = [
        String(estimateNum).toLowerCase().trim(),
        String(fullOrder.orderNumber || '').toLowerCase().trim(),
        String(fullOrder.order_no || '').toLowerCase().trim(),
        String(fullOrder.id || '').toLowerCase().trim(),
      ].filter(Boolean);

      try {
        const stored = JSON.parse(localStorage.getItem('converted_estimate_ids') || '[]');
        const newStored = Array.from(new Set([...stored.map(s => String(s).toLowerCase().trim()), ...convertedKeys]));
        localStorage.setItem('converted_estimate_ids', JSON.stringify(newStored));
      } catch (e) {}

      // Remove the converted estimate from local billing_orders, and prepend the official sales order
      try {
        const localList = JSON.parse(localStorage.getItem('billing_orders') || '[]');
        const updatedLocal = localList.filter(o => {
          const k1 = String(o.orderNumber || '').toLowerCase().trim();
          const k2 = String(o.order_no || '').toLowerCase().trim();
          const k3 = String(o.id || '').toLowerCase().trim();
          return !convertedKeys.includes(k1) && !convertedKeys.includes(k2) && !convertedKeys.includes(k3);
        });
        updatedLocal.unshift(orderPayload);
        localStorage.setItem('billing_orders', JSON.stringify(updatedLocal));
      } catch (storageErr) {
        console.warn('Failed to update localStorage with converted order:', storageErr);
      }

      if (customerName && customerName !== 'Walk-in Customer') {
        saveCustomer({ name: customerName, mobile: customerMobile, address, postalcode });
      }

      // Update state in PurchaseHistory:
      // Remove the estimate completely, prepend the newly converted sales order!
      setOrders(prev => [
        orderPayload,
        ...prev.filter(o => {
          const k1 = String(o.orderNumber || '').toLowerCase().trim();
          const k2 = String(o.order_no || '').toLowerCase().trim();
          const k3 = String(o.id || '').toLowerCase().trim();
          return !convertedKeys.includes(k1) && !convertedKeys.includes(k2) && !convertedKeys.includes(k3);
        })
      ]);

      // Move view directly to Sales Invoices so user sees the newly converted order!
      setFilterType('sales');

      setConversionSuccess({
        estimateNumber: estimateNum,
        orderNumber: orderPayload.orderNumber,
        newOrder: orderPayload,
      });

      setConvertingTarget(null);
    } catch (err) {
      console.error('Failed to convert estimate to order:', err);
      setConvertError(err.message || 'Failed to convert estimate to order. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDeleteEstimate = async (targetOrder) => {
    if (!targetOrder) return;

    // Strict safety check: only estimates can be deleted
    if (!isOrderAnEstimate(targetOrder)) {
      alert('Delete action is only applicable to estimate quotations.');
      return;
    }

    const orderNum = targetOrder.orderNumber || targetOrder.order_no || targetOrder.id;
    const isConfirmed = window.confirm(`Are you sure you want to delete Estimate #${orderNum}? This action cannot be undone.`);
    if (!isConfirmed) return;

    const targetId = targetOrder.id || targetOrder.orderNumber || targetOrder.order_no;
    setDeletingEstimateId(targetId);
    setDeleteError(null);

    try {
      // Call delete API for estimate (/crackers/order/estimates/:id)
      await orderService.deleteEstimateOrder(targetId);

      // Record in deleted_estimate_ids in localStorage
      try {
        const storedDeleted = JSON.parse(localStorage.getItem('deleted_estimate_ids') || '[]');
        const toAdd = [
          String(targetOrder.id),
          targetOrder.orderNumber ? String(targetOrder.orderNumber).toLowerCase().trim() : null,
          targetOrder.order_no ? String(targetOrder.order_no).toLowerCase().trim() : null,
        ].filter(Boolean);
        localStorage.setItem('deleted_estimate_ids', JSON.stringify([...new Set([...storedDeleted, ...toAdd])]));
      } catch (e) {}

      // Clean from localStorage billing_orders
      try {
        const localOrders = JSON.parse(localStorage.getItem('billing_orders') || '[]');
        const updatedLocal = localOrders.filter(ord => {
          const ordId = String(ord.id || ord.orderNumber || ord.order_no || '');
          const ordNum = String(ord.orderNumber || ord.order_no || '').toLowerCase().trim();
          const tId = String(targetOrder.id || targetOrder.orderNumber || targetOrder.order_no || '');
          const tNum = String(targetOrder.orderNumber || targetOrder.order_no || '').toLowerCase().trim();
          return ordId !== tId && (tNum === '' || ordNum !== tNum);
        });
        localStorage.setItem('billing_orders', JSON.stringify(updatedLocal));
      } catch (e) {}

      // Remove from current React state
      setOrders(prev => prev.filter(ord => {
        const ordId = String(ord.id || ord.orderNumber || ord.order_no || '');
        const ordNum = String(ord.orderNumber || ord.order_no || '').toLowerCase().trim();
        const tId = String(targetOrder.id || targetOrder.orderNumber || targetOrder.order_no || '');
        const tNum = String(targetOrder.orderNumber || targetOrder.order_no || '').toLowerCase().trim();
        return ordId !== tId && (tNum === '' || ordNum !== tNum);
      }));

      // Close expanded card
      setExpanded(null);

      setDeleteSuccess(`Estimate #${orderNum} has been deleted successfully.`);
      setTimeout(() => setDeleteSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to delete estimate:', err);
      setDeleteError(err.message || 'Failed to delete estimate. Please try again.');
    } finally {
      setDeletingEstimateId(null);
    }
  };

  const parseOrderTime = (order) => {
    if (!order) return 0;
    const rawDate = order.rawItem?.created_at || order.created_at || order.date;
    if (rawDate) {
      const parsedTime = Date.parse(rawDate);
      if (!isNaN(parsedTime)) return parsedTime;
    }
    if (typeof order.id === 'number') return order.id;
    const numMatch = String(order.orderNumber || '').match(/\d+/g);
    if (numMatch) return Number(numMatch.join(''));
    return 0;
  };

  const sortedOrders = React.useMemo(() => {
    return [...orders].map((ord, idx) => ({ ord, originalIndex: idx }))
      .sort((a, b) => parseOrderTime(b.ord) - parseOrderTime(a.ord));
  }, [orders]);

  const orderCounts = React.useMemo(() => {
    const total = orders.length;
    // Estimates tab only counts active, unconverted estimates
    const estimates = orders.filter(o => isOrderAnEstimate(o) && !o.convertedToOrder).length;
    const sales = total - estimates;
    return { all: total, sales, estimates };
  }, [orders]);

  const filteredOrders = React.useMemo(() => {
    let list = sortedOrders;

    if (filterType === 'sales') {
      // Sales Invoices tab shows all official sales orders (including converted orders)
      list = list.filter(({ ord }) => !isOrderAnEstimate(ord));
    } else if (filterType === 'estimates') {
      // Estimates tab shows ONLY unconverted estimates
      list = list.filter(({ ord }) => isOrderAnEstimate(ord) && !ord.convertedToOrder);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(({ ord: order }) => {
      const orderNum = String(order.orderNumber || order.order_no || '').toLowerCase();
      const custName = String(order.customer?.name || order.customer_name || '').toLowerCase();
      const custMobile = String(order.customer?.mobile || order.customer_mobile || '').toLowerCase();
      const itemsMatch = Array.isArray(order.items) && order.items.some(item =>
        String(item.name || item.product_name || '').toLowerCase().includes(q)
      );
      return (
        orderNum.includes(q) ||
        custName.includes(q) ||
        custMobile.includes(q) ||
        itemsMatch
      );
    });
  }, [sortedOrders, searchQuery, filterType]);

  const activeSelected = React.useMemo(() => {
    if (!filteredOrders || filteredOrders.length === 0) return null;
    if (selectedOrderKey) {
      const found = filteredOrders.find(({ ord }) => String(ord.id || ord.orderNumber || ord.order_no) === String(selectedOrderKey));
      if (found) return found;
    }
    return filteredOrders[0];
  }, [filteredOrders, selectedOrderKey]);

  useEffect(() => {
    if (activeSelected?.ord?.id && (!activeSelected.ord.items || activeSelected.ord.items.length === 0)) {
      const targetId = activeSelected.ord.id;
      setLoadingDetailId(targetId);
      orderService.getOrderById(targetId).then(detail => {
        setLoadingDetailId(null);
        if (detail) {
          setOrders(prev => prev.map(o => (o.id === targetId || o.orderNumber === activeSelected.ord.orderNumber ? { ...o, ...detail } : o)));
        }
      }).catch(() => setLoadingDetailId(null));
    }
  }, [activeSelected?.ord?.id]);

  return (
    <div className="modal-overlay history-overlay" onClick={handleBackdrop}>
      <div className="history-modal clay-card" onClick={e => e.stopPropagation()}>
        <div className="history-header">
          <div className="history-title">
            <div className="history-header-icon-badge">
              <Receipt size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2>Purchase History</h2>
                <span className="history-count">{filteredOrders.length}</span>
              </div>
              <div className="history-header-stats-row">
                <span className="history-stat-chip sales">Sales: {orderCounts.sales}</span>
                <span className="history-stat-chip estimates">Estimates: {orderCounts.estimates}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="history-refresh-btn"
              onClick={() => fetchOrders(true)}
              title="Refresh orders from API"
            >
              <RefreshCw size={15} className={isRefreshing ? 'button-spinner' : ''} />
              <span className="history-refresh-lbl">Refresh</span>
            </button>
            <button className="history-close" onClick={onClose} aria-label="Close purchase history">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="history-top-controls-bar">
          <div className="history-type-tabs">
            <button
              type="button"
              className={`history-tab-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              <span>All</span>
              <span className="history-tab-count">({orderCounts.all})</span>
            </button>
            <button
              type="button"
              className={`history-tab-btn sales ${filterType === 'sales' ? 'active' : ''}`}
              onClick={() => setFilterType('sales')}
            >
              <span className="tab-lbl-full">Sales Invoices</span>
              <span className="tab-lbl-short">Sales</span>
              <span className="history-tab-count">({orderCounts.sales})</span>
            </button>
            <button
              type="button"
              className={`history-tab-btn estimates ${filterType === 'estimates' ? 'active' : ''}`}
              onClick={() => setFilterType('estimates')}
            >
              <span className="tab-lbl-full">Estimates / Quotations</span>
              <span className="tab-lbl-short">Estimates</span>
              <span className="history-tab-count">({orderCounts.estimates})</span>
            </button>
          </div>

          <div className="history-search-wrapper">
            <Search size={15} className="history-search-icon" />
            <input
              type="text"
              className="history-search-input"
              placeholder="Search by customer name, mobile, order #, or item..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="history-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="history-body">
          <div className="history-web-workspace">
            <div className="history-web-list-col">
              {deleteSuccess && (
            <div style={{
              margin: '0 0 16px',
              padding: '10px 14px',
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#065f46',
              fontSize: 13,
              fontWeight: 700,
            }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>{deleteSuccess}</span>
            </div>
          )}

          {deleteError && (
            <div style={{
              margin: '0 0 16px',
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#991b1b',
              fontSize: 13,
              fontWeight: 700,
            }}>
              ⚠️ {deleteError}
            </div>
          )}

          {conversionSuccess && (
            <div className="conversion-success-banner" style={{
              margin: '0 0 16px',
              padding: '12px 16px',
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={20} color="#059669" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, color: '#065f46', fontSize: 13.5 }}>
                    Successfully converted to Order #{conversionSuccess.orderNumber}!
                  </div>
                  <div style={{ fontSize: 11.5, color: '#047857' }}>
                    Estimate #{conversionSuccess.estimateNumber} is now a completed sales invoice.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  className="history-btn"
                  onClick={() => handlePrintBill(conversionSuccess.newOrder)}
                  style={{
                    background: '#059669',
                    color: '#ffffff',
                    fontWeight: 700,
                    padding: '6px 12px',
                    fontSize: 12,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Printer size={13} /> Print Bill
                </button>
                <button
                  type="button"
                  className="history-btn"
                  onClick={() => handlePrintA4Bill(conversionSuccess.newOrder)}
                  style={{ background: '#eef2ff', color: '#3730a3', fontWeight: 700, padding: '6px 12px', fontSize: 12, borderRadius: 8, border: '1px solid #c7d2fe', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={13} /> A4 Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setConversionSuccess(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#047857',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'grid',
                    placeItems: 'center'
                  }}
                  title="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <LoaderCircle size={36} className="button-spinner" style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
              <h3>Loading Orders</h3>
              <p>Fetching purchase history from server...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <ShoppingBag size={40} />
              <h3>No orders yet</h3>
              <p>Completed orders will appear here</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <Search size={40} style={{ color: 'var(--text-muted)' }} />
              <h3>No matching orders</h3>
              <p>No orders found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredOrders.map(({ ord: order, originalIndex }, displayIdx) => {
              const isExpanded = expanded === displayIdx;
              const isEditingThis = editingOrderIndex === originalIndex;
              const currentData = isEditingThis ? editedOrderData : order;

              const orderItems = currentData.items || [];
              const orderSubtotal = Number(currentData.subtotal) || orderItems.reduce((s, i) => s + ((Number(i.discountedPrice || i.price || 0)) * Number(i.quantity || 1)), 0);
              const orderGst = Number(currentData.gstAmount || 0);

              const refPercent = Number(currentData.referral_customer_discount || currentData.referralDiscountPercentage || 0);
              let refDisc = Number(currentData.referralDiscountAmount || 0);
              if (refDisc <= 0 && refPercent > 0) {
                refDisc = (orderSubtotal * refPercent) / 100;
              }
              const orderDiscount = Number(currentData.discountAmount || 0);
              const totalDisc = orderDiscount > 0 ? orderDiscount : refDisc;
              const otherDisc = Math.max(0, totalDisc - refDisc);
              const orderGrandTotal = Number(currentData.grandTotal || currentData.payableAmount || 0) > 0 && Math.abs(Number(currentData.grandTotal || currentData.payableAmount) - (orderSubtotal + orderGst - totalDisc)) < 1
                ? Number(currentData.grandTotal || currentData.payableAmount)
                : Math.max(0, Number((orderSubtotal + orderGst - totalDisc).toFixed(2)));

              const currentStatus = String(currentData.paymentStatus || (Number(currentData.balanceDue ?? 0) === 0 ? 'paid' : 'partial')).toLowerCase();
              const isPaid = currentStatus === 'paid';
              const paidAmount = Number(currentData.paidAmount ?? (isPaid ? orderGrandTotal : (orderGrandTotal - Number(currentData.balanceDue || 0))));
              const balanceDue = (isPaid || paidAmount >= orderGrandTotal || currentStatus === 'refunded')
                ? 0
                : Number(currentData.balanceDue ?? currentData.remainingAmount ?? Math.max(0, orderGrandTotal - paidAmount));
              const isCurrentEstimate = Boolean(currentData.is_estimate === '1' || currentData.isEstimate || currentData.order_type === 'estimate');
              const itemKey = String(currentData.id || currentData.orderNumber || currentData.order_no);
              const isSelectedOnWeb = activeSelected && String(activeSelected.ord.id || activeSelected.ord.orderNumber || activeSelected.ord.order_no) === itemKey;

              return (
                <div key={currentData.id || originalIndex} className={`history-order ${isExpanded ? 'expanded' : ''} ${isSelectedOnWeb ? 'web-selected' : ''} ${isEditingThis ? 'is-editing-mode' : ''}`}>
                  <button
                    className="history-order-summary"
                    onClick={async () => {
                      setSelectedOrderKey(itemKey);
                      if (isEditingThis) return;
                      const nextExpanded = isExpanded ? null : displayIdx;
                      setExpanded(nextExpanded);
                      if (currentData.id && (!currentData.items || currentData.items.length === 0)) {
                        setLoadingDetailId(currentData.id);
                        const orderDetail = await orderService.getOrderById(currentData.id);
                        setLoadingDetailId(null);
                        if (orderDetail) {
                          setOrders(prev => prev.map(o => (o.id === currentData.id || o.orderNumber === currentData.orderNumber ? { ...o, ...orderDetail } : o)));
                        }
                      }
                    }}
                    aria-expanded={isExpanded}
                  >
                    <div className="history-order-left">
                      <div className="history-order-head">
                        <span className="history-order-num">{currentData.orderNumber}</span>
                        {isCurrentEstimate ? (
                          <span className="estimate-pill-badge" style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: '0.4px',
                            textTransform: 'uppercase'
                          }}>
                            ESTIMATE
                          </span>
                        ) : (
                          <span className={`payment-status-badge status-${String(currentData.paymentStatus || (balanceDue === 0 ? 'paid' : 'partial')).toLowerCase()}`}>
                            {String(currentData.paymentStatus || (balanceDue === 0 ? 'paid' : 'partial')).toUpperCase()}
                          </span>
                        )}
                        {currentData.convertedFromEstimate && (
                          <span className="converted-order-badge" style={{
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <CheckCircle2 size={11} /> Converted from #{currentData.convertedFromEstimate}
                          </span>
                        )}
                        {currentData.convertedToOrder && (
                          <span className="converted-order-badge" style={{
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <CheckCircle2 size={11} /> Converted: {currentData.convertedToOrder}
                          </span>
                        )}
                        {isEditingThis && <span className="history-editing-badge">Editing</span>}
                      </div>
                      <div className="history-order-customer-info">
                        <span className="customer-name-tag">
                          <User size={12} /> {currentData.customer?.name || currentData.customer_name || 'Walk-in Customer'}
                        </span>
                        {(currentData.customer?.mobile || currentData.customer_mobile) ? (
                          <span className="customer-mobile-tag">
                            <Phone size={11} /> {currentData.customer?.mobile || currentData.customer_mobile}
                          </span>
                        ) : null}
                        {(currentData.referral_code || currentData.referralCode) && (
                          <span className="customer-referral-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', background: '#e0e7ff', color: '#4338ca', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                            Ref: {currentData.referral_code || currentData.referralCode}
                            {refPercent > 0 && (
                              <span>({refPercent}% off)</span>
                            )}
                          </span>
                        )}
                      </div>
                      <span className="history-order-date"><Clock size={11} /> {currentData.date}</span>
                    </div>
                    <div className="history-order-right">
                      <span className="history-order-total">{fmt(orderGrandTotal)}</span>
                      {isCurrentEstimate && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="history-quick-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEstimate(currentData);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              handleDeleteEstimate(currentData);
                            }
                          }}
                          title="Delete Estimate Quotation"
                          aria-label="Delete Estimate Quotation"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            color: '#dc2626',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            cursor: 'pointer',
                            marginLeft: '6px',
                          }}
                        >
                          {deletingEstimateId === (currentData.id || currentData.orderNumber) ? (
                            <LoaderCircle size={13} className="button-spinner" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </span>
                      )}
                      <span className="history-expand-icon">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="history-order-details">
                      {isEditingThis ? (
                        <div className="history-edit-form">
                          <div className="history-edit-field">
                            <label>Customer Name</label>
                            <input
                              type="text"
                              maxLength={50}
                              value={editedOrderData.customer?.name || ''}
                              onChange={e => {
                                const sanitized = e.target.value.replace(/[^a-zA-Z\s.'-]/g, '').replace(/^\s+/, '');
                                setEditedOrderData({
                                  ...editedOrderData,
                                  customer: { ...editedOrderData.customer, name: sanitized }
                                });
                              }}
                            />
                          </div>
                          <div className="history-edit-field">
                            <label>Mobile No</label>
                            <input
                              type="tel"
                              maxLength={10}
                              value={editedOrderData.customer?.mobile || ''}
                              onChange={e => setEditedOrderData({
                                ...editedOrderData,
                                customer: { ...editedOrderData.customer, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }
                              })}
                            />
                          </div>
                          <div className="history-edit-field">
                            <label>Payment Status</label>
                            <select
                              className="history-edit-select"
                              value={editedOrderData.paymentStatus || 'paid'}
                              onChange={e => handlePaymentStatusChange(e.target.value)}
                            >
                              <option value="paid">PAID</option>
                              <option value="partial">PARTIAL</option>
                              <option value="unpaid">UNPAID / PENDING</option>
                              <option value="refunded">REFUNDED</option>
                              <option value="failed">FAILED</option>
                            </select>
                          </div>
                          <div className="history-edit-field">
                            <label>Payment Mode</label>
                            <select
                              className="history-edit-select"
                              value={(editedOrderData.paymentMethod || editedOrderData.payment_method || 'cash').toLowerCase()}
                              onChange={e => setEditedOrderData({
                                ...editedOrderData,
                                paymentMethod: e.target.value,
                                payment_method: e.target.value,
                              })}
                            >
                              <option value="cash">CASH</option>
                              <option value="upi">UPI</option>
                              <option value="card">CARD</option>
                            </select>
                          </div>
                          {editedOrderData.paymentStatus === 'partial' && (
                            <div className="history-edit-field" style={{ gridColumn: '1 / -1' }}>
                              <label>Paid Amount (₹)</label>
                              <input
                                type="number"
                                min="0"
                                max={orderGrandTotal}
                                value={editedOrderData.paidAmount ?? ''}
                                onChange={e => handlePaidAmountChange(e.target.value)}
                                placeholder="Enter partial paid amount"
                              />
                            </div>
                          )}
                          <div className="history-edit-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Requirement Note</label>
                            <input
                              type="text"
                              placeholder="Requirement note / instructions"
                              value={editedOrderData.requirement_note || editedOrderData.requirementNote || ''}
                              onChange={e => setEditedOrderData({
                                ...editedOrderData,
                                requirement_note: e.target.value,
                                requirementNote: e.target.value,
                                order_notes: e.target.value,
                                notes: e.target.value,
                              })}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="history-meta-card">
                          <div className="history-info-row">
                            <span className="info-label"><User size={13} /> Customer</span>
                            <span className="info-val">{currentData.customer?.name || currentData.customer_name || 'Walk-in Customer'}</span>
                          </div>
                          <div className="history-info-row">
                            <span className="info-label"><Phone size={13} /> Mobile</span>
                            <span className="info-val">{currentData.customer?.mobile || currentData.customer_mobile || '-'}</span>
                          </div>
                          {(currentData.requirement_note || currentData.requirementNote || currentData.order_notes || currentData.notes) && (
                            <div className="history-info-row" style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '6px 8px', borderRadius: '6px', border: '1px dashed #f59e0b' }}>
                              <span className="info-label" style={{ color: '#d97706', fontWeight: 800 }}><FileText size={13} /> Note</span>
                              <span className="info-val" style={{ color: '#b45309', fontWeight: 700, wordBreak: 'break-word' }}>
                                {currentData.requirement_note || currentData.requirementNote || currentData.order_notes || currentData.notes}
                              </span>
                            </div>
                          )}
                          {(currentData.address || currentData.customer?.address) && (
                            <div className="history-info-row">
                              <span className="info-label"><MapPin size={13} /> Address</span>
                              <span className="info-val">
                                {currentData.address || currentData.customer?.address}
                                {(currentData.postalcode || currentData.customer?.postalcode) ? ` - ${currentData.postalcode || currentData.customer?.postalcode}` : ''}
                              </span>
                            </div>
                          )}
                          <div className="history-info-row">
                            <span className="info-label"><CreditCard size={13} /> Payment</span>
                            <span className="info-val" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <span className="payment-badge">{String(currentData.paymentMethod || 'Cash').toUpperCase()}</span>
                              <span className={`payment-status-badge status-${String(currentData.paymentStatus || (balanceDue === 0 ? 'paid' : 'partial')).toLowerCase()}`}>
                                {String(currentData.paymentStatus || (balanceDue === 0 ? 'paid' : 'partial')).toUpperCase()}
                              </span>
                            </span>
                          </div>
                          {(currentData.referral_code || currentData.referralCode) && (
                            <div className="history-info-row">
                              <span className="info-label"><Tag size={13} /> Referral Code</span>
                              <span className="info-val" style={{ color: '#4338ca', fontWeight: 700 }}>
                                {currentData.referral_code || currentData.referralCode}
                                {refPercent > 0 ? ` (${refPercent}% customer discount)` : ''}
                              </span>
                            </div>
                          )}
                          {currentData.id && (
                            <div className="history-info-row">
                              <span className="info-label"><Receipt size={13} /> Order Ref</span>
                              <span className="info-val">#{currentData.id} • {currentData.rawItem?.order_type ? String(currentData.rawItem.order_type).toUpperCase() : 'OFFLINE'}</span>
                            </div>
                          )}
                          {(currentData.shop_details?.shop_name || currentData.shopDetails?.shop_name) && (
                            <div className="history-info-row">
                              <span className="info-label"><Store size={13} /> Store</span>
                              <span className="info-val">{currentData.shop_details?.shop_name || currentData.shopDetails?.shop_name}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="history-items-container">
                        <div className="history-items-header">
                          Items ({currentData.items?.length || 0})
                        </div>
                        {loadingDetailId === currentData.id ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 }}>
                            <LoaderCircle size={16} className="button-spinner" /> Loading order items...
                          </div>
                        ) : (!currentData.items || currentData.items.length === 0) ? (
                          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: 12 }}>
                            No items recorded for this order
                          </div>
                        ) : (
                          currentData.items?.map((item, i) => (
                            <div key={i} className="history-item-row">
                              <div className="history-item-left">
                                <span className="item-index">{i + 1}</span>
                                <span className="item-name" title={item.name}>
                                  {item.product_code || item.code ? `[${item.product_code || item.code}] ` : ''}
                                  {item.name}
                                </span>
                              </div>
                              <div className="history-item-right">
                                {isEditingThis ? (
                                  <div className="history-qty-ctrls">
                                    <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleUpdateItemQty(i, item.quantity - 1)}>
                                      {item.quantity === 1 ? <Trash2 size={12} color="#ef4444" /> : <Minus size={12} />}
                                    </button>
                                    {editingQtyItemIndex === i ? (
                                      <input
                                        type="number"
                                        min="1"
                                        max={item.stock || 9999}
                                        className="qty-inline-input history-inline-input"
                                        value={tempQtyInput}
                                        autoFocus
                                        onChange={e => setTempQtyInput(e.target.value)}
                                        onBlur={() => {
                                          setEditingQtyItemIndex(null);
                                          const parsed = parseInt(tempQtyInput, 10);
                                          if (isNaN(parsed) || parsed <= 0) {
                                            handleUpdateItemQty(i, 0);
                                          } else {
                                            handleUpdateItemQty(i, parsed);
                                          }
                                        }}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') e.currentTarget.blur();
                                          else if (e.key === 'Escape') setEditingQtyItemIndex(null);
                                        }}
                                      />
                                    ) : (
                                      <strong
                                        onClick={() => {
                                          setEditingQtyItemIndex(i);
                                          setTempQtyInput(item.quantity);
                                        }}
                                        title="Click to type quantity manually"
                                        style={{ cursor: 'pointer' }}
                                      >
                                        {item.quantity}
                                      </strong>
                                    )}
                                    <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleUpdateItemQty(i, item.quantity + 1)}>
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="history-qty-badge">x{item.quantity}</span>
                                )}
                                <span className="history-item-total">{fmt((item.discountedPrice || item.price || 0) * item.quantity)}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="history-totals-card">
                        <div className="history-info-row"><span>Subtotal</span><span>{fmt(orderSubtotal)}</span></div>
                        {refDisc > 0 && (
                          <div className="history-info-row" style={{ color: 'var(--success)' }}>
                            <span>Referral Discount ({refPercent}%)</span>
                            <span>-{fmt(refDisc)}</span>
                          </div>
                        )}
                        {otherDisc > 0 && (
                          <div className="history-info-row" style={{ color: 'var(--success)' }}>
                            <span>{refDisc > 0 ? 'Other Discount' : 'Discount'}</span>
                            <span>-{fmt(otherDisc)}</span>
                          </div>
                        )}
                        {orderGst > 0 && (
                          <div className="history-info-row">
                            <span>GST ({currentData.taxPercentage || 18}%)</span>
                            <span>{fmt(orderGst)}</span>
                          </div>
                        )}
                        <div className="history-info-row grand-total-row">
                          <span>Total Amount</span>
                          <strong className="grand-total-val">{fmt(orderGrandTotal)}</strong>
                        </div>
                        {(paidAmount > 0 || isPaid || balanceDue > 0) && (
                          <>
                            <div className="history-info-row" style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border, #e2e8f0)', color: 'var(--text-main, #1e293b)', fontWeight: 600 }}>
                              <span>Paid Amount</span>
                              <span>{fmt(paidAmount)}</span>
                            </div>
                            {balanceDue > 0 && (
                              <div className="history-info-row" style={{ color: '#ef4444', fontWeight: 700 }}>
                                <span>Balance Due</span>
                                <span>{fmt(balanceDue)}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="history-actions-bar">
                        {isEditingThis ? (
                          <>
                            <button type="button" className="history-btn history-save-btn" onClick={handleSaveEdit} disabled={isSaving}>
                              {isSaving ? <LoaderCircle size={14} className="button-spinner" /> : <Save size={14} />}
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button type="button" className="history-btn history-cancel-btn" onClick={handleCancelEdit} disabled={isSaving}>
                              Cancel
                            </button>
                            {saveError && (
                              <span style={{ fontSize: 11, color: '#d97706', width: '100%', marginTop: 4 }}>
                                ⚠️ {saveError}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="history-btn history-print-bill-btn"
                              onClick={() => handlePrintBill(currentData, originalIndex)}
                            >
                              <Printer size={14} /> {isCurrentEstimate ? 'Print Estimate' : 'Print Bill'}
                            </button>
                            <button
                              type="button"
                              className="history-btn"
                              onClick={() => handlePrintA4Bill(currentData)}
                            >
                              <Printer size={14} /> A4 Sheet
                            </button>
                            <button
                              type="button"
                              className="history-btn history-share-bill-btn"
                              onClick={() => handleShareBill(currentData)}
                              style={{ background: '#ecfdf3', borderColor: '#a7dfba', color: '#12843f' }}
                            >
                              <MessageCircle size={14} /> {isCurrentEstimate ? 'Share Estimate' : 'Share Bill'}
                            </button>
                            <button
                              type="button"
                              className="history-btn history-edit-bill-btn"
                              onClick={() => handleStartEdit(currentData, originalIndex)}
                            >
                              <Edit3 size={14} /> Edit Bill Data
                            </button>
                            {isCurrentEstimate ? (
                              <>
                                {currentData.convertedToOrder ? (
                                  <button
                                    type="button"
                                    className="history-btn history-convert-order-btn is-converted"
                                    title={`Already converted to sales order ${currentData.convertedToOrder}`}
                                    onClick={() => {
                                      setFilterType('sales');
                                      setSearchQuery(currentData.convertedToOrder);
                                    }}
                                  >
                                    <CheckCircle2 size={14} /> Converted: {currentData.convertedToOrder}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="history-btn history-convert-order-btn"
                                    onClick={() => handleOpenConvertModal(currentData)}
                                    disabled={loadingDetailId === currentData.id || deletingEstimateId === (currentData.id || currentData.orderNumber)}
                                    title="Convert this estimate into an official sales order"
                                  >
                                    <ShoppingBag size={14} /> Convert to Order
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="history-btn history-load-cart-btn"
                                  onClick={() => handleLoadToCart(currentData)}
                                  disabled={loadingDetailId === currentData.id || deletingEstimateId === (currentData.id || currentData.orderNumber)}
                                  title="Load this estimate items and customer details into active cart"
                                >
                                  {loadingDetailId === currentData.id ? (
                                    <LoaderCircle size={14} className="button-spinner" />
                                  ) : (
                                    <ShoppingCart size={14} />
                                  )}
                                  Load to Active Cart
                                </button>
                                <button
                                  type="button"
                                  className="history-btn history-delete-estimate-btn"
                                  onClick={() => handleDeleteEstimate(currentData)}
                                  disabled={deletingEstimateId === (currentData.id || currentData.orderNumber)}
                                  title="Delete this estimate quotation"
                                  style={{
                                    background: '#fef2f2',
                                    borderColor: '#fca5a5',
                                    color: '#dc2626',
                                    fontWeight: 700,
                                  }}
                                >
                                  {deletingEstimateId === (currentData.id || currentData.orderNumber) ? (
                                    <LoaderCircle size={14} className="button-spinner" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                  {deletingEstimateId === (currentData.id || currentData.orderNumber) ? 'Deleting...' : 'Delete Estimate'}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="history-btn history-load-cart-btn"
                                onClick={() => handleLoadToCart(currentData)}
                              >
                                <ShoppingCart size={14} /> Load to Active Cart
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
            </div>

            <div className="history-web-detail-col">
              {activeSelected ? (() => {
                const selectedOrd = activeSelected.ord;
                const selectedOriginalIndex = activeSelected.originalIndex;
                const isSelectedEditing = editingOrderIndex === selectedOriginalIndex;
                const detailData = isSelectedEditing ? editedOrderData : selectedOrd;

                const detailItems = detailData.items || [];
                const detailSubtotal = Number(detailData.subtotal) || detailItems.reduce((s, i) => s + ((Number(i.discountedPrice || i.price || 0)) * Number(i.quantity || 1)), 0);
                const detailGst = Number(detailData.gstAmount || 0);

                const detailRefPercent = Number(detailData.referral_customer_discount || detailData.referralDiscountPercentage || 0);
                let detailRefDisc = Number(detailData.referralDiscountAmount || 0);
                if (detailRefDisc <= 0 && detailRefPercent > 0) {
                  detailRefDisc = (detailSubtotal * detailRefPercent) / 100;
                }
                const detailOrderDiscount = Number(detailData.discountAmount || 0);
                const detailTotalDisc = detailOrderDiscount > 0 ? detailOrderDiscount : detailRefDisc;
                const detailOtherDisc = Math.max(0, detailTotalDisc - detailRefDisc);
                const detailGrandTotal = Number(detailData.grandTotal || detailData.payableAmount || 0) > 0 && Math.abs(Number(detailData.grandTotal || detailData.payableAmount) - (detailSubtotal + detailGst - detailTotalDisc)) < 1
                  ? Number(detailData.grandTotal || detailData.payableAmount)
                  : Math.max(0, Number((detailSubtotal + detailGst - detailTotalDisc).toFixed(2)));

                const currentDetailStatus = String(detailData.paymentStatus || (Number(detailData.balanceDue ?? 0) === 0 ? 'paid' : 'partial')).toLowerCase();
                const isDetailPaid = currentDetailStatus === 'paid';
                const detailPaidAmount = Number(detailData.paidAmount ?? (isDetailPaid ? detailGrandTotal : (detailGrandTotal - Number(detailData.balanceDue || 0))));
                const detailBalanceDue = (isDetailPaid || detailPaidAmount >= detailGrandTotal || currentDetailStatus === 'refunded')
                  ? 0
                  : Number(detailData.balanceDue ?? detailData.remainingAmount ?? Math.max(0, detailGrandTotal - detailPaidAmount));
                const isSelectedEstimate = Boolean(detailData.is_estimate === '1' || detailData.isEstimate || detailData.order_type === 'estimate');

                return (
                  <div className="history-web-detail-content">
                    {/* Header Card */}
                    <div className="desktop-detail-header-card">
                      <div className="desktop-detail-title-wrap">
                        <div className="desktop-detail-badge-row">
                          {isSelectedEstimate ? (
                            <span className="desktop-doc-badge estimate">ESTIMATE QUOTATION</span>
                          ) : (
                            <span className="desktop-doc-badge invoice">SALES INVOICE</span>
                          )}
                          {!isSelectedEstimate && (
                            <span className={`payment-status-badge status-${String(detailData.paymentStatus || (detailBalanceDue === 0 ? 'paid' : 'partial')).toLowerCase()}`}>
                              {String(detailData.paymentStatus || (detailBalanceDue === 0 ? 'paid' : 'partial')).toUpperCase()}
                            </span>
                          )}
                          {detailData.convertedFromEstimate && (
                            <span className="converted-order-badge">
                              <CheckCircle2 size={12} /> Converted from #{detailData.convertedFromEstimate}
                            </span>
                          )}
                          {detailData.convertedToOrder && (
                            <span className="converted-order-badge">
                              <CheckCircle2 size={12} /> Converted: {detailData.convertedToOrder}
                            </span>
                          )}
                          {isSelectedEditing && <span className="history-editing-badge">Editing Mode</span>}
                        </div>

                        <div className="desktop-order-number-row">
                          <h3>{detailData.orderNumber || detailData.order_no}</h3>
                          <button
                            type="button"
                            className="desktop-copy-btn"
                            onClick={() => handleCopyOrderNumber(detailData.orderNumber || detailData.order_no)}
                            title="Copy Order Number"
                          >
                            {copiedOrderNumber ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                            <span>{copiedOrderNumber ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        <div className="desktop-order-subtext">
                          <span><Clock size={12} /> {detailData.date}</span>
                          {detailData.id && <span>• Ref #{detailData.id}</span>}
                          {(detailData.shop_details?.shop_name || detailData.shopDetails?.shop_name) && (
                            <span>• <Store size={12} /> {detailData.shop_details?.shop_name || detailData.shopDetails?.shop_name}</span>
                          )}
                        </div>
                      </div>

                      <div className="desktop-detail-total-card">
                        <span className="desktop-total-sublbl">{isSelectedEstimate ? 'Estimate Total' : 'Net Payable'}</span>
                        <strong className="desktop-total-num">{fmt(detailGrandTotal)}</strong>
                        {detailBalanceDue > 0 && !isSelectedEstimate && detailData.paymentStatus !== 'refunded' && (
                          <span className="desktop-balance-tag">Balance Due: {fmt(detailBalanceDue)}</span>
                        )}
                        {detailData.paymentStatus === 'refunded' && (
                          <span className="desktop-balance-tag" style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' }}>
                            Refunded
                          </span>
                        )}
                        {detailData.paymentStatus === 'failed' && (
                          <span className="desktop-balance-tag" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}>
                            Payment Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="desktop-detail-actions-bar">
                      {isSelectedEditing ? (
                        <>
                          <button type="button" className="desktop-action-btn primary save-btn" onClick={handleSaveEdit} disabled={isSaving}>
                            {isSaving ? <LoaderCircle size={15} className="button-spinner" /> : <Save size={15} />}
                            {isSaving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button type="button" className="desktop-action-btn cancel-btn" onClick={handleCancelEdit} disabled={isSaving}>
                            Cancel
                          </button>
                          {saveError && <span className="desktop-action-error">⚠️ {saveError}</span>}
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="desktop-action-btn print-btn"
                            onClick={() => handlePrintBill(detailData, selectedOriginalIndex)}
                          >
                            <Printer size={15} /> {isSelectedEstimate ? 'Print Estimate' : 'Print Bill'}
                          </button>

                          <button
                            type="button"
                            className="desktop-action-btn"
                            onClick={() => handlePrintA4Bill(detailData)}
                          >
                            <Printer size={15} /> A4 Sheet
                          </button>

                          <button
                            type="button"
                            className="desktop-action-btn share-btn"
                            onClick={() => handleShareBill(detailData)}
                          >
                            <MessageCircle size={15} /> {isSelectedEstimate ? 'Share WhatsApp' : 'Share WhatsApp'}
                          </button>

                          <button
                            type="button"
                            className="desktop-action-btn edit-btn"
                            onClick={() => handleStartEdit(detailData, selectedOriginalIndex)}
                          >
                            <Edit3 size={15} /> Edit Bill Data
                          </button>

                          {isSelectedEstimate && (
                            detailData.convertedToOrder ? (
                              <button
                                type="button"
                                className="desktop-action-btn is-converted"
                                onClick={() => {
                                  setFilterType('sales');
                                  setSearchQuery(detailData.convertedToOrder);
                                }}
                              >
                                <CheckCircle2 size={15} /> Converted: {detailData.convertedToOrder}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="desktop-action-btn convert-btn"
                                onClick={() => handleOpenConvertModal(detailData)}
                                disabled={loadingDetailId === detailData.id || deletingEstimateId === (detailData.id || detailData.orderNumber)}
                              >
                                <ShoppingBag size={15} /> Convert to Order
                              </button>
                            )
                          )}

                          <button
                            type="button"
                            className="desktop-action-btn cart-btn"
                            onClick={() => handleLoadToCart(detailData)}
                            disabled={loadingDetailId === detailData.id || deletingEstimateId === (detailData.id || detailData.orderNumber)}
                            title="Restore items, customer details, and discounts to active cart"
                          >
                            {loadingDetailId === detailData.id ? <LoaderCircle size={15} className="button-spinner" /> : <ShoppingCart size={15} />}
                            Load to Active Cart
                          </button>

                          {isSelectedEstimate && (
                            <button
                              type="button"
                              className="desktop-action-btn delete-btn"
                              onClick={() => handleDeleteEstimate(detailData)}
                              disabled={deletingEstimateId === (detailData.id || detailData.orderNumber)}
                              title="Delete this estimate quotation"
                            >
                              {deletingEstimateId === (detailData.id || detailData.orderNumber) ? (
                                <LoaderCircle size={15} className="button-spinner" />
                              ) : (
                                <Trash2 size={15} />
                              )}
                              {deletingEstimateId === (detailData.id || detailData.orderNumber) ? 'Deleting...' : 'Delete Estimate'}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Meta Information Grid */}
                    <div className="desktop-meta-grid">
                      <div className="desktop-meta-card">
                        <div className="desktop-meta-card-title">
                          <User size={14} /> Customer Information
                        </div>
                        {isSelectedEditing ? (
                          <div className="desktop-edit-inputs">
                            <label>Name</label>
                            <input
                              type="text"
                              maxLength={50}
                              value={editedOrderData.customer?.name || ''}
                              onChange={e => {
                                const sanitized = e.target.value.replace(/[^a-zA-Z\s.'-]/g, '').replace(/^\s+/, '');
                                setEditedOrderData({
                                  ...editedOrderData,
                                  customer: { ...editedOrderData.customer, name: sanitized }
                                });
                              }}
                            />
                            <label>Mobile No</label>
                            <input
                              type="tel"
                              maxLength={10}
                              value={editedOrderData.customer?.mobile || ''}
                              onChange={e => setEditedOrderData({
                                ...editedOrderData,
                                customer: { ...editedOrderData.customer, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }
                              })}
                            />
                          </div>
                        ) : (
                          <div className="desktop-meta-card-body">
                            <div className="desktop-meta-item">
                              <span className="lbl">Name:</span>
                              <strong>{detailData.customer?.name || detailData.customer_name || 'Walk-in Customer'}</strong>
                            </div>
                            <div className="desktop-meta-item">
                              <span className="lbl">Mobile:</span>
                              <strong>{detailData.customer?.mobile || detailData.customer_mobile || '-'}</strong>
                            </div>
                            {(detailData.address || detailData.customer?.address) && (
                              <div className="desktop-meta-item">
                                <span className="lbl">Address:</span>
                                <span>{detailData.address || detailData.customer?.address} {(detailData.postalcode || detailData.customer?.postalcode) ? `(${detailData.postalcode || detailData.customer?.postalcode})` : ''}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="desktop-meta-card">
                        <div className="desktop-meta-card-title">
                          <CreditCard size={14} /> Payment & Referral Details
                        </div>
                        {isSelectedEditing ? (
                          <div className="desktop-edit-inputs">
                            <div>
                              <label>Payment Status</label>
                              <select
                                className="history-edit-select"
                                value={editedOrderData.paymentStatus || 'paid'}
                                onChange={e => handlePaymentStatusChange(e.target.value)}
                              >
                                <option value="paid">PAID</option>
                                <option value="partial">PARTIAL</option>
                                <option value="unpaid">UNPAID / PENDING</option>
                                <option value="refunded">REFUNDED</option>
                                <option value="failed">FAILED</option>
                              </select>
                            </div>
                            <div>
                              <label>Payment Mode</label>
                              <select
                                className="history-edit-select"
                                value={(editedOrderData.paymentMethod || editedOrderData.payment_method || 'cash').toLowerCase()}
                                onChange={e => setEditedOrderData({
                                  ...editedOrderData,
                                  paymentMethod: e.target.value,
                                  payment_method: e.target.value,
                                })}
                              >
                                <option value="cash">CASH</option>
                                <option value="upi">UPI</option>
                                <option value="card">CARD</option>
                              </select>
                            </div>
                            {editedOrderData.paymentStatus === 'partial' && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <label>Paid Amount (₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={detailGrandTotal}
                                  value={editedOrderData.paidAmount ?? ''}
                                  onChange={e => handlePaidAmountChange(e.target.value)}
                                  placeholder="Enter partial amount"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="desktop-meta-card-body">
                            <div className="desktop-meta-item">
                              <span className="lbl">Payment Mode:</span>
                              <span className="payment-badge">{String(detailData.paymentMethod || 'Cash').toUpperCase()}</span>
                            </div>
                            <div className="desktop-meta-item">
                              <span className="lbl">Payment Status:</span>
                              <span className={`payment-status-badge status-${String(detailData.paymentStatus || (detailBalanceDue === 0 ? 'paid' : 'partial')).toLowerCase()}`}>
                                {String(detailData.paymentStatus || (detailBalanceDue === 0 ? 'paid' : 'partial')).toUpperCase()}
                              </span>
                            </div>
                            {(detailData.referral_code || detailData.referralCode) && (
                              <div className="desktop-meta-item">
                                <span className="lbl">Referral Code:</span>
                                <span style={{ color: '#4338ca', fontWeight: 700 }}>
                                  <Tag size={12} style={{ display: 'inline', marginRight: 4 }} />
                                  {detailData.referral_code || detailData.referralCode}
                                  {detailRefPercent > 0 ? ` (${detailRefPercent}% off)` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {(detailData.requirement_note || detailData.requirementNote || detailData.order_notes || detailData.notes || isSelectedEditing) && (
                        <div className="desktop-meta-card note-card" style={{ gridColumn: '1 / -1' }}>
                          <div className="desktop-meta-card-title" style={{ color: '#d97706' }}>
                            <FileText size={14} /> Requirement Note / Instructions
                          </div>
                          {isSelectedEditing ? (
                            <input
                              type="text"
                              placeholder="Requirement note / instructions"
                              value={editedOrderData.requirement_note || editedOrderData.requirementNote || ''}
                              onChange={e => setEditedOrderData({
                                ...editedOrderData,
                                requirement_note: e.target.value,
                                requirementNote: e.target.value,
                                order_notes: e.target.value,
                                notes: e.target.value,
                              })}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #f59e0b', fontSize: 13 }}
                            />
                          ) : (
                            <div style={{ color: '#92400e', fontWeight: 600, fontSize: 13.5, lineHeight: 1.5 }}>
                              {detailData.requirement_note || detailData.requirementNote || detailData.order_notes || detailData.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Authoritative Items Table */}
                    <div className="desktop-table-container">
                      <div className="desktop-table-header">
                        <h4>Items Summary ({detailItems.length} items / {detailItems.reduce((acc, i) => acc + Number(i.quantity || 1), 0)} qty)</h4>
                      </div>
                      {loadingDetailId === detailData.id ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                          <LoaderCircle size={20} className="button-spinner" style={{ margin: '0 auto 8px' }} />
                          <div>Loading order items from catalog...</div>
                        </div>
                      ) : detailItems.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                          No items recorded for this order
                        </div>
                      ) : (
                        <table className="desktop-items-table">
                          <thead>
                            <tr>
                              <th style={{ width: 44 }}>#</th>
                              <th style={{ width: 110 }}>Code</th>
                              <th>Product Description</th>
                              <th style={{ width: 130, textAlign: 'center' }}>Quantity</th>
                              <th style={{ width: 110, textAlign: 'right' }}>Unit Price</th>
                              <th style={{ width: 120, textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailItems.map((item, i) => (
                              <tr key={i}>
                                <td style={{ color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                                <td>
                                  <span className="desktop-product-code-tag">
                                    {item.product_code || item.code || `P-${item.id}`}
                                  </span>
                                </td>
                                <td>
                                  <span className="desktop-product-name">{item.name}</span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {isSelectedEditing ? (
                                    <div className="history-qty-ctrls" style={{ margin: '0 auto' }}>
                                      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleUpdateItemQty(i, item.quantity - 1)}>
                                        {item.quantity === 1 ? <Trash2 size={12} color="#ef4444" /> : <Minus size={12} />}
                                      </button>
                                      <strong>{item.quantity}</strong>
                                      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => handleUpdateItemQty(i, item.quantity + 1)}>
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="desktop-qty-badge">x{item.quantity}</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>{fmt(item.discountedPrice || item.price || 0)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt((item.discountedPrice || item.price || 0) * item.quantity)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Totals Breakdown Card */}
                    <div className="desktop-totals-summary-card">
                      <div className="desktop-totals-col">
                        <div className="desktop-totals-row">
                          <span>Subtotal</span>
                          <strong>{fmt(detailSubtotal)}</strong>
                        </div>
                        {detailRefDisc > 0 && (
                          <div className="desktop-totals-row success">
                            <span>Referral Discount ({detailRefPercent}%)</span>
                            <strong>-{fmt(detailRefDisc)}</strong>
                          </div>
                        )}
                        {detailOtherDisc > 0 && (
                          <div className="desktop-totals-row success">
                            <span>{detailRefDisc > 0 ? 'Other Discount' : 'Discount'}</span>
                            <strong>-{fmt(detailOtherDisc)}</strong>
                          </div>
                        )}
                      </div>

                      <div className="desktop-totals-col">
                        {detailGst > 0 && (
                          <div className="desktop-totals-row">
                            <span>GST ({detailData.taxPercentage || 18}%)</span>
                            <strong>{fmt(detailGst)}</strong>
                          </div>
                        )}
                        <div className="desktop-totals-row grand-total-row">
                          <span>Total Amount</span>
                          <strong className="desktop-grand-val">{fmt(detailGrandTotal)}</strong>
                        </div>
                        {(detailPaidAmount > 0 || isDetailPaid || detailBalanceDue > 0) && (
                          <div className="desktop-totals-row balance-row">
                            <span>Paid: {fmt(detailPaidAmount)}</span>
                            {detailBalanceDue > 0 ? (
                              <span className="due-alert">Balance Due: {fmt(detailBalanceDue)}</span>
                            ) : (
                              <span className="paid-alert">Fully Paid</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="desktop-empty-selection">
                  <Receipt size={48} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                  <h4>No Order Selected</h4>
                  <p>Select an invoice or estimate quotation from the list on the left to view complete details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {convertingTarget && (
        <div className="modal-overlay convert-order-overlay" onClick={() => !isConverting && setConvertingTarget(null)}>
          <div className="convert-order-modal clay-card" onClick={e => e.stopPropagation()}>
            <div className="convert-order-header">
              <div className="convert-header-icon-wrap">
                <ShoppingBag size={20} className="convert-header-icon" />
              </div>
              <div className="convert-header-text">
                <h3>Convert Estimate to Order</h3>
                <p>Select Proposed Payment Mode & finalize official sales invoice</p>
              </div>
              <button
                type="button"
                className="convert-modal-close"
                onClick={() => !isConverting && setConvertingTarget(null)}
                aria-label="Close"
                disabled={isConverting}
              >
                <X size={18} />
              </button>
            </div>

            {convertError && (
              <div className="estimate-modal-error" role="alert" style={{ margin: '0 20px 12px' }}>
                <span>{convertError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteConvertToOrder} className="convert-order-body">
              {/* Estimate summary info bar */}
              <div className="convert-summary-strip">
                <div className="convert-summary-col">
                  <span className="convert-strip-lbl">Estimate No</span>
                  <strong className="convert-strip-val">{convertingTarget.orderNumber || convertingTarget.order_no}</strong>
                </div>
                <div className="convert-summary-col">
                  <span className="convert-strip-lbl">Customer</span>
                  <span className="convert-strip-val">{convertingTarget.customer?.name || convertingTarget.customer_name || 'Walk-in'}</span>
                </div>
                <div className="convert-summary-col">
                  <span className="convert-strip-lbl">Items</span>
                  <span className="convert-strip-val">{(convertingTarget.items || []).length} products</span>
                </div>
                <div className="convert-summary-col highlight">
                  <span className="convert-strip-lbl">Payable</span>
                  <strong className="convert-strip-val price">{fmt(convertingTarget.grandTotal || convertingTarget.payableAmount || 0)}</strong>
                </div>
              </div>

              {/* Proposed Payment Mode */}
              <div className="convert-field-group">
                <label className="convert-field-label">
                  <BadgeIndianRupee size={15} />
                  <span>Proposed Payment Mode</span>
                </label>
                <div className="estimate-payment-options convert-payment-options">
                  {[
                    { id: 'cash', label: '💵 CASH', desc: 'Cash in hand' },
                    { id: 'upi', label: '📱 UPI / QR', desc: 'GPay / PhonePe / QR' },
                    { id: 'card', label: '💳 CARD', desc: 'Debit / Credit POS' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={`estimate-payment-chip convert-payment-chip ${convertPaymentMode === m.id ? 'active' : ''}`}
                      onClick={() => setConvertPaymentMode(m.id)}
                    >
                      <span className="convert-chip-title">{m.label}</span>
                      <span className="convert-chip-sub">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Requirement Note / Remark */}
              <div className="convert-field-group">
                <label htmlFor="convert-order-remark" className="convert-field-label">
                  <ReceiptText size={15} />
                  <span>Order Remark / Requirement Note</span>
                </label>
                <input
                  id="convert-order-remark"
                  type="text"
                  className="estimate-input"
                  placeholder="e.g. Paid in full, store pickup instructions..."
                  value={convertRemark}
                  onChange={e => setConvertRemark(e.target.value)}
                />
              </div>

              <div className="convert-info-note">
                <span>ℹ️ Converting will deduct store stock and finalize this quotation into an official sales invoice with <strong>{convertPaymentMode.toUpperCase()}</strong> payment.</span>
              </div>

              <div className="convert-modal-actions">
                <button
                  type="button"
                  className="clay-btn convert-cancel-btn"
                  onClick={() => setConvertingTarget(null)}
                  disabled={isConverting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="clay-btn clay-btn-primary convert-confirm-btn"
                  disabled={isConverting}
                >
                  {isConverting ? (
                    <>
                      <LoaderCircle size={16} className="spin-icon button-spinner" />
                      <span>Converting to Order...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={16} />
                      <span>Confirm & Convert ({fmt(convertingTarget.grandTotal || convertingTarget.payableAmount || 0)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
