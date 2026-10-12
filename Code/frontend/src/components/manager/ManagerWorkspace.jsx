import React, { useEffect, useState } from 'react';

export const ManagerWorkspace = ({ workspace, apiBase, token, currentUser, onRefresh, onNotify, initialTab = 'overview' }) => {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  useEffect(() => {
    setActiveSubTab(['overview', 'forecasting', 'suppliers', 'supplier-ratings', 'catalog'].includes(initialTab) ? initialTab : 'overview');
  }, [initialTab]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [generatingPo, setGeneratingPo] = useState(false);
  const [receivingPoId, setReceivingPoId] = useState(null);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    quantity: '',
    warehouseId: '',
    binCode: '',
    condition: 'GOOD',
    notes: '',
  });
  const [reviewingPoId, setReviewingPoId] = useState(null);
  const [viewingReviewPoId, setViewingReviewPoId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [supplierReviewForm, setSupplierReviewForm] = useState({
    deliveryScore: '',
    qualityScore: '',
    communicationScore: '',
    feedback: '',
  });
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({
    sku: '', barcode: '', name: '', category: 'General', supplierId: 1, stock: 0,
    reorderPoint: 0, reorderQuantity: 1, unitCost: 0, price: 0,
    warehouse: 'Johannesburg Central (JHB-01)', warehouseId: 'JHB-01', binLocation: 'A-01', imageUrl: '',
  });

  const summary = workspace.summary || {
    dailySales: 1667.45,
    stockOnHand: 383,
    availableStock: 350,
    reservedUnits: 25,
    inventoryCostValue: 68180.0,
    inventoryRetailValue: 134785.87,
    grossMarginPct: 49.4,
    lowStockCount: 3,
    topProducts: [],
  };

  const products = workspace.products || [];
  const forecasts = workspace.forecasts || [];
  const suppliers = workspace.suppliers || [];
  const purchaseOrders = workspace.purchaseOrders || [];
  const warehouses = workspace.warehouses || [];
  const canReceivePurchaseOrders = currentUser?.role === 'MANAGER';
  const canSubmitSupplierReviews = currentUser?.role === 'PROCUREMENT_STAFF';
  const workspaceTitle = activeSubTab === 'supplier-ratings'
    ? 'Supplier Ratings'
    : activeSubTab === 'suppliers'
      ? 'Purchase Order Management'
      : 'Store Operations & Demand Analytics';

  const handleSubmitSupplierReview = async (event) => {
    event.preventDefault();
    if (!reviewingPoId) return;

    setSubmittingReview(true);
    try {
      const res = await fetch(`${apiBase}/api/purchase-orders/${reviewingPoId}/supplier-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', token].join(' ')
        },
        body: JSON.stringify({
          deliveryScore: Number(supplierReviewForm.deliveryScore),
          qualityScore: Number(supplierReviewForm.qualityScore),
          communicationScore: Number(supplierReviewForm.communicationScore),
          feedback: supplierReviewForm.feedback,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to submit supplier review');

      onNotify?.(`Supplier review for PO-${reviewingPoId} submitted`, 'success');
      setReviewingPoId(null);
      setSupplierReviewForm({ deliveryScore: '', qualityScore: '', communicationScore: '', feedback: '' });
      onRefresh();
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleApprovePo = async (poId) => {
    try {
      const res = await fetch(`${apiBase}/api/purchase-orders/${poId}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        onNotify?.(`Purchase Order PO-${poId} approved and scheduled for transmission`, 'success');
        onRefresh();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      onNotify?.(err.message, 'error');
    }
  };

  const handleSendPo = async (poId) => {
    try {
      const res = await fetch(`${apiBase}/api/purchase-orders/${poId}/send`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        onNotify?.(`Purchase Order PO-${poId} transmitted to supplier EDI`, 'success');
        onRefresh();
      }
    } catch (err) {
      onNotify?.(err.message, 'error');
    }
  };

  const openReceiptForm = (purchaseOrder) => {
    const product = products.find((entry) => entry.sku === purchaseOrder.sku);
    const productWarehouseExists = warehouses.some((warehouse) => warehouse.id === product?.warehouseId);
    setReceiptForm({
      quantity: String(purchaseOrder.remainingQuantity),
      warehouseId: productWarehouseExists ? product.warehouseId : warehouses[0]?.id || product?.warehouseId || '',
      binCode: product?.binLocation || '',
      condition: 'GOOD',
      notes: '',
    });
    setReceivingPoId(purchaseOrder.id);
  };

  const handleReceivePurchaseOrder = async (event) => {
    event.preventDefault();
    if (!receivingPoId) return;

    setSubmittingReceipt(true);
    try {
      const res = await fetch(`${apiBase}/api/purchase-orders/${receivingPoId}/receive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', token].join(' '),
        },
        body: JSON.stringify({
          quantity: Number(receiptForm.quantity),
          warehouseId: receiptForm.warehouseId || undefined,
          binCode: receiptForm.binCode || undefined,
          condition: receiptForm.condition,
          notes: receiptForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to record goods receipt');

      onNotify?.(`Received ${data.purchaseOrder.receivedQuantity} of ${data.purchaseOrder.quantity} units for PO-${receivingPoId}`, 'success');
      setReceivingPoId(null);
      onRefresh();
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const handleCreatePoFromForecast = async (item) => {
    try {
      const supplier = suppliers[0] || { id: 1 };
      const res = await fetch(`${apiBase}/api/purchase-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', token].join(' '),
        },
        body: JSON.stringify({
          supplierId: supplier.id,
          sku: item.sku,
          itemName: item.productName,
          quantity: item.recommendedOrderQty,
          notes: `Automated EOQ/ROP replenishment order (Safety Stock: ${item.safetyStock})`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onNotify?.(`Created replenishment PO for ${item.productName} (Qty: ${item.recommendedOrderQty})`, 'success');
        onRefresh();
      }
    } catch (err) {
      onNotify?.(err.message, 'error');
    }
  };

  const handleGenerateLowStockPos = async () => {
    setGeneratingPo(true);
    try {
      const res = await fetch(`${apiBase}/api/purchase-orders/generate-low-stock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        onNotify?.(`Generated ${data.generated?.length || 0} automated low-stock purchase orders`, 'success');
        onRefresh();
      }
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setGeneratingPo(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchSearch =
      p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      p.barcode.includes(catalogSearch);
    return matchCat && matchSearch;
  });

  const openProductForm = (product = null) => {
    setEditingProductId(product?.id || null);
    setProductForm(product ? { ...product } : {
      sku: '', barcode: '', name: '', category: 'General', supplierId: suppliers[0]?.id || 1, stock: 0,
      reorderPoint: 0, reorderQuantity: 1, unitCost: 0, price: 0,
      warehouse: 'Johannesburg Central (JHB-01)', warehouseId: 'JHB-01', binLocation: 'A-01', imageUrl: '',
    });
    setProductFormOpen(true);
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();
    try {
      const res = await fetch(`${apiBase}/api/products${editingProductId ? `/${editingProductId}` : ''}`, {
        method: editingProductId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(productForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save product');
      setProductFormOpen(false);
      onNotify?.(editingProductId ? 'Product updated successfully' : 'Product added to the catalogue', 'success');
      onRefresh();
    } catch (err) {
      onNotify?.(err.message, 'error');
    }
  };

  const updateProductField = (field, value) => setProductForm((current) => ({ ...current, [field]: value }));

  return (
      <div className="workspace-page" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-primary">
              {activeSubTab === 'supplier-ratings' ? 'Supplier Performance' : activeSubTab === 'suppliers' ? 'Procurement Workspace' : 'Store Manager Command Center'}
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {activeSubTab === 'supplier-ratings' ? 'Review history and ratings' : activeSubTab === 'suppliers' ? 'Order lifecycle and receiving' : 'Real-time business intelligence'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em' }}>
            {workspaceTitle}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={onRefresh}>
            Refresh
          </button>
          {activeSubTab !== 'supplier-ratings' && (
            <button className="btn btn-primary" onClick={handleGenerateLowStockPos} disabled={generatingPo}>
              {generatingPo ? 'Evaluating Stock...' : 'Auto-Generate Low Stock POs'}
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="workspace-subnav" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button className={`btn ${activeSubTab === 'overview' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('overview')}>
          Executive KPI Dashboard
        </button>
        <button className={`btn ${activeSubTab === 'forecasting' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('forecasting')}>
          AI Demand Forecasting & EOQ Report
        </button>
        <button className={`btn ${activeSubTab === 'suppliers' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('suppliers')}>
          Purchase Orders ({purchaseOrders.length})
        </button>
        {canSubmitSupplierReviews && (
          <button className={`btn ${activeSubTab === 'supplier-ratings' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('supplier-ratings')}>
            Supplier Ratings
          </button>
        )}
        <button className={`btn ${activeSubTab === 'catalog' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('catalog')}>
          Master Product Inventory ({products.length})
        </button>
      </div>

      {/* TAB 1: EXECUTIVE KPI DASHBOARD */}
      {activeSubTab === 'overview' && (
        <div>
          {/* Top KPI Cards Grid */}
          <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Total Daily Revenue (ZAR)</span>
              </div>
              <div className="kpi-value">R {summary.dailySales?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-subtext" style={{ color: 'var(--success-text)' }}>
                ↑ +12.5% vs previous month
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Stock on Hand / Lines</span>
              </div>
              <div className="kpi-value">{summary.stockOnHand} units</div>
              <div className="kpi-subtext">Across {products.length} product lines in 2 warehouses</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Low Stock Critical Alerts</span>
              </div>
              <div className="kpi-value" style={{ color: summary.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {summary.lowStockCount} items
              </div>
              <div className="kpi-subtext" style={{ color: 'var(--danger-text)' }}>
                ⚠️ Immediate reorder required
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Inventory Valuation (Retail)</span>
              </div>
              <div className="kpi-value">R {summary.inventoryRetailValue?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-subtext">
                Cost: R {summary.inventoryCostValue?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} ({summary.grossMarginPct}% Margin)
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts Grid */}
          <div className="grid-cols-2" style={{ marginBottom: '1.5rem' }}>
            {/* Sales Trend Chart (Figure from documentation) */}
            <div className="card">
              <div className="card-header analytics-card-header">
                <h3 className="card-title">Sales Overview (ZAR) & Machine Learning Projection</h3>
                <span className="badge badge-primary">Daily Time Series</span>
              </div>
              <div style={{ padding: '1rem 0' }}>
                <svg viewBox="0 0 500 200" style={{ width: '100%', height: '180px' }}>
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="480" y2="20" stroke="var(--border-color)" strokeDasharray="3 3" />
                  <line x1="40" y1="70" x2="480" y2="70" stroke="var(--border-color)" strokeDasharray="3 3" />
                  <line x1="40" y1="120" x2="480" y2="120" stroke="var(--border-color)" strokeDasharray="3 3" />
                  <line x1="40" y1="170" x2="480" y2="170" stroke="var(--border-color)" />

                  {/* Y Axis Labels */}
                  <text x="32" y="24" fontSize="10" fill="var(--text-muted)" textAnchor="end">1200</text>
                  <text x="32" y="74" fontSize="10" fill="var(--text-muted)" textAnchor="end">900</text>
                  <text x="32" y="124" fontSize="10" fill="var(--text-muted)" textAnchor="end">500</text>
                  <text x="32" y="174" fontSize="10" fill="var(--text-muted)" textAnchor="end">0</text>

                  {/* Bars */}
                  <rect x="80" y="50" width="60" height="120" rx="4" fill="var(--primary)" opacity="0.85" />
                  <text x="110" y="42" fontSize="10" fontWeight="700" fill="var(--text-primary)" textAnchor="middle">R 1,184.48</text>
                  <text x="110" y="186" fontSize="10" fill="var(--text-muted)" textAnchor="middle">May 11</text>

                  <rect x="220" y="110" width="60" height="60" rx="4" fill="var(--primary)" opacity="0.65" />
                  <text x="250" y="102" fontSize="10" fontWeight="700" fill="var(--text-primary)" textAnchor="middle">R 482.98</text>
                  <text x="250" y="186" fontSize="10" fill="var(--text-muted)" textAnchor="middle">May 06</text>

                  <rect x="360" y="70" width="60" height="100" rx="4" fill="var(--purple)" opacity="0.8" />
                  <text x="390" y="62" fontSize="10" fontWeight="700" fill="var(--text-primary)" textAnchor="middle">R 899.99 (Proj)</text>
                  <text x="390" y="186" fontSize="10" fill="var(--text-muted)" textAnchor="middle">Tomorrow</text>
                </svg>
              </div>
            </div>

            {/* Products by Category Donut Visualization */}
            <div className="card">
              <div className="card-header analytics-card-header">
                <h3 className="card-title">Products by Category Breakdown</h3>
                <span className="badge badge-gray">Inventory Portfolio</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.5rem 0' }}>
                <svg viewBox="0 0 200 200" style={{ width: '160px', height: '160px' }}>
                  <circle cx="100" cy="100" r="70" fill="none" stroke="var(--primary)" strokeWidth="28" strokeDasharray="110 330" />
                  <circle cx="100" cy="100" r="70" fill="none" stroke="var(--success)" strokeWidth="28" strokeDasharray="90 350" strokeDashoffset="-110" />
                  <circle cx="100" cy="100" r="70" fill="none" stroke="var(--warning)" strokeWidth="28" strokeDasharray="80 360" strokeDashoffset="-200" />
                  <circle cx="100" cy="100" r="70" fill="none" stroke="var(--purple)" strokeWidth="28" strokeDasharray="70 370" strokeDashoffset="-280" />
                  <circle cx="100" cy="100" r="70" fill="none" stroke="var(--danger)" strokeWidth="28" strokeDasharray="90 350" strokeDashoffset="-350" />
                  <text x="100" y="96" textAnchor="middle" fontSize="11" fill="var(--text-muted)">TOTAL VALUE</text>
                  <text x="100" y="112" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--text-primary)">R 134k</text>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: 'var(--primary)', borderRadius: '2px' }} /> Electronics & Audio (32%)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: 'var(--success)', borderRadius: '2px' }} /> Dairy & Bakery (22%)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: 'var(--warning)', borderRadius: '2px' }} /> Groceries & Coffee (18%)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: 'var(--purple)', borderRadius: '2px' }} /> Health & Beauty (16%)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: 'var(--danger)', borderRadius: '2px' }} /> Home & Garden (12%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Selling Products Leaderboard */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Fast-Moving SKU Velocity & Merchandising Performance</h3>
              <span className="badge badge-success">Top Performers</span>
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>SKU & Product Name</th>
                    <th>Category</th>
                    <th>Current Stock</th>
                    <th>Unit Price (ZAR)</th>
                    <th>Total Velocity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 5).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img src={p.imageUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <span className="form-input-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-gray">{p.category}</span></td>
                      <td><strong>{p.stock} units</strong> ({p.binLocation})</td>
                      <td>R {p.price.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '80px', height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, (p.stock / 50) * 100)}%`, height: '100%', background: 'var(--primary)' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>High</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${p.status === 'Healthy' ? 'badge-success' : p.status === 'Watch' ? 'badge-warning' : 'badge-danger'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI DEMAND FORECASTING & EOQ / ROP REPORT */}
      {activeSubTab === 'forecasting' && (
        <div>
          {/* Formula Callout Banner */}
          <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--primary-light)', borderColor: 'var(--primary-border)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
                  Scientific Replenishment Models (Phase 2 & 3 Specification)
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong>Reorder Point formula:</strong> ROP = (d &times; L) + SS &mdash; where d = Average Daily Demand, L = Lead Time in Days, SS = Safety Stock.<br />
                  <strong>Economic Order Quantity:</strong> EOQ = &radic;((2 &times; D &times; S) / H) &mdash; where D = Annual Demand, S = Order Cost, H = Carrying Cost per unit.
                </p>
              </div>
            </div>
          </div>

          {/* Forecasting Table with 1-Click PO Approval */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title">Recommended Purchase Orders & Demand Predictions</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Data-driven replenishment suggestions generated from historical sales velocity and supplier lead times.
                </p>
              </div>
            </div>

            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>SKU & Product</th>
                    <th>Daily Demand (d)</th>
                    <th>Lead Time (L)</th>
                    <th>Safety Stock (SS)</th>
                    <th>Reorder Point (ROP)</th>
                    <th>Current Stock</th>
                    <th>Suggested Order (EOQ)</th>
                    <th>Stockout Risk</th>
                    <th style={{ textAlign: 'right' }}>1-Click Replenish</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map((f) => (
                    <tr key={f.sku}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{f.productName}</div>
                        <span className="form-input-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.sku}</span>
                      </td>
                      <td><strong>{f.averageDailyDemand}</strong> units/day</td>
                      <td>{f.leadTimeDays} days</td>
                      <td>{f.safetyStock} units</td>
                      <td><span className="badge badge-gray">{f.reorderPoint} units</span></td>
                      <td>
                        <strong style={{ color: f.currentAvailableStock <= f.reorderPoint ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {f.currentAvailableStock} units
                        </strong>
                      </td>
                      <td>
                        <span className="badge badge-primary" style={{ fontSize: '0.8125rem', padding: '4px 10px' }}>
                          +{f.recommendedOrderQty} units
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${f.stockoutRisk === 'High' ? 'badge-danger' : f.stockoutRisk === 'Medium' ? 'badge-warning' : 'badge-success'}`}>
                          {f.stockoutRisk} Risk
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCreatePoFromForecast(f)}
                        >
                          Approve & Create PO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PURCHASE ORDERS */}
      {activeSubTab === 'suppliers' && (
        <div>
          {/* Purchase Orders Management Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="card-title">Purchase Orders</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '6px' }}>
                Create and track purchase orders, approvals, dispatch, and receiving status.
              </p>
            </div>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Item & SKU</th>
                    <th>Quantity Ordered</th>
                    <th>Received</th>
                    <th>Status</th>
                    <th>Expected Arrival</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td><span className="badge badge-gray form-input-mono">PO-{po.id}</span></td>
                      <td><strong>{po.supplierName}</strong></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{po.itemName}</div>
                        <span className="form-input-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{po.sku}</span>
                      </td>
                      <td><strong>{po.quantity} units</strong></td>
                      <td>{po.receivedQuantity} / {po.quantity}</td>
                      <td>
                        <span
                          className={`badge ${
                            po.status === 'APPROVED' || po.status === 'SENT'
                              ? 'badge-primary'
                              : po.status === 'RECEIVED'
                              ? 'badge-success'
                              : po.status === 'DRAFT'
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'Pending Approval'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          {po.status === 'DRAFT' && (
                            <button className="btn btn-success btn-sm" onClick={() => handleApprovePo(po.id)}>
                              Approve PO
                            </button>
                          )}
                          {po.status === 'APPROVED' && (
                            <button className="btn btn-primary btn-sm" onClick={() => handleSendPo(po.id)}>
                              Send EDI
                            </button>
                          )}
                          {canReceivePurchaseOrders && ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && po.remainingQuantity > 0 && (
                            <button className="btn btn-primary btn-sm" onClick={() => openReceiptForm(po)}>
                              Receive goods
                            </button>
                          )}
                          {!canReceivePurchaseOrders && ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && po.remainingQuantity > 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Warehouse receives this order</span>
                          )}
                          {!['DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLIER RATINGS */}
      {activeSubTab === 'supplier-ratings' && canSubmitSupplierReviews && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Supplier Ratings</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
              Review suppliers after a purchase order is fully received. Each completed PO can be rated once.
            </p>
          </div>

          <div className="grid-cols-3" style={{ marginBottom: '1.5rem' }}>
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="badge badge-primary">Supplier #{supplier.id}</span>
                  <span className={supplier.reviewCount ? 'badge badge-success' : 'badge badge-gray'}>
                    {supplier.reviewCount ? `★ ${supplier.rating} / 5.0` : 'Not rated yet'}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '2px' }}>{supplier.name}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{supplier.contact}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Submitted reviews:</span>
                    <strong>{supplier.reviewCount || 0}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Average lead time:</span>
                    <strong>{supplier.leadTimeDays} business days</strong>
                  </div>
                  {[
                    ['Delivery', supplier.averageDeliveryScore],
                    ['Product quality', supplier.averageQualityScore],
                    ['Communication', supplier.averageCommunicationScore],
                  ].map(([label, score]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
                      <strong>{supplier.reviewCount ? `${Number(score).toFixed(2)} / 5` : '—'}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="card-title">Completed Orders to Review</h3>
            </div>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr><th>PO Number</th><th>Supplier</th><th>Item</th><th>Received</th><th>Status</th><th>Rating</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {purchaseOrders.filter((po) => po.status === 'RECEIVED').map((po) => (
                    <tr key={po.id}>
                      <td><span className="badge badge-gray form-input-mono">PO-{po.id}</span></td>
                      <td>{po.supplierName}</td>
                      <td>{po.itemName}</td>
                      <td>{po.receivedQuantity} / {po.quantity}</td>
                      <td><span className="badge badge-success">RECEIVED</span></td>
                      <td>{po.supplierReview ? 'Reviewed' : 'Not reviewed'}</td>
                      <td>
                        {po.canReviewSupplier ? (
                          <button className="btn btn-primary btn-sm" onClick={() => {
                            setViewingReviewPoId(null);
                            setReviewingPoId(po.id);
                          }}>
                            Rate Supplier
                          </button>
                        ) : po.supplierReview ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => {
                            setReviewingPoId(null);
                            setViewingReviewPoId(viewingReviewPoId === po.id ? null : po.id);
                          }}>
                            {viewingReviewPoId === po.id ? 'Hide Review' : 'View Review'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!purchaseOrders.some((po) => po.status === 'RECEIVED') && (
                <div className="empty-state">
                  <strong>No completed purchase orders yet</strong>
                  <span>Once Warehouse staff fully receive an order, it will appear here for rating.</span>
                </div>
              )}
            </div>
          </div>

          {reviewingPoId && (
            <form className="card" onSubmit={handleSubmitSupplierReview} style={{ marginTop: '1rem' }}>
              <div className="card-header">
                <div>
                  <h3 className="card-title">Review Supplier · PO-{reviewingPoId}</h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Score the completed delivery from 1 (poor) to 5 (excellent).</p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewingPoId(null)}>Cancel</button>
              </div>
              <div className="grid-cols-3" style={{ gap: '1rem' }}>
                {[
                  ['deliveryScore', 'Delivery'],
                  ['qualityScore', 'Product quality'],
                  ['communicationScore', 'Communication'],
                ].map(([field, label]) => (
                  <label key={field} className="form-group">
                    <span className="form-label">{label}</span>
                    <select
                      className="form-input"
                      value={supplierReviewForm[field]}
                      onChange={(event) => setSupplierReviewForm((form) => ({ ...form, [field]: event.target.value }))}
                      required
                    >
                      <option value="">Choose a score</option>
                      {[1, 2, 3, 4, 5].map((score) => (
                        <option key={score} value={score}>{score} · {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][score]}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <label className="form-group" style={{ marginTop: '1rem' }}>
                <span className="form-label">Feedback (optional)</span>
                <textarea
                  className="form-input"
                  rows={3}
                  maxLength={2000}
                  value={supplierReviewForm.feedback}
                  onChange={(event) => setSupplierReviewForm((form) => ({ ...form, feedback: event.target.value }))}
                  placeholder="Add context for the scores"
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReview || !supplierReviewForm.deliveryScore || !supplierReviewForm.qualityScore || !supplierReviewForm.communicationScore}
                >
                  {submittingReview ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </form>
          )}

          {viewingReviewPoId && (() => {
            const review = purchaseOrders.find((po) => po.id === viewingReviewPoId)?.supplierReview;
            if (!review) return null;
            return (
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Supplier Review · PO-{viewingReviewPoId}</h3>
                  <span className="badge badge-success">
                    Overall {((review.deliveryScore + review.qualityScore + review.communicationScore) / 3).toFixed(2)} / 5
                  </span>
                </div>
                <div className="grid-cols-3" style={{ gap: '1rem' }}>
                  <div><span className="form-label">Delivery</span><strong>{review.deliveryScore} / 5</strong></div>
                  <div><span className="form-label">Product quality</span><strong>{review.qualityScore} / 5</strong></div>
                  <div><span className="form-label">Communication</span><strong>{review.communicationScore} / 5</strong></div>
                </div>
                <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
                  Reviewed by {review.reviewerName} · {new Date(review.createdAt).toLocaleString()}
                </p>
                {review.feedback && <p style={{ marginTop: '0.5rem' }}>{review.feedback}</p>}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 5: MASTER PRODUCT CATALOGUE */}
      {activeSubTab === 'catalog' && (
        <div>
          <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search catalogue by name, SKU, or barcode..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
            </div>
            <div style={{ width: '220px' }}>
              <select className="form-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="ALL">All Categories</option>
                {Array.from(new Set(products.map((p) => p.category))).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => openProductForm()}>
              Add Product
            </button>
          </div>

          {productFormOpen && (
            <form className="card" onSubmit={handleSaveProduct} style={{ marginBottom: '1.25rem' }}>
              <div className="card-header">
                <h3 className="card-title">{editingProductId ? 'Edit Product' : 'Add Product'}</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setProductFormOpen(false)}>Cancel</button>
              </div>
              <div className="grid-cols-4">
                {[
                  ['sku', 'SKU'], ['name', 'Product name'], ['category', 'Category'],
                  ['stock', 'Opening stock'], ['reorderPoint', 'Reorder point'], ['reorderQuantity', 'Reorder quantity'],
                  ['unitCost', 'Cost price'], ['price', 'Selling price'], ['warehouseId', 'Warehouse ID'], ['binLocation', 'Bin location'],
                ].map(([field, label]) => (
                  <label key={field} className="form-label">{label}
                    <input className="form-input" required={!['barcode', 'warehouseId'].includes(field)} type={['stock', 'reorderPoint', 'reorderQuantity', 'unitCost', 'price'].includes(field) ? 'number' : 'text'} step={['unitCost', 'price'].includes(field) ? '0.01' : '1'} value={productForm[field] ?? ''} onChange={(e) => updateProductField(field, e.target.value)} />
                  </label>
                ))}
                <label className="form-label">Product image URL
                  <input className="form-input" type="url" placeholder="https://example.com/product.jpg" value={productForm.imageUrl ?? ''} onChange={(e) => updateProductField('imageUrl', e.target.value)} />
                </label>
                {editingProductId && (
                  <label className="form-label">Barcode
                    <input className="form-input form-input-mono" value={productForm.barcode ?? ''} readOnly />
                  </label>
                )}
              </div>
              {!editingProductId && <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0.75rem 0' }}>A unique barcode will be generated automatically when this product is saved.</p>}
              <button className="btn btn-primary" type="submit">Save Product</button>
            </form>
          )}

          <div className="table-container card" style={{ padding: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Warehouse & Bin</th>
                  <th>Cost Price</th>
                  <th>Selling Price (VAT Incl)</th>
                  <th>Stock on Hand</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={p.imageUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span className="form-input-mono">{p.sku}</span> • Barcode: {p.barcode}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-gray">{p.category}</span></td>
                    <td>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{p.warehouseId}</div>
                      <span className="badge badge-gray form-input-mono" style={{ fontSize: '0.6875rem' }}>{p.binLocation}</span>
                    </td>
                    <td>R {p.unitCost.toFixed(2)}</td>
                    <td><strong>R {p.price.toFixed(2)}</strong></td>
                    <td><strong>{p.stock} units</strong></td>
                    <td>
                      <span className={`badge ${p.availableStock <= p.reorderPoint ? 'badge-danger' : 'badge-success'}`}>
                        {p.availableStock} available
                      </span>
                    </td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => openProductForm(p)}>Edit</button></td>
                    <td>
                      <span className={`badge ${p.status === 'Healthy' ? 'badge-success' : p.status === 'Watch' ? 'badge-warning' : 'badge-danger'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {receivingPoId && (
        <div className="modal-overlay" onClick={() => !submittingReceipt && setReceivingPoId(null)}>
          <form
            className="modal-content"
            onSubmit={handleReceivePurchaseOrder}
            onClick={(event) => event.stopPropagation()}
            aria-labelledby="purchase-order-receipt-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setReceivingPoId(null)}
              disabled={submittingReceipt}
              aria-label="Close goods receipt form"
            >
              ×
            </button>
            <h2 id="purchase-order-receipt-title" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Receive goods · PO-{receivingPoId}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Record the quantity physically received. Stock and the purchase order will update together.
            </p>
            {(() => {
              const purchaseOrder = purchaseOrders.find((entry) => entry.id === receivingPoId);
              return purchaseOrder ? (
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                  {purchaseOrder.itemName} · {purchaseOrder.remainingQuantity} units still due
                </p>
              ) : null;
            })()}
            <div className="form-group">
              <label className="form-label" htmlFor="receipt-quantity">Quantity received</label>
              <input
                id="receipt-quantity"
                className="form-input"
                type="number"
                min="1"
                max={purchaseOrders.find((entry) => entry.id === receivingPoId)?.remainingQuantity}
                step="1"
                value={receiptForm.quantity}
                onChange={(event) => setReceiptForm((form) => ({ ...form, quantity: event.target.value }))}
                required
              />
            </div>
            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label" htmlFor="receipt-warehouse">Receiving warehouse</label>
                {warehouses.length > 0 ? (
                  <select
                    id="receipt-warehouse"
                    className="form-select"
                    value={receiptForm.warehouseId}
                    onChange={(event) => setReceiptForm((form) => ({ ...form, warehouseId: event.target.value }))}
                    required
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.id} — {warehouse.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="receipt-warehouse"
                    className="form-input"
                    value={receiptForm.warehouseId}
                    onChange={(event) => setReceiptForm((form) => ({ ...form, warehouseId: event.target.value }))}
                    required
                  />
                )}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="receipt-bin">Receiving bin</label>
                <input
                  id="receipt-bin"
                  className="form-input"
                  value={receiptForm.binCode}
                  onChange={(event) => setReceiptForm((form) => ({ ...form, binCode: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="receipt-condition">Shipment condition</label>
              <select
                id="receipt-condition"
                className="form-select"
                value={receiptForm.condition}
                onChange={(event) => setReceiptForm((form) => ({ ...form, condition: event.target.value }))}
              >
                <option value="GOOD">Good / intact</option>
                <option value="DAMAGED">Damaged in transit</option>
                <option value="SHORTAGE">Short-shipped / missing units</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="receipt-notes">Receiving notes (optional)</label>
              <textarea
                id="receipt-notes"
                className="form-input"
                rows={3}
                maxLength={1000}
                value={receiptForm.notes}
                onChange={(event) => setReceiptForm((form) => ({ ...form, notes: event.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReceivingPoId(null)} disabled={submittingReceipt}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingReceipt}>
                {submittingReceipt ? 'Recording receipt…' : 'Confirm receipt & update stock'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
