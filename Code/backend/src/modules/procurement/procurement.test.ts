import test from 'node:test';
import assert from 'node:assert/strict';

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  generateLowStockPurchaseOrders,
  getPurchaseOrders,
  getSupplierPerformance,
  purchaseOrders,
  receivePurchaseOrder,
  sendPurchaseOrder,
  suppliers,
} from './procurement';
import { findProductBySku } from '../../inventory';

test('procurement: getPurchaseOrders returns formatted view with supplier names and remaining qty', () => {
  const orders = getPurchaseOrders();
  assert.ok(Array.isArray(orders));
  assert.ok(orders.length > 0);

  const first = orders[0];
  assert.ok(first.supplierName);
  assert.equal(typeof first.remainingQuantity, 'number');
  assert.equal(first.remainingQuantity, first.quantity - first.receivedQuantity);
});

test('procurement: createPurchaseOrder validates positive whole number quantity', () => {
  assert.throws(() => createPurchaseOrder(1, 'MILK-001', 'Milk', 0), /positive whole number/);
  assert.throws(() => createPurchaseOrder(1, 'MILK-001', 'Milk', -5), /positive whole number/);
  assert.throws(() => createPurchaseOrder(1, 'MILK-001', 'Milk', 3.14), /positive whole number/);
});

test('procurement: createPurchaseOrder validates required SKU and item name', () => {
  assert.throws(() => createPurchaseOrder(1, '', 'Milk', 10), /SKU and item name are required/);
  assert.throws(() => createPurchaseOrder(1, 'MILK-001', '  ', 10), /SKU and item name are required/);
});

test('procurement: createPurchaseOrder creates a DRAFT purchase order', () => {
  const newOrder = createPurchaseOrder(1, 'BREAD-001', 'Fresh Sliced Bread', 25, 'Emergency stock run');
  assert.ok(newOrder.id);
  assert.equal(newOrder.sku, 'BREAD-001');
  assert.equal(newOrder.quantity, 25);
  assert.equal(newOrder.receivedQuantity, 0);
  assert.equal(newOrder.status, 'DRAFT');
  assert.equal(newOrder.remainingQuantity, 25);
  assert.ok(newOrder.supplierName);
});

test('procurement: approvePurchaseOrder transitions DRAFT to APPROVED with expected delivery date', () => {
  const draftOrder = createPurchaseOrder(1, 'RICE-001', 'Parboiled Rice 2kg', 15);
  assert.equal(draftOrder.status, 'DRAFT');

  const approved = approvePurchaseOrder(draftOrder.id);
  assert.equal(approved.status, 'APPROVED');
  assert.ok(approved.approvedAt);
  assert.ok(approved.expectedDeliveryDate);

  // Approving already approved order throws
  assert.throws(() => approvePurchaseOrder(draftOrder.id), /Only draft purchase orders can be approved/);
});

test('procurement: sendPurchaseOrder transitions APPROVED to SENT', () => {
  const draftOrder = createPurchaseOrder(2, 'ELEC-003', 'Bluetooth Speaker', 10);
  assert.throws(() => sendPurchaseOrder(draftOrder.id), /Only approved purchase orders can be sent/);

  approvePurchaseOrder(draftOrder.id);
  const sent = sendPurchaseOrder(draftOrder.id);
  assert.equal(sent.status, 'SENT');
  assert.ok(sent.sentAt);
});

test('procurement: receivePurchaseOrder handles partial receiving then full receiving', () => {
  const product = findProductBySku('MILK-001');
  assert.ok(product);
  const stockBefore = product.stock;

  const order = createPurchaseOrder(1, 'MILK-001', 'Fresh Full Cream Milk 1L', 20);
  approvePurchaseOrder(order.id);
  sendPurchaseOrder(order.id);

  // Partial receiving: 8 of 20
  const partial = receivePurchaseOrder(order.id, 8, 'Hlonela Dlamini (EMP-WRH-301)');
  assert.equal(partial.status, 'PARTIALLY_RECEIVED');
  assert.equal(partial.receivedQuantity, 8);
  assert.equal(partial.remainingQuantity, 12);
  assert.equal(product.stock, stockBefore + 8);

  // Attempting to receive more than remaining (13 > 12) throws
  assert.throws(() => receivePurchaseOrder(order.id, 13), /cannot exceed outstanding quantity/);

  // Remaining receiving: 12 of 12
  const full = receivePurchaseOrder(order.id, 12, 'Hlonela Dlamini (EMP-WRH-301)');
  assert.equal(full.status, 'RECEIVED');
  assert.equal(full.receivedQuantity, 20);
  assert.equal(full.remainingQuantity, 0);
  assert.equal(product.stock, stockBefore + 20);
});

test('procurement: cancelPurchaseOrder cancels active order and rejects closed orders', () => {
  const order = createPurchaseOrder(1, 'FOOD-002', 'Green Tea Box', 12);
  const cancelled = cancelPurchaseOrder(order.id);
  assert.equal(cancelled.status, 'CANCELLED');

  // Attempting to cancel already cancelled order throws
  assert.throws(() => cancelPurchaseOrder(order.id), /Purchase order is already closed/);
});

test('procurement: generateLowStockPurchaseOrders creates POs for low stock items without duplicates', () => {
  const generated1 = generateLowStockPurchaseOrders();
  assert.ok(Array.isArray(generated1));

  // Running again should not create duplicate open POs for the same SKUs
  const generated2 = generateLowStockPurchaseOrders();
  assert.equal(generated2.length, 0);
});

test('procurement: getSupplierPerformance calculates ratings, priorities, and risk', () => {
  const performance = getSupplierPerformance();
  assert.ok(Array.isArray(performance));
  assert.equal(performance.length, suppliers.length);

  for (const s of performance) {
    assert.ok(s.id);
    assert.ok(s.name);
    assert.ok(['High', 'Medium'].includes(s.suggestedPriority));
    assert.ok(['Normal', 'Watch'].includes(s.risk));
  }
});
