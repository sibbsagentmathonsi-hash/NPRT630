import test from 'node:test';
import assert from 'node:assert/strict';

import {
  commitReservedOrder,
  createOnlineOrder,
  createProduct,
  createReceiving,
  createReturn,
  createSaleTransaction,
  findProductById,
  findProductBySku,
  getAvailableStock,
  getDashboardSummary,
  getLowStockProducts,
  getProductSnapshots,
  getProductStatus,
  products,
  recordCycleCount,
  releaseReservedOrder,
  stockAfterReceive,
  stockAfterReturn,
  stockAfterSale,
  toProductSnapshot,
  type Product,
} from './inventory';
import {
  authenticateUser,
  generateToken,
  hasPermission,
  registerEmployee,
  setFirstPassword,
  validatePasswordStrength,
  verifyToken,
} from './modules/auth/auth';

test('sale deducts stock when quantity is valid', () => {
  assert.equal(stockAfterSale(50, 12), 38);
});

test('sale rejects quantity greater than available stock', () => {
  assert.throws(() => stockAfterSale(5, 7), /Insufficient stock/);
});

test('return restores stock', () => {
  assert.equal(stockAfterReturn(20, 6), 26);
});

test('receiving adds stock when quantity is valid', () => {
  assert.equal(stockAfterReceive(12, 8), 20);
});

test('sale rejects non-whole quantities', () => {
  assert.throws(() => stockAfterSale(10, 1.5), /positive whole number/);
});

test('multi-line sale validates every line before updating stock and generates receipt with VAT', () => {
  const milk = findProductById(1);
  const bread = findProductById(2);
  assert.ok(milk);
  assert.ok(bread);

  const milkStockBefore = milk.stock;
  const breadStockBefore = bread.stock;

  // Attempt exceeding stock on second item
  assert.throws(
    () =>
      createSaleTransaction([
        { productId: milk.id, quantity: 1 },
        { productId: bread.id, quantity: 999 },
      ]),
    /Insufficient stock/
  );

  assert.equal(milk.stock, milkStockBefore);
  assert.equal(bread.stock, breadStockBefore);

  // Valid multi-line checkout
  const saleResult = createSaleTransaction(
    [
      { productId: milk.id, quantity: 2 },
      { productId: bread.id, quantity: 1 },
    ],
    {
      cashierName: 'Thandi Molefe',
      cashierEmployeeId: 'EMP-CSH-201',
      paymentMethod: 'CASH',
      discountPercent: 10,
      tenderAmount: 100,
    }
  );

  assert.ok(saleResult.receipt.receiptNumber.startsWith('REC-'));
  assert.ok(saleResult.receipt.vatAmount > 0);
  assert.ok(saleResult.receipt.changeAmount !== undefined);
  assert.equal(milk.stock, milkStockBefore - 2);
});

test('process return restores stock and records structured reason', () => {
  const milk = findProductById(1);
  assert.ok(milk);
  const stockBefore = milk.stock;

  const returnResult = createReturn({
    productId: milk.id,
    quantity: 2,
    reason: 'Damaged Product',
    notes: 'Seal was damaged during transit',
    actor: 'Thandi Molefe (EMP-CSH-201)',
  });

  assert.equal(milk.stock, stockBefore + 2);
  assert.ok(returnResult.returnId.startsWith('RTN-'));
  assert.ok(returnResult.refundAmount > 0);
  assert.equal(returnResult.movement.type, 'RETURN');
  assert.ok(returnResult.movement.notes?.includes('Damaged Product'));
});

test('receiving goods updates stock and records PO reference', () => {
  const bread = findProductById(2);
  assert.ok(bread);
  const stockBefore = bread.stock;

  const receiveResult = createReceiving(bread.id, 10, 'Supplier delivery received in good condition', 'Warehouse Staff', 'PO-9001');

  assert.equal(bread.stock, stockBefore + 10);
  assert.equal(receiveResult.movement.type, 'RECEIVE');
  assert.equal(receiveResult.movement.reference, 'PO-9001');
});

test('cycle count reconciles stock discrepancies with audit movement', () => {
  const item = findProductById(3);
  assert.ok(item);
  const targetStock = 50;

  const cycleResult = recordCycleCount({
    warehouseId: 'CPT-02',
    binCode: 'B-04',
    items: [{ productId: item.id, countedQty: targetStock }],
    actor: 'Hlonela Dlamini (EMP-WRH-301)',
    notes: 'Monthly physical count',
  });

  assert.equal(item.stock, targetStock);
  assert.equal(cycleResult.status, 'APPROVED');
  assert.equal(cycleResult.items[0].countedQty, targetStock);
});

test('reserved online orders reduce available stock and can be released', () => {
  const product = createProduct({
    sku: 'TEST-RESERVE-01',
    barcode: '999000000001',
    name: 'Reservation Test Item',
    category: 'Test',
    supplierId: 1,
    stock: 10,
    reorderPoint: 2,
    reorderQuantity: 5,
    unitCost: 1,
    price: 2,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'T-01',
  });

  const order = createOnlineOrder({
    customerName: 'Test Customer',
    items: [{ productId: product.id, quantity: 4 }],
  });

  const reservedProduct = findProductById(product.id);
  assert.ok(reservedProduct);
  assert.equal(reservedProduct.qtyReserved, 4);

  releaseReservedOrder(order.id);
  assert.equal(reservedProduct.qtyReserved, 0);
  assert.equal(reservedProduct.stock, 10);
});

test('admin can register new employee by sector with generated Employee ID', () => {
  const regResult = registerEmployee({
    name: 'Neo Khumalo',
    email: 'neo.khumalo@retail.local',
    role: 'WAREHOUSE_STAFF',
    sector: 'Warehouse & Logistics',
    adminActor: 'admin@retail.local',
  });

  assert.equal(regResult.success, true);
  assert.ok(regResult.user);
  assert.ok(regResult.user.employeeId.startsWith('EMP-WRH-'));
  assert.equal(regResult.user.status, 'PENDING_SETUP');
  assert.equal(regResult.user.isFirstLogin, true);
});

test('admin login works with Employee ID and email', () => {
  const userByEmail = authenticateUser('sibbs.agentmathonsi@gmail.com', '@Arg3nt2003');
  assert.ok(userByEmail);

  const userById = authenticateUser('EMP-ADM-001', '@Arg3nt2003');
  assert.ok(userById);
  assert.equal(userById.email, 'sibbs.agentmathonsi@gmail.com');
});
test('password policy validator enforces strong security rules', () => {
  const weakCheck = validatePasswordStrength('weak');
  assert.ok(weakCheck.errors.length >= 3);

  const strongCheck = validatePasswordStrength('SecureP@ss2026!');
  assert.equal(strongCheck.isValid, true);
  assert.equal(strongCheck.errors.length, 0);
});

test('first-time password setup activates account and updates status', () => {
  const regResult = registerEmployee({
    name: 'Kego Ikaneng',
    email: 'kego@test.local',
    role: 'CASHIER',
    sector: 'Cashier & Front-of-House',
    tempPassword: 'tempPass123!',
  });

  const setupResult = setFirstPassword(regResult.user.employeeId, 'MyBrandNewP@ssw0rd!');
  assert.equal(setupResult.success, true);
  assert.equal(setupResult.user?.status, 'ACTIVE');

  const newLogin = authenticateUser(regResult.user.employeeId, 'MyBrandNewP@ssw0rd!');
  assert.ok(newLogin);
});

test('generateToken and verifyToken preserve employee ID, sector, and role', () => {
  const token = generateToken({
    id: 1,
    employeeId: 'EMP-ADM-001',
    name: 'Sibusiso Mathonsi',
    email: 'sibbs.agentmathonsi@gmail.com',
    role: 'ADMIN' as const,
    sector: 'System Administration' as const,
    status: 'ACTIVE' as const,
    isFirstLogin: false,
    mfaEnabled: true,
    emailVerified: true,
    createdAt: '2026-01-01T08:00:00.000Z',
  });

  const payload = verifyToken(token);
  assert.equal(payload.employeeId, 'EMP-ADM-001');
  assert.equal(payload.role, 'ADMIN');
  assert.equal(payload.sector, 'System Administration');
});

test('permissions keep admin separate from worker operations', () => {
  assert.equal(hasPermission('ADMIN', 'ADMIN'), true);
  assert.equal(hasPermission('ADMIN', 'MANAGER'), false);
  assert.equal(hasPermission('MANAGER', 'CASHIER'), true);
  assert.equal(hasPermission('CASHIER', 'ADMIN'), false);
  assert.equal(hasPermission('WAREHOUSE_STAFF', 'CASHIER'), false);
});

test('inventory: findProductBySku normalizes whitespace and casing', () => {
  const byLower = findProductBySku('milk-001');
  assert.ok(byLower);
  assert.equal(byLower.sku, 'MILK-001');

  const withSpaces = findProductBySku('  bread-001  ');
  assert.ok(withSpaces);
  assert.equal(withSpaces.sku, 'BREAD-001');

  const notFound = findProductBySku('UNKNOWN-SKU-404');
  assert.equal(notFound, undefined);
});

test('inventory: getAvailableStock computes stock minus qtyReserved clamped to zero', () => {
  const p1: Product = Object.assign({}, products[0], { stock: 10, qtyReserved: 4 });
  assert.equal(getAvailableStock(p1), 6);

  const p2: Product = Object.assign({}, products[0], { stock: 5, qtyReserved: 10 });
  assert.equal(getAvailableStock(p2), 0);

  const p3: Product = Object.assign({}, products[0], { stock: 20, qtyReserved: 0 });
  assert.equal(getAvailableStock(p3), 20);
});

test('inventory: getProductStatus returns Reorder, Watch, and Healthy correctly', () => {
  const zeroStock: Product = Object.assign({}, products[0], { stock: 2, qtyReserved: 2, reorderPoint: 5 });
  assert.equal(getProductStatus(zeroStock), 'Reorder');

  const watchStock: Product = Object.assign({}, products[0], { stock: 5, qtyReserved: 1, reorderPoint: 5 });
  // available 4 <= reorderPoint 5 => Watch
  assert.equal(getProductStatus(watchStock), 'Watch');

  const healthyStock: Product = Object.assign({}, products[0], { stock: 30, qtyReserved: 2, reorderPoint: 10 });
  // available 28 > reorderPoint 10 => Healthy
  assert.equal(getProductStatus(healthyStock), 'Healthy');
});

test('inventory: toProductSnapshot adds availableStock and status properties', () => {
  const p = findProductById(1);
  assert.ok(p);
  const snapshot = toProductSnapshot(p);
  assert.equal(snapshot.id, p.id);
  assert.equal(typeof snapshot.availableStock, 'number');
  assert.ok(['Healthy', 'Watch', 'Reorder'].includes(snapshot.status));
});

test('inventory: getProductSnapshots and getLowStockProducts filter active items', () => {
  const allSnapshots = getProductSnapshots();
  assert.ok(allSnapshots.length > 0);
  assert.ok(allSnapshots.every((item) => item.isActive));

  const lowStock = getLowStockProducts();
  assert.ok(Array.isArray(lowStock));
  assert.ok(lowStock.every((item) => item.availableStock <= item.reorderPoint));
});

test('inventory: commitReservedOrder commits order, decrements physical stock and logs SALE movement', () => {
  const product = createProduct({
    sku: 'TEST-COMMIT-01',
    barcode: '999000000002',
    name: 'Commit Fulfillment Item',
    category: 'Test',
    supplierId: 1,
    stock: 25,
    reorderPoint: 5,
    reorderQuantity: 10,
    unitCost: 10,
    price: 20,
    warehouse: 'Johannesburg Central (JHB-01)',
    warehouseId: 'JHB-01',
    binLocation: 'TC-01',
  });

  const order = createOnlineOrder({
    customerName: 'Sipho Ndlovu',
    items: [{ productId: product.id, quantity: 5 }],
  });
  const liveProduct = findProductById(product.id);
  assert.ok(liveProduct);
  assert.equal(order.status, 'RESERVED');
  assert.equal(liveProduct.qtyReserved, 5);
  assert.equal(liveProduct.stock, 25);

  const committed = commitReservedOrder(order.id);
  assert.equal(committed.status, 'PAID');
  assert.equal(liveProduct.stock, 20); // 25 - 5
  assert.equal(liveProduct.qtyReserved, 0); // reserved released

  // Committing already committed order throws
  assert.throws(() => commitReservedOrder(order.id), /cannot be committed/);
});

test('inventory: getDashboardSummary aggregates valuation, margins, and movement counts', () => {
  const summary = getDashboardSummary();
  assert.ok(summary);
  assert.equal(typeof summary.lowStockCount, 'number');
  assert.equal(typeof summary.dailySales, 'number');
  assert.equal(typeof summary.stockOnHand, 'number');
  assert.equal(typeof summary.availableStock, 'number');
  assert.equal(typeof summary.inventoryCostValue, 'number');
  assert.equal(typeof summary.inventoryRetailValue, 'number');
  assert.ok(summary.inventoryRetailValue >= summary.inventoryCostValue);
  assert.ok(summary.grossMarginPct > 0);
  assert.ok(Array.isArray(summary.topProducts));
});

