import React, { useState } from 'react';
import { Icon } from '../common/Icons';

export const WarehouseWorkspace = ({ workspace, apiBase, token, currentUser, onRefresh, onNotify }) => {
  const [activeTab, setActiveTab] = useState('receiving'); // 'receiving' | 'cycle-count' | 'adjustments' | 'fulfillment'
  const [isMobileSimMode, setIsMobileSimMode] = useState(false);

  const products = workspace.products || [];
  const purchaseOrders = workspace.purchaseOrders || [];
  const cycleCounts = workspace.cycleCounts || [];
  const orders = workspace.orders || [];

  // Receiving Goods State
  const [selectedPoId, setSelectedPoId] = useState('');
  const [receivedQty, setReceivedQty] = useState('');
  const [receivingCondition, setReceivingCondition] = useState('GOOD');
  const [receivingNotes, setReceivingNotes] = useState('');
  const [receivingLoading, setReceivingLoading] = useState(false);

  // Cycle Count State (Design Iteration 1)
  const [auditWarehouse, setAuditWarehouse] = useState('JHB-01');
  const [auditBin, setAuditBin] = useState('C3-042');
  const [auditItems, setAuditItems] = useState(
    products.slice(0, 4).map((p) => ({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      systemQty: p.stock,
      countedQty: p.stock,
      verified: true,
    }))
  );
  const [auditNotes, setAuditNotes] = useState('');
  const [submittingAudit, setSubmittingAudit] = useState(false);

  // Stock Adjustment State
  const [adjProductId, setAdjProductId] = useState('');
  const [adjType, setAdjType] = useState('ADD');
  const [adjQty, setAdjQty] = useState(5);
  const [adjReason, setAdjReason] = useState('Supplier Stock Received');
  const [adjLoading, setAdjLoading] = useState(false);

  // Online Fulfillment State
  const [selectedOrderId, setSelectedOrderId] = useState('');

  // Handle PO Goods Receiving
  const handleReceiveGoods = async (e) => {
    e.preventDefault();
    if (!selectedPoId) {
      onNotify?.('Please select a purchase order', 'error');
      return;
    }

    setReceivingLoading(true);
    try {
      const po = purchaseOrders.find((p) => p.id === Number(selectedPoId));
      const res = await fetch(`${apiBase}/api/purchase-orders/${selectedPoId}/receive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity: Number(receivedQty) || po?.remainingQuantity || 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to receive goods');
      }

      onRefresh();
      onNotify?.(`Received PO-${selectedPoId} items. Stock-on-hand updated!`, 'success');
      setSelectedPoId('');
      setReceivedQty('');
      setReceivingNotes('');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setReceivingLoading(false);
    }
  };

  // Handle Cycle Count Stepper
  const handleUpdateAuditCount = (productId, delta) => {
    setAuditItems(
      auditItems.map((item) =>
        item.productId === productId ? { ...item, countedQty: Math.max(0, item.countedQty + delta) } : item
      )
    );
  };

  // Submit Cycle Count (Sticky Footer Action)
  const handleSubmitAudit = async () => {
    setSubmittingAudit(true);
    try {
      const res = await fetch(`${apiBase}/api/cycle-counts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          warehouseId: auditWarehouse,
          binCode: auditBin,
          items: auditItems.map((i) => ({ productId: i.productId, countedQty: i.countedQty })),
          notes: auditNotes || 'Physical cycle count verification',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit cycle count');
      }

      onRefresh();
      onNotify?.(`Audit ${data.auditRecord.auditNumber} reconciled and logged to immutable audit trail`, 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setSubmittingAudit(false);
    }
  };

  // Handle Stock Adjustment
  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    if (!adjProductId) return;

    setAdjLoading(true);
    try {
      const qtyDelta = adjType === 'ADD' ? Number(adjQty) : -Number(adjQty);
      const res = await fetch(`${apiBase}/api/receiving`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: Number(adjProductId),
          quantity: Math.abs(qtyDelta),
          notes: `Manual adjustment (${adjType}): ${adjReason}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onRefresh();
      onNotify?.(`Stock adjustment applied successfully`, 'success');
      setAdjProductId('');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setAdjLoading(false);
    }
  };

  // Handle Pick & Pack Status Progression
  const handleFulfillOrder = async (orderId) => {
    try {
      const res = await fetch(`${apiBase}/api/orders/${orderId}/commit`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        onRefresh();
        onNotify?.(`Order committed to shipping. Label generated!`, 'success');
      }
    } catch (err) {
      onNotify?.('Fulfillment update failed', 'error');
    }
  };

  const pendingDeliveries = purchaseOrders.filter((p) => p.status === 'APPROVED' || p.status === 'SENT');

  return (
    <div style={{ padding: '1rem 1.5rem', maxWidth: isMobileSimMode ? '480px' : '1400px', margin: '0 auto' }}>
      {/* Header & Mobile Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-warning">
              <Icon name="truck" size={14} /> Warehouse Logistics Terminal
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Facility: Johannesburg Central (JHB-01)</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px' }}>
            Inbound, Audit & Fulfillment Operations
          </h1>
        </div>

        <button
          className={`btn ${isMobileSimMode ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setIsMobileSimMode(!isMobileSimMode)}
        >
          <Icon name={isMobileSimMode ? 'monitor' : 'smartphone'} size={16} />
          {isMobileSimMode ? 'Desktop Terminal' : 'Mobile Handheld Mode'}
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem', paddingBottom: '0.5rem' }}>
        <button className={`btn ${activeTab === 'receiving' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('receiving')}>
          <Icon name="truck" size={16} /> Receive Goods ({pendingDeliveries.length})
        </button>
        <button className={`btn ${activeTab === 'cycle-count' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('cycle-count')}>
          <Icon name="clipboard-list" size={16} /> Inventory Audit (Cycle Count)
        </button>
        <button className={`btn ${activeTab === 'adjustments' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('adjustments')}>
          <Icon name="refresh-cw" size={16} /> Stock Adjustments
        </button>
        <button className={`btn ${activeTab === 'fulfillment' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('fulfillment')}>
          <Icon name="box" size={16} /> Pick & Pack Fulfillment ({orders.length})
        </button>
      </div>

      {/* TAB 1: RECEIVE GOODS AGAINST PO */}
      {activeTab === 'receiving' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="truck" size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Receive Inbound Shipments</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Verify supplier deliveries against approved Purchase Orders and record discrepancies.
                </p>
              </div>
            </div>

            {pendingDeliveries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)' }}>
                <Icon name="box" size={40} className="mb-2 opacity-50" />
                <p style={{ fontWeight: 600 }}>No pending deliveries awaiting receipt</p>
                <p style={{ fontSize: '0.75rem' }}>All approved supplier shipments have been fully received.</p>
              </div>
            ) : (
              <form onSubmit={handleReceiveGoods}>
                <div className="form-group">
                  <label className="form-label">Select Inbound Purchase Order (or Scan Delivery Barcode)</label>
                  <select
                    className="form-select"
                    value={selectedPoId}
                    onChange={(e) => {
                      setSelectedPoId(e.target.value);
                      const po = purchaseOrders.find((p) => p.id === Number(e.target.value));
                      if (po) setReceivedQty(po.remainingQuantity);
                    }}
                    required
                  >
                    <option value="">-- Choose active delivery --</option>
                    {pendingDeliveries.map((po) => (
                      <option key={po.id} value={po.id}>
                        PO-{po.id}: {po.itemName} ({po.sku}) • Supplier: {po.supplierName} • Qty Due: {po.remainingQuantity}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Quantity Received</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      value={receivedQty}
                      onChange={(e) => setReceivedQty(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Shipment Condition</label>
                    <select
                      className="form-select"
                      value={receivingCondition}
                      onChange={(e) => setReceivingCondition(e.target.value)}
                    >
                      <option value="GOOD">Good / Intact</option>
                      <option value="DAMAGED">Damaged in Transit</option>
                      <option value="SHORTAGE">Short-Shipped / Missing Units</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Receiving Notes / Discrepancy Log</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Scanned at Dock 3. Verified batch numbers."
                    value={receivingNotes}
                    onChange={(e) => setReceivingNotes(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={receivingLoading || !selectedPoId}
                >
                  <Icon name="check" size={20} />
                  {receivingLoading ? 'Updating Stock...' : 'Confirm Goods Receipt & Update Stock'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY AUDIT / CYCLE COUNT (DESIGN ITERATION 1) */}
      {activeTab === 'cycle-count' && (
        <div>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Bin-Level Cycle Count Audit</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Direct scanning and physical count verification for targeted warehouse bin zones.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className="badge badge-primary form-input-mono">{auditWarehouse}</span>
                <span className="badge badge-gray form-input-mono">Bin: {auditBin}</span>
              </div>
            </div>

            {/* Verification Items List */}
            <div className="table-container" style={{ border: 'none', marginBottom: '1rem' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product & SKU</th>
                    <th>System Quantity</th>
                    <th>Physical Count (Steppers)</th>
                    <th>Discrepancy Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {auditItems.map((item) => {
                    const delta = item.countedQty - item.systemQty;
                    return (
                      <tr key={item.productId}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <span className="form-input-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sku}</span>
                        </td>
                        <td><strong>{item.systemQty} units</strong></td>
                        <td>
                          <div className="stepper">
                            <button type="button" className="stepper-btn" onClick={() => handleUpdateAuditCount(item.productId, -1)}>-</button>
                            <span className="stepper-val">{item.countedQty}</span>
                            <button type="button" className="stepper-btn" onClick={() => handleUpdateAuditCount(item.productId, 1)}>+</button>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${delta === 0 ? 'badge-success' : delta > 0 ? 'badge-primary' : 'badge-danger'}`}>
                            {delta === 0 ? 'Match (0)' : `${delta > 0 ? '+' : ''}${delta} discrepancy`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="form-group">
              <label className="form-label">Audit Notes & Auditor Attribution</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Scheduled bi-weekly physical cycle count for Zone C"
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Sticky High-Contrast Footer Action (Design Iteration 1 from document) */}
          <div className="sticky-footer-bar">
            <div>
              <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                {auditItems.length} of {auditItems.length} Products Verified
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auditor: {currentUser?.name} ({currentUser?.employeeId})
              </div>
            </div>

            <button
              className="btn btn-success btn-lg"
              style={{ padding: '10px 28px', fontSize: '1rem', fontWeight: 800 }}
              disabled={submittingAudit}
              onClick={handleSubmitAudit}
            >
              <Icon name="check-circle" size={20} />
              {submittingAudit ? 'Submitting...' : 'Submit Audit & Reconcile'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK ADJUSTMENTS */}
      {activeTab === 'adjustments' && (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>
              <Icon name="refresh-cw" size={18} /> Manual Stock Adjustment
            </h3>

            <form onSubmit={handleStockAdjustment}>
              <div className="form-group">
                <label className="form-label">Select Product</label>
                <select
                  className="form-select"
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                  required
                >
                  <option value="">-- Choose item --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) - Current Stock: {p.stock} units
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Adjustment Type</label>
                  <select className="form-select" value={adjType} onChange={(e) => setAdjType(e.target.value)}>
                    <option value="ADD">Add Stock (+)</option>
                    <option value="DEDUCT">Deduct Stock (-)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={adjQty}
                    onChange={(e) => setAdjQty(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Adjustment</label>
                <select className="form-select" value={adjReason} onChange={(e) => setAdjReason(e.target.value)}>
                  <option value="Damaged goods written off">Damaged goods written off</option>
                  <option value="Supplier stock arrived">Supplier stock arrived</option>
                  <option value="Internal transfer between facilities">Internal transfer between facilities</option>
                  <option value="Promotional sample allocation">Promotional sample allocation</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={adjLoading || !adjProductId}>
                {adjLoading ? 'Saving...' : 'Submit Adjustment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: ONLINE ORDER PICK & PACK */}
      {activeTab === 'fulfillment' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 className="card-title">Online Orders & Pick-Path Fulfillment</h3>
          </div>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer & Address</th>
                  <th>Status</th>
                  <th>Line Items (Pick Path)</th>
                  <th>Total Amount</th>
                  <th style={{ textAlign: 'right' }}>Fulfillment Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><span className="badge badge-primary form-input-mono">{o.orderNumber}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.customerName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.shippingAddress}</div>
                    </td>
                    <td>
                      <span className={`badge ${o.status === 'PAID' ? 'badge-success' : o.status === 'PICKING' ? 'badge-warning' : 'badge-primary'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>
                        {o.items.map((i) => (
                          <div key={i.productId}>
                            • {i.name} x{i.quantity}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td><strong>R {o.total.toFixed(2)}</strong></td>
                    <td style={{ textAlign: 'right' }}>
                      {o.status === 'RESERVED' || o.status === 'PENDING' ? (
                        <button className="btn btn-primary btn-sm" onClick={() => handleFulfillOrder(o.id)}>
                          <Icon name="box" size={14} /> Commit & Pick
                        </button>
                      ) : (
                        <span className="badge badge-success">✓ Picked & Packed</span>
                      )}
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

