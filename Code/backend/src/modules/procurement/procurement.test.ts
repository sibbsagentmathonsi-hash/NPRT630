import test from 'node:test';
import assert from 'node:assert/strict';

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  generateLowStockPurchaseOrders,
  getPurchaseOrders,
  getSupplierPerformance,
  getActiveSupplierById,
  addSupplierReview,
  addSupplier,
  hydrateSuppliers,
  purchaseOrders,
  receivePurchaseOrder,
  sendPurchaseOrder,
  suppliers,
  setSupplierArchived,
  validateNewSupplier,
  validateSupplierReview,
} from './procurement';
import { findProductBySku, getInventoryItems } from '../../inventory';
import { runInCompany } from '../../config/tenancy';

hydrateSuppliers([
  { id: 1, name: 'Test Supplier One', contact: 'one@example.test', leadTimeDays: 3 },
  { id: 2, name: 'Test Supplier Two', contact: 'two@example.test', leadTimeDays: 5 },
  { id: 3, name: 'Test Supplier Three', contact: 'three@example.test', leadTimeDays: 7 },
  { id: 4, name: 'Test Supplier Four', contact: 'four@example.test', leadTimeDays: 4 },
]);

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
  const partial = receivePurchaseOrder(order.id, 8, 'Hlonela Dlamini (WRH-301)', 'CPT-02', 'T-20');
  assert.equal(partial.status, 'PARTIALLY_RECEIVED');
  assert.equal(partial.receivedQuantity, 8);
  assert.equal(partial.remainingQuantity, 12);
  assert.equal(getInventoryItems(product.id).find((item) => item.warehouseId === 'CPT-02' && item.binCode === 'T-20')?.qtyOnHand, 8);
  assert.equal(product.stock, stockBefore + 8);

  // Attempting to receive more than remaining (13 > 12) throws
  assert.throws(() => receivePurchaseOrder(order.id, 13), /cannot exceed outstanding quantity/);

  // Remaining receiving: 12 of 12
  const full = receivePurchaseOrder(order.id, 12, 'Hlonela Dlamini (WRH-301)');
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
    assert.equal(s.rating, 0);
    assert.equal(s.reviewCount, 0);
    assert.ok(['High', 'Medium', 'Unrated'].includes(s.suggestedPriority));
    assert.ok(['Normal', 'Watch', 'Unrated'].includes(s.risk));
  }
});

test('procurement: reviews require full receipt and produce supplier averages once per PO', () => {
  const order = createPurchaseOrder(3, 'MILK-001', 'Fresh Full Cream Milk 1L', 1);
  const reviewInput = {
    deliveryScore: 5,
    qualityScore: 4,
    communicationScore: 5,
    reviewerId: 'reviewer-1',
    reviewerName: 'Procurement Reviewer',
  };

  assert.throws(() => validateSupplierReview(order.id, reviewInput), /fully received/);

  approvePurchaseOrder(order.id);
  sendPurchaseOrder(order.id);
  receivePurchaseOrder(order.id, 1, 'Warehouse Staff');

  assert.throws(
    () => validateSupplierReview(order.id, { ...reviewInput, deliveryScore: 6 }),
    /whole number from 1 to 5/
  );
  const review = validateSupplierReview(order.id, reviewInput);
  addSupplierReview(review);

  const supplier = getSupplierPerformance().find((entry) => entry.id === order.supplierId);
  assert.ok(supplier);
  assert.equal(supplier.reviewCount, 1);
  assert.equal(supplier.averageDeliveryScore, 5);
  assert.equal(supplier.averageQualityScore, 4);
  assert.equal(supplier.averageCommunicationScore, 5);
  assert.equal(supplier.rating, 4.67);
  assert.equal(getPurchaseOrders().find((entry) => entry.id === order.id)?.supplierReview?.reviewerName, 'Procurement Reviewer');
  assert.throws(() => validateSupplierReview(order.id, reviewInput), /already been reviewed/);

  const secondOrder = createPurchaseOrder(3, 'MILK-001', 'Fresh Full Cream Milk 1L', 1);
  approvePurchaseOrder(secondOrder.id);
  sendPurchaseOrder(secondOrder.id);
  receivePurchaseOrder(secondOrder.id, 1, 'Warehouse Staff');
  addSupplierReview(validateSupplierReview(secondOrder.id, {
    ...reviewInput,
    deliveryScore: 1,
    qualityScore: 2,
    communicationScore: 3,
  }));

  const averagedSupplier = getSupplierPerformance().find((entry) => entry.id === order.supplierId);
  assert.ok(averagedSupplier);
  assert.equal(averagedSupplier.reviewCount, 2);
  assert.equal(averagedSupplier.rating, 3.33);
  assert.equal(averagedSupplier.averageDeliveryScore, 3);
  assert.equal(averagedSupplier.averageQualityScore, 3);
  assert.equal(averagedSupplier.averageCommunicationScore, 4);

  let otherCompanyError: unknown;
  runInCompany('company-other', () => {
    try {
      validateSupplierReview(order.id, reviewInput);
    } catch (error) {
      otherCompanyError = error;
    }
  });
  assert.match(String(otherCompanyError), /Purchase order not found/);
});

test('procurement: supplier creation requires explicit values and rejects duplicates', () => {
  assert.throws(() => validateNewSupplier({}), /name, contact details, and lead time are required/);
  assert.throws(() => validateNewSupplier({ name: 'New supplier', contact: 'new@example.test', leadTimeDays: 0 }), /whole number from 1 to 365/);
  assert.throws(() => validateNewSupplier({ name: ' test supplier one ', contact: 'unique@example.test', leadTimeDays: 3 }), /already exists/);

  const input = validateNewSupplier({ name: 'New Supplier', contact: 'new@example.test', leadTimeDays: 6 });
  const created = addSupplier({ ...input, id: 5 });
  assert.equal(created.name, 'New Supplier');
  assert.equal(created.contact, 'new@example.test');
  assert.equal(created.leadTimeDays, 6);
});

test('procurement: archived suppliers remain visible but cannot receive new purchase orders', () => {
  const supplier = getActiveSupplierById(5);
  assert.ok(supplier);
  assert.equal(supplier.isArchived, false);

  setSupplierArchived(5, true);
  assert.equal(getActiveSupplierById(5), undefined);
  assert.equal(getSupplierPerformance().some((entry) => entry.id === 5 && entry.isArchived), true);
  assert.throws(() => createPurchaseOrder(5, 'TEST-005', 'Archived supplier item', 1), /active supplier/);

  setSupplierArchived(5, false);
  assert.equal(getActiveSupplierById(5)?.id, 5);
});

test('procurement: purchase order creation rejects unregistered suppliers', () => {
  assert.throws(() => createPurchaseOrder(999, 'TEST-001', 'Test item', 1), /registered with this company/);
  runInCompany('company-other', () => {
    assert.throws(() => createPurchaseOrder(1, 'TEST-001', 'Test item', 1), /registered with this company/);
  });
});
