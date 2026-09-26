import React, { useState } from 'react';
import { Icon } from '../common/Icons';

export const ManagerWorkspace = ({ workspace, apiBase, token, currentUser, onRefresh, onNotify }) => {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'forecasting' | 'suppliers' | 'catalog'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [generatingPo, setGeneratingPo] = useState(false);
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

  const handleCreatePoFromForecast = async (item) => {
    try {
      const supplier = suppliers[0] || { id: 1 };
      const res = await fetch(`${apiBase}/api/purchase-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-primary">
              <Icon name="trending-up" size={14} /> Store Manager Command Center
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Real-time business intelligence</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em' }}>
            Store Operations & Demand Analytics
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={onRefresh}>
            <Icon name="refresh-cw" size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleGenerateLowStockPos} disabled={generatingPo}>
            <Icon name="zap" size={16} /> {generatingPo ? 'Evaluating Stock...' : 'Auto-Generate Low Stock POs'}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button className={`btn ${activeSubTab === 'overview' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('overview')}>
          <Icon name="trending-up" size={16} /> Executive KPI Dashboard
        </button>
        <button className={`btn ${activeSubTab === 'forecasting' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('forecasting')}>
          <Icon name="clipboard-list" size={16} /> AI Demand Forecasting & EOQ Report
        </button>
        <button className={`btn ${activeSubTab === 'suppliers' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('suppliers')}>
          <Icon name="truck" size={16} /> Suppliers & Purchase Orders ({purchaseOrders.length})
        </button>
        <button className={`btn ${activeSubTab === 'catalog' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveSubTab('catalog')}>
          <Icon name="box" size={16} /> Master Product Inventory ({products.length})
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
                <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <Icon name="dollar-sign" size={18} />
                </div>
              </div>
              <div className="kpi-value">R {summary.dailySales?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-subtext" style={{ color: 'var(--success-text)' }}>
                ↑ +12.5% vs previous month
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Stock on Hand / Lines</span>
                <div className="kpi-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                  <Icon name="box" size={18} />
                </div>
              </div>
              <div className="kpi-value">{summary.stockOnHand} units</div>
              <div className="kpi-subtext">Across {products.length} product lines in 2 warehouses</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Low Stock Critical Alerts</span>
                <div className="kpi-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                  <Icon name="alert-triangle" size={18} />
                </div>
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
                <div className="kpi-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                  <Icon name="trending-up" size={18} />
                </div>
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
              <div className="card-header">
                <h3 className="card-title">
                  <Icon name="trending-up" size={18} /> Sales Overview (ZAR) & Machine Learning Projection
                </h3>
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
              <div className="card-header">
                <h3 className="card-title">
                  <Icon name="box" size={18} /> Products by Category Breakdown
                </h3>
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
              <h3 className="card-title">
                <Icon name="zap" size={18} /> Fast-Moving SKU Velocity & Merchandising Performance
              </h3>
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
              <div style={{ color: 'var(--primary)' }}><Icon name="clipboard-list" size={24} /></div>
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
                          <Icon name="plus" size={14} /> Approve & Create PO
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

      {/* TAB 3: SUPPLIERS & PURCHASE ORDERS */}
      {activeSubTab === 'suppliers' && (
        <div>
          {/* Supplier Performance Scorecards */}
          <div className="grid-cols-3" style={{ marginBottom: '1.5rem' }}>
            {suppliers.map((s) => (
              <div key={s.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="badge badge-primary">Supplier #{s.id}</span>
                  <span className="badge badge-success">⭐ {s.rating} / 5.0</span>
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '2px' }}>{s.name}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{s.contact}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Average Lead Time:</span>
                    <strong>{s.leadTimeDays} business days</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>On-Time Delivery Rate:</span>
                    <strong style={{ color: s.onTimeDeliveryRate >= 90 ? 'var(--success)' : 'var(--warning)' }}>
                      {s.onTimeDeliveryRate}%
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Purchase Orders Management Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="card-title">Procurement & Active Purchase Orders</h3>
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

      {/* TAB 4: MASTER PRODUCT CATALOGUE */}
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
              <Icon name="plus" size={16} /> Add Product
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
              <button className="btn btn-primary" type="submit"><Icon name="check" size={16} /> Save Product</button>
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
                    <td><button className="btn btn-secondary btn-sm" onClick={() => openProductForm(p)}><Icon name="edit" size={14} /> Edit</button></td>
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
    </div>
  );
};
