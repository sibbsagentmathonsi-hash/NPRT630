import React, { useEffect, useRef, useState } from 'react';
import { apiFetch as fetch } from '../../utils/apiClient';
import JsBarcode from 'jsbarcode';
import { Icon } from '../common/Icons';
import { formatCompanyDate, formatCompanyDateTime, formatCurrency } from '../../utils/companyFormatting';

const returnReasons = [
  { label: 'Damaged Product', icon: 'alert-triangle' },
  { label: 'Expired Item', icon: 'alert-triangle' },
  { label: 'Defective Goods', icon: 'zap' },
  { label: 'Wrong Item / Size', icon: 'box' },
  { label: 'Customer Changed Mind', icon: 'refresh-cw' },
  { label: 'Packaging Compromised', icon: 'box' },
];

const ReceiptBarcode = ({ receiptNumber }) => {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (!barcodeRef.current || !receiptNumber) return;
    JsBarcode(barcodeRef.current, receiptNumber, {
      format: 'CODE128',
      displayValue: true,
      font: 'DM Mono',
      fontSize: 12,
      height: 48,
      margin: 4,
      width: 1.7,
    });
  }, [receiptNumber]);

  return <svg ref={barcodeRef} role="img" aria-label={`Scannable barcode for receipt ${receiptNumber}`} />;
};

export const CashierWorkspace = ({ workspace, apiBase, token, currentUser, onRefresh, onNotify, initialTab = 'pos' }) => {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'returns' | 'receipts'
  useEffect(() => setActiveTab(['pos', 'returns', 'receipts'].includes(initialTab) ? initialTab : 'pos'), [initialTab]);
  const products = workspace.products || [];
  const receipts = workspace.receipts || [];
  const currency = workspace.companySettings?.currency || 'ZAR';
  const timezone = workspace.companySettings?.timezone || 'Africa/Johannesburg';
  const money = (amount) => formatCurrency(amount, currency);

  // POS State
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scannerAttempt, setScannerAttempt] = useState(0);
  const videoRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [tenderAmount, setTenderAmount] = useState('');
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [processingSale, setProcessingSale] = useState(false);

  // Return Processing State (Design Iteration 2)
  const [returnReceiptNo, setReturnReceiptNo] = useState('');
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [returnFoundReceipt, setReturnFoundReceipt] = useState(null);
  const [returnProductId, setReturnProductId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState(returnReasons[0].label);
  const [returnNotes, setReturnNotes] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);
  const [returnSuccessData, setReturnSuccessData] = useState(null);

  // Categories list
  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  // Cart Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Number(((cartSubtotal * discountPercent) / 100).toFixed(2));
  const cartTotal = Number((cartSubtotal - discountAmount).toFixed(2));
  const vatRate = Number(workspace.vatRate ?? 15);
  const negativeInventoryEnforced = workspace.policyControls?.some((control) => control.id === 'negative-inventory' && control.status === 'ENFORCED') ?? true;
  const vatAmount = Number(((cartTotal * vatRate) / (100 + vatRate)).toFixed(2));
  const netSubtotal = Number((cartTotal - vatAmount).toFixed(2));
  const parsedTenderAmount = tenderAmount.trim() === '' ? NaN : Number(tenderAmount);
  const cashTenderSufficient = Number.isFinite(parsedTenderAmount) && parsedTenderAmount >= cartTotal;
  const canCompletePayment = paymentMethod !== 'CASH' || cashTenderSufficient;
  const changeDue = Number.isFinite(parsedTenderAmount) ? Math.max(0, parsedTenderAmount - cartTotal) : 0;

  // Add Item to POS Cart
  const handleAddToCart = (product) => {
    const existing = cart.find((i) => i.productId === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (negativeInventoryEnforced && currentQty + 1 > product.availableStock) {
      onNotify?.(`Cannot add: Insufficient stock for ${product.name} (Available: ${product.availableStock})`, 'error');
      return;
    }

    if (existing) {
      setCart(cart.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          price: product.price,
          quantity: 1,
          imageUrl: product.imageUrl,
        },
      ]);
    }
  };

  const handleUpdateQty = (productId, delta) => {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    const product = products.find((p) => p.id === productId);
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      setCart(cart.filter((i) => i.productId !== productId));
      return;
    }

    if (negativeInventoryEnforced && product && newQty > product.availableStock) {
      onNotify?.(`Max available stock reached (${product.availableStock} units)`, 'error');
      return;
    }

    setCart(cart.map((i) => (i.productId === productId ? { ...i, quantity: newQty } : i)));
  };

  const handleBarcodeValue = (value) => {
    if (!value.trim()) return false;
    const clean = value.trim().toUpperCase();
    const product = products.find((p) => p.barcode === clean || p.sku.toUpperCase() === clean);

    if (product) {
      handleAddToCart(product);
      setBarcodeInput('');
      onNotify?.(`Scanned: ${product.name}`, 'success');
      return true;
    } else {
      onNotify?.(`No product found matching barcode "${value}"`, 'error');
      return false;
    }
  };

  const handleBarcodeScan = (e) => {
    e.preventDefault();
    handleBarcodeValue(barcodeInput);
  };

  useEffect(() => {
    if (!showBarcodeScanner) return undefined;

    let cancelled = false;
    let controls;
    let reader;
    setCameraStarting(true);
    setCameraError('');
    setCameraReady(false);

    const startScanner = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access requires a secure connection. Open SyncStock on the computer using localhost or HTTPS.');
        }

        const { BrowserCodeReader, BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled) return;
        reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(selectedCameraId || undefined, videoRef.current, (result) => {
          if (!result || cancelled) return;
          const barcode = result.getText();
          setShowBarcodeScanner(false);
          if (scanningReceipt) {
            setReturnReceiptNo(barcode);
            handleLookupReceiptValue(barcode);
          } else {
            handleBarcodeValue(barcode);
          }
        });
        if (cancelled) {
          controls.stop();
          return;
        }

        setCameraStarting(false);
        const video = videoRef.current;
        if (video && video.paused) {
          await video.play();
        }
        if (video && video.videoWidth > 0) setCameraReady(true);
        const devices = await BrowserCodeReader.listVideoInputDevices();
        if (cancelled) return;
        setCameraDevices(devices);
        if (!selectedCameraId && devices.length) {
          const preferredCamera = devices.find((device) => /built.?in|integrated|webcam|laptop|computer/i.test(device.label))
            || devices.find((device) => !/phone|iphone|android/i.test(device.label))
            || devices[0];
          setSelectedCameraId(preferredCamera.deviceId);
        }
      } catch (error) {
        if (cancelled) return;
        setCameraStarting(false);
        setCameraError(error instanceof Error ? error.message : 'Unable to start the camera. Check browser permissions and try again.');
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [showBarcodeScanner, selectedCameraId, scannerAttempt, scanningReceipt]);

  const handleCompleteCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'CASH' && !cashTenderSufficient) {
      onNotify?.(`Cash received must be at least ${money(cartTotal)}`, 'error');
      return;
    }
    setProcessingSale(true);

    try {
      const res = await fetch(`${apiBase}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          paymentMethod,
          discountPercent,
          tenderAmount: paymentMethod === 'CASH' ? parsedTenderAmount : cartTotal,
          notes: `POS Cashier Transaction (${currentUser?.employeeId || 'STAFF'})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sale processing failed');
      }

      setActiveReceipt(data.receipt);
      setCart([]);
      setShowCheckoutModal(false);
      setTenderAmount('');
      onRefresh();
      onNotify?.(`Sale completed! Receipt #${data.receipt.receiptNumber} generated`, 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setProcessingSale(false);
    }
  };

  // Lookup Receipt for Return (Step 1)
  const handleLookupReceiptValue = (receiptNumber) => {
    const clean = receiptNumber.trim().toUpperCase();
    const found = receipts.find((r) => r.receiptNumber.toUpperCase() === clean);

    if (found) {
      setReturnFoundReceipt(found);
      if (found.items && found.items.length > 0) {
        setReturnProductId(found.items[0].productId);
      }
      onNotify?.(`Found Receipt #${found.receiptNumber}`, 'success');
    } else {
      onNotify?.(`Receipt "${receiptNumber}" not found. You can also select the product manually below.`, 'warning');
      setReturnFoundReceipt(null);
    }
  };

  const handleLookupReceipt = (e) => {
    e.preventDefault();
    handleLookupReceiptValue(returnReceiptNo);
  };

  // Process Return (Step 2 & 3)
  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!returnProductId) {
      onNotify?.('Please select a product to return', 'error');
      return;
    }

    setProcessingReturn(true);
    try {
      const res = await fetch(`${apiBase}/api/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiptNumber: returnReceiptNo || undefined,
          productId: Number(returnProductId),
          quantity: Number(returnQuantity),
          reason: returnReason,
          notes: returnNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Return processing failed');
      }

      setReturnSuccessData(data);
      onRefresh();
      onNotify?.(data.message, 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setProcessingReturn(false);
    }
  };

  const filteredProducts = products.filter((p) => selectedCategory === 'ALL' || p.category === selectedCategory);

  return (
    <div className="workspace-page cashier-page">
      <div className="cashier-page-heading">
        <h1>{activeTab === 'pos' ? 'Checkout' : activeTab === 'returns' ? 'Process returns' : 'Receipt history'}</h1>
        <p>
          {activeTab === 'pos'
            ? 'Scan products, review the basket, and complete the sale.'
            : activeTab === 'returns'
              ? 'Find the original receipt and record a customer return.'
              : `${receipts.length} recent receipts`}
        </p>
      </div>

      {/* VIEW 1: HIGH-SPEED POINT OF SALE */}
      {activeTab === 'pos' && (
        <div className="pos-container">
          {/* Product Catalogue & Barcode Scanner */}
          <div className="pos-catalog">
            {/* Barcode Search Form */}
            <form className="pos-scan-form" onSubmit={handleBarcodeScan}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  className="form-input form-input-mono"
                  placeholder="Scan barcode or enter SKU..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={() => { setScanningReceipt(false); setShowBarcodeScanner(true); }}>
                <Icon name="barcode" size={18} /> Scan / Add
              </button>
            </form>

            {/* Category Filter Tabs */}
            <div className="pos-category-filters">
              {categories.map((c) => (
                <button
                  key={c}
                  className={`btn ${selectedCategory === c ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setSelectedCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Visual Product Grid */}
            <div className="pos-grid">
              {filteredProducts.map((product) => (
                <div key={product.id} className="pos-item-card" onClick={() => handleAddToCart(product)}>
                  <img src={product.imageUrl} alt="" className="pos-item-img" />
                  <div className="pos-item-title">{product.name}</div>
                  <div className="pos-item-sku">{product.sku}</div>
                  <div className="pos-item-price">
                    <span>{money(product.price)}</span>
                    <span className={`badge ${product.availableStock <= product.reorderPoint ? 'badge-danger' : 'badge-gray'}`} style={{ fontSize: '0.6875rem' }}>
                      {product.availableStock} in stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Sale Basket Drawer */}
          <div className="pos-cart">
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Current Sale Basket</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cart.length} item lines</span>
              </div>
              {cart.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setCart([])}>
                  Clear
                </button>
              )}
            </div>

            <div className="pos-cart-items">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Icon name="shopping-cart" size={40} className="mb-2 opacity-50" />
                  <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Cart is empty</p>
                  <p style={{ fontSize: '0.75rem' }}>Scan barcode or click items on the left to add</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="pos-cart-line">
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {money(item.price)} ea
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="stepper">
                        <button type="button" className="stepper-btn" onClick={() => handleUpdateQty(item.productId, -1)}>
                          -
                        </button>
                        <span className="stepper-val">{item.quantity}</span>
                        <button type="button" className="stepper-btn" onClick={() => handleUpdateQty(item.productId, 1)}>
                          +
                        </button>
                      </div>

                      <span style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: '65px', textAlign: 'right' }}>
                        {money(item.price * item.quantity)}
                      </span>

                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                        onClick={() => setCart(cart.filter((i) => i.productId !== item.productId))}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary & Checkout */}
            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Net Subtotal:</span>
                <span>{money(netSubtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>VAT ({vatRate.toFixed(1)}% Incl):</span>
                <span>{money(vatAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Discount:</span>
                <select
                  className="form-select"
                  style={{ width: '100px', padding: '2px 6px', fontSize: '0.75rem' }}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                >
                  <option value={0}>0%</option>
                  <option value={5}>5% Off</option>
                  <option value={10}>10% Off</option>
                  <option value={15}>15% Off</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}>
                <span>Total Due:</span>
                <span style={{ color: 'var(--primary)' }}>{money(cartTotal)}</span>
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                disabled={cart.length === 0}
                onClick={() => setShowCheckoutModal(true)}
              >
                <Icon name="dollar-sign" size={20} /> Pay {money(cartTotal)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBarcodeScanner && (
        <div className="modal-overlay" onClick={() => setShowBarcodeScanner(false)}>
          <div className="modal-content pos-barcode-modal" role="dialog" aria-modal="true" aria-labelledby="pos-barcode-title" onClick={(event) => event.stopPropagation()}>
            <div className="pos-barcode-modal-header">
              <div>
                <h2 id="pos-barcode-title">{scanningReceipt ? 'Scan receipt barcode' : 'Scan product barcode'}</h2>
                <p>{scanningReceipt ? 'Point your computer camera at the receipt barcode.' : 'Point your computer camera at a product barcode.'} Hold the barcode steady in the preview.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" aria-label="Close scanner" onClick={() => setShowBarcodeScanner(false)}>✕</button>
            </div>
            {cameraDevices.length > 1 && (
              <label className="form-label">
                Camera
                <select className="form-input" value={selectedCameraId} onChange={(event) => setSelectedCameraId(event.target.value)}>
                  {cameraDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>
                  ))}
                </select>
              </label>
            )}
            <video
              ref={videoRef}
              className="pos-barcode-preview"
              autoPlay
              muted
              playsInline
              onLoadedMetadata={() => setCameraReady(true)}
            />
            {cameraStarting && <p className="pos-barcode-status">Starting camera… Allow camera access if your browser asks.</p>}
            {cameraReady && !cameraError && <p className="pos-barcode-status">Camera ready. Hold the barcode in view to scan.</p>}
            {cameraError && (
              <div className="pos-barcode-error" role="alert">
                <span>{cameraError}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScannerAttempt((attempt) => attempt + 1)}>Try again</button>
              </div>
            )}
            {cameraDevices.length > 1 && <p className="pos-barcode-status">If the preview is blank, choose your computer webcam from the camera list.</p>}
          </div>
        </div>
      )}

      {/* VIEW 2: PROCESS RETURNS (DESIGN ITERATION 2) */}
      {activeTab === 'returns' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="refresh-cw" size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Process Customer Return (2-Step Recognition Flow)</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Scanned returns automatically restore stock levels and emit audit events to prevent ghost inventory.
                </p>
              </div>
            </div>

            {/* Step 1: Scan or Search Original Receipt */}
            <form onSubmit={handleLookupReceipt} style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
              <input
                type="text"
                className="form-input form-input-mono"
                placeholder="Step 1: Scan or enter the receipt number..."
                value={returnReceiptNo}
                onChange={(e) => setReturnReceiptNo(e.target.value)}
              />
              <button type="button" className="btn btn-secondary" onClick={() => { setScanningReceipt(true); setShowBarcodeScanner(true); }}>
                <Icon name="barcode" size={16} /> Scan receipt
              </button>
              <button type="submit" className="btn btn-primary">
                <Icon name="search" size={16} /> Find Invoice
              </button>
            </form>

            {/* Found Receipt Summary */}
            {returnFoundReceipt && (
              <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '6px' }}>
                  Original Transaction #{returnFoundReceipt.receiptNumber} (Date: {formatCompanyDate(returnFoundReceipt.createdAt, timezone)})
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {returnFoundReceipt.items.map((line) => (
                    <button
                      key={line.productId}
                      type="button"
                      className={`btn btn-sm ${returnProductId === line.productId ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setReturnProductId(line.productId)}
                    >
                      {line.name} ({money(line.unitPrice)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Return Details Form */}
            <form onSubmit={handleProcessReturn}>
              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Returned Product Master</label>
                  <select
                    className="form-select"
                    value={returnProductId}
                    onChange={(e) => setReturnProductId(Number(e.target.value))}
                    required
                  >
                    <option value="">-- Select item to return --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) - Price: {money(p.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity to Return</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="50"
                    value={returnQuantity}
                    onChange={(e) => setReturnQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Step 3: Tappable Visual Return Reasons (Design Iteration 2 from document) */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '8px' }}>
                  Reason for Return (Select Reason Button)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {returnReasons.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      className={`btn ${returnReason === r.label ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '12px', textAlign: 'center', justifyContent: 'center' }}
                      onClick={() => setReturnReason(r.label)}
                    >
                      <Icon name={r.icon} size={16} /> {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Supervisor / Condition Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Seal damaged in transit, packaging intact"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-success btn-lg"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={processingReturn || !returnProductId}
              >
                <Icon name="check-circle" size={20} />
                {processingReturn ? 'Processing Return...' : 'Authorize Refund & Restore Inventory'}
              </button>
            </form>

            {/* Success Card */}
            {returnSuccessData && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--success-light)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success-text)', fontWeight: 700, marginBottom: '4px' }}>
                  <Icon name="check-circle" size={18} /> Return Successfully Processed
                </div>
                <p style={{ fontSize: '0.875rem' }}>
                  Return Voucher <strong>{returnSuccessData.returnId}</strong> created. Customer refund: <strong>{money(returnSuccessData.refundAmount)}</strong>. Stock restored to <strong>{returnSuccessData.movement.warehouseId}</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: RECEIPT & TRANSACTION HISTORY */}
      {activeTab === 'receipts' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 className="card-title">POS Sales Receipts & Audit History</h3>
          </div>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Timestamp</th>
                  <th>Cashier</th>
                  <th>Payment Method</th>
                  <th>Items</th>
                  <th>Total (VAT Incl)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((rec) => (
                  <tr key={rec.id}>
                    <td><span className="badge badge-primary form-input-mono">{rec.receiptNumber}</span></td>
                    <td style={{ fontSize: '0.8125rem' }}>{formatCompanyDateTime(rec.createdAt, timezone)}</td>
                    <td>{rec.cashierName} ({rec.cashierEmployeeId})</td>
                    <td><span className="badge badge-gray">{rec.paymentMethod}</span></td>
                    <td>{rec.items.length} line items</td>
                    <td><strong>{money(rec.total)}</strong></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setActiveReceipt(rec)}>
                        <Icon name="printer" size={14} /> View / Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL (CASH / CARD / QR) */}
      {showCheckoutModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Complete Payment</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCheckoutModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className={`btn ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setPaymentMethod('CASH')}
              >
                💵 Cash
              </button>
              <button
                type="button"
                className={`btn ${paymentMethod === 'CARD' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setPaymentMethod('CARD')}
              >
                💳 Card
              </button>
              <button
                type="button"
                className={`btn ${paymentMethod === 'QR' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setPaymentMethod('QR')}
              >
                📱 SnapScan / QR
              </button>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Total Amount to Pay</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{money(cartTotal)}</div>
            </div>

            {paymentMethod === 'CASH' && (
              <div>
                <label className="form-label">Tendered Cash Amount ({currency})</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Enter cash received"
                  min={cartTotal}
                  step="0.01"
                  value={tenderAmount}
                  onChange={(e) => setTenderAmount(e.target.value)}
                  autoFocus
                />
                {!cashTenderSufficient && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.8125rem', marginTop: '6px' }}>
                    Cash received must be at least {money(cartTotal)}.
                  </div>
                )}

                {/* Quick preset cash buttons */}
                <div style={{ display: 'flex', gap: '6px', margin: '8px 0 12px 0' }}>
                  {[50, 100, 200, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => setTenderAmount(String(preset))}
                    >
                      {money(preset)}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--success-light)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--success-text)' }}>Change Due:</span>
                  <strong style={{ fontSize: '1.125rem', color: 'var(--success-text)' }}>{money(changeDue)}</strong>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCheckoutModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={processingSale || !canCompletePayment}
                onClick={handleCompleteCheckout}
              >
                {processingSale ? 'Processing...' : `Confirm & Issue Receipt`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE DIGITAL RECEIPT MODAL */}
      {activeReceipt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div id="printable-receipt" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: '#000', background: '#fff', padding: '1.5rem', borderRadius: '8px' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '1px dashed #ccc', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>SyncStock Retail Ltd</h2>
                <div>Johannesburg Central (JHB-01)</div>
                <div>VAT Reg: 4890123456</div>
                <div style={{ marginTop: '4px', fontSize: '0.75rem' }}>Receipt: #{activeReceipt.receiptNumber}</div>
                <div style={{ fontSize: '0.75rem' }}>Date: {formatCompanyDateTime(activeReceipt.createdAt, timezone)}</div>
                <div style={{ fontSize: '0.75rem' }}>Cashier: {activeReceipt.cashierName} ({activeReceipt.cashierEmployeeId})</div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                {activeReceipt.items.map((line, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div>
                      <div>{line.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>{line.quantity} x {money(line.unitPrice)}</div>
                    </div>
                    <div>{money(line.lineTotal)}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed #ccc', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Net Subtotal:</span>
                  <span>{money(activeReceipt.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>VAT (15%):</span>
                  <span>{money(activeReceipt.vatAmount)}</span>
                </div>
                {activeReceipt.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c00' }}>
                    <span>Discount:</span>
                    <span>-{money(activeReceipt.discountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px' }}>
                  <span>TOTAL:</span>
                  <span>{money(activeReceipt.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px' }}>
                  <span>Paid via {activeReceipt.paymentMethod}:</span>
                  <span>{money(activeReceipt.tenderAmount ?? activeReceipt.total)}</span>
                </div>
                {activeReceipt.changeAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span>Change:</span>
                    <span>{money(activeReceipt.changeAmount)}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem' }}>
                <div>Thank you for shopping with us!</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                  <ReceiptBarcode receiptNumber={activeReceipt.receiptNumber} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveReceipt(null)}>
                Close
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => window.print()}>
                <Icon name="printer" size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
