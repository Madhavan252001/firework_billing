import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Camera,
  Keyboard,
  X,
  RefreshCw,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useCart } from '../context/CartContext';

// Subtle barcode beep sound generator
function playScannerBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, ctx.currentTime); // Crisp scanner tone
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (err) {
    // Audio context not allowed or not supported
  }
}

export default function BarcodeScannerModal({ isOpen, onClose, products = [] }) {
  const { addToCart, triggerStockError } = useCart();
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'hardware'
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
  const [manualCode, setManualCode] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null); // { type: 'success'|'error', message: string }
  const [cameraError, setCameraError] = useState('');
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  const html5QrCodeRef = useRef(null);
  const lastScannedTimeRef = useRef(0);
  const hardwareInputRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  // Helper to find product by scanned text (checks product_code, code, id, or name)
  const findProductByCode = useCallback((rawCode) => {
    if (!rawCode) return null;
    const clean = String(rawCode).trim().toLowerCase();

    return products.find(p => {
      const pCode = String(p.product_code || '').toLowerCase();
      const code = String(p.code || '').toLowerCase();
      const id = String(p.id || '').toLowerCase();
      const name = String(p.name || '').toLowerCase();

      return pCode === clean || code === clean || id === clean || name === clean;
    });
  }, [products]);

  // Handle adding product from barcode
  const handleBarcodeDetected = useCallback((detectedCode) => {
    const now = Date.now();
    // Debounce duplicate scans within 1.8 seconds
    if (now - lastScannedTimeRef.current < 1800) {
      return;
    }
    lastScannedTimeRef.current = now;

    const matched = findProductByCode(detectedCode);

    if (matched) {
      const matchedStock = matched.stock_count !== undefined ? matched.stock_count : (matched.stock ?? 0);
      if (matchedStock <= 0) {
        triggerStockError(`Product ${matched.name} is out of stock.`);
        setScanFeedback({
          type: 'error',
          message: `Out of stock: ${matched.name} (${matched.product_code || matched.code})`,
        });
        return;
      }

      addToCart({ ...matched, stock: matchedStock, stock_count: matchedStock }, 1);
      playScannerBeep();
      setScanFeedback({
        type: 'success',
        message: `Added to bill: ${matched.name} (${matched.product_code || matched.code})`,
      });
    } else {
      setScanFeedback({
        type: 'error',
        message: `No product found for code "${detectedCode}"`,
      });
    }

    window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setScanFeedback(null), 3500);
  }, [addToCart, findProductByCode, triggerStockError]);

  // Handle manual / hardware code submit
  const handleManualSubmit = (e) => {
    if (e) e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;

    handleBarcodeDetected(code);
    setManualCode('');
    hardwareInputRef.current?.focus();
  };

  // Start camera scanning
  const startCamera = useCallback(async () => {
    const elementId = 'barcode-camera-viewport';
    const element = document.getElementById(elementId);
    if (!element) return;

    // Stop existing instance if any
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        // ignore
      }
      html5QrCodeRef.current = null;
    }

    setIsCameraStarting(true);
    setCameraError('');

    try {
      const scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = scanner;

      const config = {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      };

      await scanner.start(
        { facingMode: cameraFacing },
        config,
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {
          // Frame error callback (safe to ignore in continuous stream)
        }
      );
    } catch (err) {
      console.warn('Camera scan initialization error:', err);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera permissions in your browser.'
          : 'Unable to start camera stream. You can use the "Hardware / Code" tab.'
      );
    } finally {
      setIsCameraStarting(false);
    }
  }, [cameraFacing, handleBarcodeDetected]);

  // Stop camera scanning
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        // ignore
      }
      html5QrCodeRef.current = null;
    }
  }, []);

  // Manage Camera on open/tab change
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return undefined;
    }

    if (activeTab === 'camera') {
      const timer = setTimeout(() => {
        startCamera();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
      setTimeout(() => hardwareInputRef.current?.focus(), 100);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, cameraFacing, startCamera, stopCamera]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay scanner-modal-overlay" onClick={onClose}>
      <div
        className="scanner-modal clay-card"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-modal-title"
      >
        {/* Header */}
        <div className="scanner-modal-header">
          <div className="scanner-header-left">
            <div className="scanner-icon-badge">
              <QrCode size={22} />
            </div>
            <div>
              <h2 id="scanner-modal-title" className="scanner-title">
                Barcode / QR Scanner
              </h2>
              <p className="scanner-subtitle">
                Scan product code to add directly to bill
              </p>
            </div>
          </div>
          <button
            type="button"
            className="scanner-close-btn"
            onClick={onClose}
            aria-label="Close Scanner"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Segmented Control */}
        <div className="scanner-tab-control" role="tablist" aria-label="Scanner Mode">
          <button
            type="button"
            className={`scanner-tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
            role="tab"
            aria-selected={activeTab === 'camera'}
          >
            <Camera size={16} />
            <span>Mobile Camera</span>
          </button>
          <button
            type="button"
            className={`scanner-tab-btn ${activeTab === 'hardware' ? 'active' : ''}`}
            onClick={() => setActiveTab('hardware')}
            role="tab"
            aria-selected={activeTab === 'hardware'}
          >
            <Keyboard size={16} />
            <span>Hardware / Code</span>
          </button>
        </div>

        {/* Feedback Alert Toast */}
        {scanFeedback && (
          <div className={`scanner-feedback-banner ${scanFeedback.type}`} role="status">
            {scanFeedback.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{scanFeedback.message}</span>
          </div>
        )}

        {/* Tab 1: Mobile Camera View */}
        {activeTab === 'camera' && (
          <div className="scanner-camera-container">
            <div className="camera-viewport-wrap">
              {/* HTML5 QR Camera Element */}
              <div id="barcode-camera-viewport" className="camera-viewport" />

              {/* Viewport Overlay Target Graphics */}
              <div className="camera-targeting-reticle" aria-hidden="true">
                <span className="reticle-corner corner-tl" />
                <span className="reticle-corner corner-tr" />
                <span className="reticle-corner corner-bl" />
                <span className="reticle-corner corner-br" />
                <div className="reticle-laser-box">
                  <span className="reticle-laser-line" />
                </div>
              </div>

              {isCameraStarting && (
                <div className="camera-loading-overlay">
                  <span>Starting camera...</span>
                </div>
              )}

              {cameraError && (
                <div className="camera-error-overlay">
                  <AlertCircle size={24} />
                  <p>{cameraError}</p>
                </div>
              )}
            </div>

            <div className="camera-actions-row">
              <button
                type="button"
                className="camera-switch-btn"
                onClick={() => setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'))}
              >
                <RefreshCw size={14} />
                <span>Switch Camera ({cameraFacing === 'environment' ? 'Rear' : 'Front'})</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Hardware / Code View */}
        {activeTab === 'hardware' && (
          <div className="scanner-hardware-container">
            {/* Green Ready Banner */}
            <div className="scanner-ready-banner">
              <span className="ready-pulse-dot" aria-hidden="true" />
              <span>USB / Bluetooth Scanner Ready: Point scanner at any product barcode.</span>
            </div>

            {/* Input Form */}
            <form className="scanner-code-form" onSubmit={handleManualSubmit}>
              <label htmlFor="hardware-code-input" className="scanner-code-label">
                Enter or Scan Product Code:
              </label>
              <div className="scanner-code-row">
                <input
                  ref={hardwareInputRef}
                  id="hardware-code-input"
                  type="text"
                  className="scanner-code-input"
                  placeholder="e.g. PROD-001 or scan code..."
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  autoComplete="off"
                />
                <button type="submit" className="scanner-add-btn">
                  <ShoppingCart size={16} />
                  <span>Add to Bill</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
