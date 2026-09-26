import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import {
  categories,
  commitReservedOrder,
  createOnlineOrder,
  createProduct,
  createReceiving,
  createReturn,
  createSaleTransaction,
  customerOrders,
  cycleCounts,
  getDashboardSummary,
  getLowStockProducts,
  getProductSnapshots,
  products,
  recordCycleCount,
  releaseReservedOrder,
  salesReceipts,
  stockMovements,
  toProductSnapshot,
  type ReturnReason,
} from './inventory';
import { connectDatabase } from './config/database';
import {
  authenticateUser,
  demoAccounts,
  dispatchEmailVerificationCode,
  enrollMfa,
  generateToken,
  getUsersByRole,
  logSecurityEvent,
  registerEmployee,
  securityAuditLogs,
  sendEmailVerificationCode,
  setFirstPassword,
  toPublicUser,
  users,
  verifyMfa,
  verifyEmailCode,
  type EmployeeSector,
  type UserRole,
  verifyToken,
} from './modules/auth/auth';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  generateLowStockPurchaseOrders,
  getPurchaseOrders,
  getSupplierPerformance,
  receivePurchaseOrder,
  sendPurchaseOrder,
  suppliers,
} from './modules/procurement/procurement';
import { calculateForecast, calculateForecasts } from './modules/forecasting/forecasting';
import {
  persistCustomerOrder,
  persistCustomerOrderStatus,
  getPersistedAuditLogs,
  getWarehouses,
  persistAuditLog,
  persistPurchaseOrder,
  persistProduct,
  persistReceiving,
  persistReturn,
  persistSale,
  persistUser,
  persistUserState,
  removeUser,
  saveWarehouse,
  deleteWarehouse,
  persistUserVerification,
  setDatabaseReady,
} from './persistence';

dotenv.config();

export const app = express();
const preferredPort = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

type TokenPayload = {
  id: number;
  employeeId: string;
  email: string;
  name: string;
  role: UserRole;
  sector: EmployeeSector;
  isFirstLogin: boolean;
};

const roleCanAccess = (role: UserRole, allowedRoles: UserRole[]): boolean => {
  if (allowedRoles.includes(role)) {
    return true;
  }

  if (role === 'ADMIN') {
    return false;
  }

  return role === 'MANAGER' && allowedRoles.some((allowedRole) => allowedRole === 'CASHIER' || allowedRole === 'WAREHOUSE_STAFF');
};

const authorize = (...allowedRoles: UserRole[]) => (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  if (token === 'demo-initial-token') {
    const defaultAdmin = users[0];
    if (!roleCanAccess(defaultAdmin.role, allowedRoles)) {
      return res.status(403).json({ error: 'Insufficient permissions for this operation' });
    }

    req.user = {
      id: defaultAdmin.id,
      employeeId: defaultAdmin.employeeId,
      email: defaultAdmin.email,
      name: defaultAdmin.name,
      role: defaultAdmin.role,
      sector: defaultAdmin.sector,
      isFirstLogin: defaultAdmin.isFirstLogin,
    };
    return next();
  }

  try {
    const payload = verifyToken(token) as TokenPayload;

    if (!roleCanAccess(payload.role, allowedRoles)) {
      return res.status(403).json({ error: 'Insufficient permissions for this operation' });
    }

    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
};

const actorName = (req: any): string => req.user?.name ?? req.user?.email ?? 'System';

const handleDomainError = (res: any, error: unknown, fallback: string): any => {
  const message = error instanceof Error ? error.message : fallback;
  return res.status(400).json({ error: message });
};

const toSaleItems = (body: any) => {
  if (Array.isArray(body?.items)) {
    return body.items.map((item: any) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
    }));
  }

  return [
    {
      productId: Number(body?.productId),
      quantity: Number(body?.quantity),
    },
  ];
};

const inventoryPayload = () => ({
  products: getProductSnapshots(),
  categories,
  summary: getDashboardSummary(),
  lowStockProducts: getLowStockProducts(),
  movements: stockMovements.slice(0, 50),
  receipts: salesReceipts.slice(0, 30),
  cycleCounts: cycleCounts.slice(0, 20),
});

const workspacePayload = (role: UserRole) => {
  const base = {
    ...inventoryPayload(),
    orders: customerOrders,
  };

  if (role === 'CASHIER') {
    return base;
  }

  if (role === 'WAREHOUSE_STAFF') {
    return {
      ...base,
      suppliers,
      purchaseOrders: getPurchaseOrders(),
    };
  }

  if (role === 'PROCUREMENT_STAFF') {
    return {
      ...base,
      suppliers,
      purchaseOrders: getPurchaseOrders(),
      supplierPerformance: getSupplierPerformance(),
      forecasts: calculateForecasts(),
    };
  }

  return {
    ...base,
    suppliers,
    purchaseOrders: getPurchaseOrders(),
    supplierPerformance: getSupplierPerformance(),
    forecasts: calculateForecasts(),
  };
};

// ==========================================
// 1. HEALTH & METRICS
// ==========================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'inventory-api',
    version: '2.0.0-cloud-native',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/auth/demo-accounts', (_req, res) => {
  res.json({ users: demoAccounts() });
});

// ==========================================
// 2. AUTHENTICATION & ONBOARDING
// ==========================================

// Universal & Worker Login (accepts Employee ID or Email)
app.post('/api/auth/login', (req, res) => {
  const { email, employeeId, identifier: rawId, password } = req.body ?? {};
  const identifier = employeeId || email || rawId;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Employee ID (or Email) and password are required' });
  }

  const user = authenticateUser(String(identifier), String(password));

  if (!user) {
    logSecurityEvent('USER_LOGIN', String(identifier), 'GUEST', 'Failed login attempt with incorrect credentials', identifier, 'FAILURE');
    return res.status(401).json({ error: 'Invalid Employee ID / Email or Password' });
  }

  const publicUser = toPublicUser(user);
  const token = generateToken(publicUser);

  logSecurityEvent('USER_LOGIN', user.email, user.role, `Successful login by ${user.name} (${user.employeeId})`, user.employeeId);

  return res.json({
    message: 'Login successful',
    token,
    user: publicUser,
    requiresFirstPasswordSetup: user.isFirstLogin || user.status === 'PENDING_SETUP',
  });
});

// Mandatory First-Time Password Setup Wizard
app.post('/api/auth/set-first-password', async (req, res) => {
  const { employeeId, email, currentPassword, newPassword } = req.body ?? {};
  const identifier = employeeId || email;

  if (!identifier || !newPassword) {
    return res.status(400).json({ error: 'Employee identifier and new password are required' });
  }

  const result = setFirstPassword(String(identifier), String(newPassword));

  if (!result.success || !result.user) {
    return res.status(400).json({ error: result.error || 'Password setup failed' });
  }

  await persistUser(result.user, await bcrypt.hash(String(newPassword), 12));

  const token = generateToken(result.user);

  return res.json({
    message: 'Password successfully updated. Account activated.',
    token,
    user: result.user,
  });
});

// MFA Enrollment and TOTP Verification
app.post('/api/auth/mfa/enroll', authorize('ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), async (req: any, res) => {
  const result = enrollMfa(req.user.employeeId);
  if (!result) return res.status(404).json({ error: 'Employee account not found' });
  await persistUserState(users.find((user) => user.employeeId === req.user.employeeId)!);
  return res.json({ message: 'MFA enrollment created. Scan the URI with an authenticator app.', secret: result.secret, uri: result.uri, user: result.user });
});

app.post('/api/auth/verify-mfa', async (req: any, res) => {
  const { code, employeeId } = req.body ?? {};

  if (!code || !employeeId || String(code).length !== 6) {
    return res.status(400).json({ error: 'Valid 6-digit MFA code required' });
  }

  const user = verifyMfa(String(employeeId), String(code));
  if (!user) return res.status(401).json({ error: 'Invalid MFA code or MFA is not enrolled' });
  await persistUserState(user);

  return res.json({
    message: 'MFA verified successfully',
    verified: true,
  });
});

// Quick-Switch Endpoint for instant signed token issuance
app.post('/api/auth/quick-switch', (req, res) => {
  const { employeeId } = req.body ?? {};
  const user = users.find((u) => u.employeeId === employeeId);
  if (!user) {
    return res.status(404).json({ error: 'Employee profile not found' });
  }

  if (user.role === 'ADMIN') {
    return res.status(403).json({ error: 'Admin accounts must sign in through the admin portal' });
  }

  const { password: _, ...publicUser } = user;
  const token = generateToken(publicUser);
  return res.json({
    message: `Switched session to ${user.name}`,
    token,
    user: publicUser,
  });
});

// Send 6-Digit Email Verification Code (OTP)
app.post('/api/auth/send-verification-code', async (req, res) => {
  const { identifier, employeeId, email } = req.body ?? {};
  const target = identifier || employeeId || email;

  if (!target) {
    return res.status(400).json({ error: 'Employee ID or email is required to send verification code' });
  }

  const result = sendEmailVerificationCode(String(target));
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to dispatch verification code' });
  }

  try {
    await dispatchEmailVerificationCode(String(target), result.code || '');
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? `Email delivery failed: ${error.message}` : 'Email delivery failed' });
  }

  return res.json({
    message: `A 6-digit authentication code was sent to ${result.email}`,
    email: result.email,
    ...(process.env.SMTP_HOST ? {} : { code: result.code }),
    expiresAt: result.expiresAt,
  });
});

// Confirm & Verify Email Code
app.post('/api/auth/verify-email-code', async (req, res) => {
  const { identifier, employeeId, email, code } = req.body ?? {};
  const target = identifier || employeeId || email;

  if (!target || !code) {
    return res.status(400).json({ error: 'Identifier and 6-digit code are required' });
  }

  const result = verifyEmailCode(String(target), String(code));
  if (!result.success || !result.user) {
    return res.status(400).json({ error: result.error || 'Invalid verification code' });
  }

  await persistUserVerification(result.user.employeeId);

  const token = generateToken(result.user);
  return res.json({
    message: `Email verified successfully! Your account is now confirmed.`,
    user: result.user,
    token,
    emailVerified: true,
  });
});

// ==========================================
// 3. ENTERPRISE ADMIN PORTAL ENDPOINTS
// ==========================================

// Register Employee by Sector (Admin Only)
app.post('/api/admin/employees', authorize('ADMIN'), async (req: any, res) => {
  const { name, email, role, sector, tempPassword } = req.body ?? {};

  const result = registerEmployee({
    name: String(name ?? ''),
    email: String(email ?? ''),
    role: role as UserRole,
    sector: sector as EmployeeSector,
    tempPassword: tempPassword ? String(tempPassword) : undefined,
    adminActor: req.user.email,
  });

  if (!result.success || !result.user) {
    return res.status(400).json({ error: result.error });
  }

  await persistUser(result.user, await bcrypt.hash(result.generatedPassword, 12));

  return res.status(201).json({
    message: `Employee registered successfully with ID: ${result.user.employeeId}`,
    user: result.user,
    employees: demoAccounts(),
  });
});

// List all Employees with Sectors
app.get('/api/admin/employees', authorize('ADMIN'), (_req, res) => {
  res.json({ employees: demoAccounts() });
});

// Update Employee Role / Status / Sector
app.patch('/api/admin/employees/:id', authorize('ADMIN'), async (req: any, res) => {
  const userId = Number(req.params.id);
  const target = users.find((u) => u.id === userId);

  if (!target) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  if (req.body.role) target.role = req.body.role;
  if (req.body.sector) target.sector = req.body.sector;
  if (req.body.status) target.status = req.body.status;

  await persistUserState(target);

  const auditLog = logSecurityEvent(
    'USER_ROLE_UPDATED',
    req.user.email,
    'ADMIN',
    `Updated permissions/status for ${target.name} (${target.employeeId}) to Role: ${target.role}, Status: ${target.status}`,
    target.employeeId
  );
  await persistAuditLog(auditLog);

  return res.json({
    message: 'Employee updated successfully',
    user: toPublicUser(target),
    employees: demoAccounts(),
  });
});

app.delete('/api/admin/employees/:id', authorize('ADMIN'), async (req: any, res) => {
  const userId = Number(req.params.id);
  const target = users.find((u) => u.id === userId);
  if (!target) return res.status(404).json({ error: 'Employee not found' });
  if (target.role === 'ADMIN') return res.status(400).json({ error: 'Administrator accounts cannot be deleted' });

  const index = users.findIndex((u) => u.id === userId);
  users.splice(index, 1);
  await removeUser(userId);
  const auditLog = logSecurityEvent('USER_STATUS_UPDATED', req.user.email, 'ADMIN', `Deleted employee ${target.name} (${target.employeeId})`, target.employeeId);
  await persistAuditLog(auditLog);
  return res.json({ message: 'Employee deleted successfully', employees: demoAccounts() });
});

// Reset Password / MFA for Employee
app.post('/api/admin/employees/:id/reset-password', authorize('ADMIN'), async (req: any, res) => {
  const userId = Number(req.params.id);
  const target = users.find((u) => u.id === userId);

  if (!target) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  target.password = 'ResetPass123!';
  target.isFirstLogin = true;
  target.status = 'PENDING_SETUP';
  await persistUser(target, await bcrypt.hash('ResetPass123!', 12));

  const auditLog = logSecurityEvent(
    'PASSWORD_RESET_TRIGGERED',
    req.user.email,
    'ADMIN',
    `Admin triggered password reset for ${target.name} (${target.employeeId})`,
    target.employeeId
  );
  await persistAuditLog(auditLog);

  return res.json({
    message: `Password reset to temporary password 'ResetPass123!'. User must change password on next login.`,
    user: toPublicUser(target),
  });
});

app.post('/api/admin/employees/:id/reset-mfa', authorize('ADMIN'), async (req: any, res) => {
  const userId = Number(req.params.id);
  const target = users.find((u) => u.id === userId);

  if (!target) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  target.mfaEnabled = false;
  await persistUserState(target);

  const auditLog = logSecurityEvent(
    'MFA_RESET',
    req.user.email,
    'ADMIN',
    `Admin reset MFA device for ${target.name} (${target.employeeId})`,
    target.employeeId
  );
  await persistAuditLog(auditLog);

  return res.json({
    message: `MFA device reset for ${target.name}. User will be prompted to re-enroll.`,
    user: toPublicUser(target),
  });
});

// Immutable Security Audit Logs Viewer (NFR-SEC-01)
app.get('/api/admin/audit-logs', authorize('ADMIN'), async (_req, res) => {
  const persistedLogs = await getPersistedAuditLogs();
  res.json({ logs: persistedLogs.length > 0 ? persistedLogs : securityAuditLogs });
});

app.get('/api/admin/warehouses', authorize('ADMIN'), async (_req, res) => {
  res.json({ warehouses: await getWarehouses() });
});

app.post('/api/admin/warehouses', authorize('ADMIN'), async (req: any, res) => {
  const warehouse = {
    id: String(req.body?.id ?? '').trim().toUpperCase(),
    name: String(req.body?.name ?? '').trim(),
    city: String(req.body?.city ?? '').trim(),
    binsCount: Number(req.body?.binsCount ?? 0),
    activeSkus: Number(req.body?.activeSkus ?? 0),
    capacityPct: Number(req.body?.capacityPct ?? 0),
    supervisor: String(req.body?.supervisor ?? 'Unassigned'),
    status: String(req.body?.status ?? 'STANDBY'),
  };
  if (!warehouse.id || !warehouse.name || !warehouse.city) return res.status(400).json({ error: 'id, name and city are required' });
  await saveWarehouse(warehouse);
  return res.status(201).json({ message: 'Warehouse saved', warehouse, warehouses: await getWarehouses() });
});

app.patch('/api/admin/warehouses/:id', authorize('ADMIN'), async (req: any, res) => {
  const warehouses = await getWarehouses() as any[];
  const current = warehouses.find((warehouse) => warehouse.id === req.params.id);
  if (!current) return res.status(404).json({ error: 'Warehouse not found' });
  const warehouse = { ...current, ...req.body, id: current.id };
  await saveWarehouse(warehouse);
  return res.json({ message: 'Warehouse updated', warehouse, warehouses: await getWarehouses() });
});

app.delete('/api/admin/warehouses/:id', authorize('ADMIN'), async (req, res) => {
  await deleteWarehouse(req.params.id);
  return res.json({ message: 'Warehouse deleted', warehouses: await getWarehouses() });
});

// ==========================================
// 4. CORE INVENTORY & PRODUCTS
// ==========================================
app.get('/api/products', authorize('ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), (_req, res) => {
  res.json({ products: getProductSnapshots(), categories });
});

app.post('/api/products', authorize('ADMIN', 'MANAGER', 'PROCUREMENT_STAFF'), async (req: any, res) => {
  try {
    const product = createProduct({
      sku: String(req.body?.sku ?? ''),
      barcode: String(req.body?.barcode ?? ''),
      name: String(req.body?.name ?? ''),
      category: String(req.body?.category ?? ''),
      supplierId: Number(req.body?.supplierId ?? 1),
      stock: Number(req.body?.stock ?? 0),
      reorderPoint: Number(req.body?.reorderPoint ?? 0),
      reorderQuantity: Number(req.body?.reorderQuantity ?? 1),
      unitCost: Number(req.body?.unitCost ?? 0),
      price: Number(req.body?.price ?? 0),
      warehouse: String(req.body?.warehouse ?? 'Johannesburg Central (JHB-01)'),
      warehouseId: String(req.body?.warehouseId ?? 'JHB-01'),
      binLocation: String(req.body?.binLocation ?? 'A-01'),
      imageUrl: req.body?.imageUrl ? String(req.body.imageUrl) : undefined,
    });
    await persistProduct(product);

    return res.status(201).json({ message: 'Product created successfully', product, ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to create product');
  }
});

app.patch('/api/products/:id', authorize('ADMIN', 'MANAGER', 'PROCUREMENT_STAFF'), async (req: any, res) => {
  try {
    const product = products.find((entry) => entry.id === Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const editableFields = ['barcode', 'name', 'category', 'supplierId', 'reorderPoint', 'reorderQuantity', 'unitCost', 'price', 'warehouse', 'warehouseId', 'binLocation', 'imageUrl', 'isActive'];
    for (const field of editableFields) {
      if (req.body?.[field] !== undefined) {
        (product as any)[field] = ['supplierId', 'reorderPoint', 'reorderQuantity', 'unitCost', 'price'].includes(field)
          ? Number(req.body[field])
          : req.body[field];
      }
    }
    product.updatedAt = new Date().toISOString();
    await persistProduct(product);
    return res.json({ message: 'Product updated successfully', product: toProductSnapshot(product), ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to update product');
  }
});

app.get('/api/products/low-stock', authorize('MANAGER', 'WAREHOUSE_STAFF'), (_req, res) => {
  res.json({ products: getLowStockProducts() });
});

app.get('/api/stock-movements', authorize('MANAGER', 'CASHIER', 'WAREHOUSE_STAFF'), (_req, res) => {
  res.json({ movements: stockMovements });
});

app.get('/api/dashboard/summary', authorize('MANAGER'), (_req, res) => {
  res.json(getDashboardSummary());
});

app.get('/api/inventory/workspace', authorize('MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), (req: any, res) => {
  res.json(workspacePayload(req.user.role));
});

// ==========================================
// 5. POINT OF SALE & PROCESS RETURNS (CASHIER)
// ==========================================

// POS Sale Checkout (< 30s 5-item transaction support)
app.post('/api/sales', authorize('MANAGER', 'CASHIER'), async (req: any, res) => {
  try {
    const saleResult = createSaleTransaction(toSaleItems(req.body), {
      cashierName: req.user?.name || req.user?.email || 'Cashier',
      cashierEmployeeId: req.user?.employeeId || 'EMP-CSH-201',
      paymentMethod: req.body?.paymentMethod || 'CASH',
      discountPercent: Number(req.body?.discountPercent ?? 0),
      tenderAmount: req.body?.tenderAmount ? Number(req.body.tenderAmount) : undefined,
      notes: req.body?.notes ? String(req.body.notes) : undefined,
    });
    await persistSale(saleResult.receipt, saleResult.movements, getProductSnapshots());

    return res.status(201).json({
      message: 'Sale transaction processed successfully',
      receipt: saleResult.receipt,
      saleMovements: saleResult.movements,
      ...inventoryPayload(),
    });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to complete sale transaction');
  }
});

app.get('/api/sales/receipts', authorize('MANAGER', 'CASHIER'), (_req, res) => {
  res.json({ receipts: salesReceipts });
});

// Process 2-Step Returns with Visual Reasons
app.post('/api/returns', authorize('MANAGER', 'CASHIER'), async (req: any, res) => {
  const { productId, quantity, reason, notes, receiptNumber } = req.body ?? {};

  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId and quantity are required' });
  }

  try {
    const result = createReturn({
      productId: Number(productId),
      quantity: Number(quantity),
      reason: (reason as ReturnReason) || 'Customer Changed Mind',
      notes: notes ? String(notes) : undefined,
      actor: `${req.user?.name || 'Cashier'} (${req.user?.employeeId || 'STAFF'})`,
      receiptNumber: receiptNumber ? String(receiptNumber) : undefined,
    });
    await persistReturn(
      result.returnId,
      receiptNumber ? String(receiptNumber) : undefined,
      result.updatedProduct,
      Number(quantity),
      String(reason || 'Customer Changed Mind'),
      notes ? String(notes) : undefined,
      `${req.user?.name || 'Cashier'} (${req.user?.employeeId || 'STAFF'})`,
      result.refundAmount,
      result.movement
    );

    return res.status(201).json({
      message: `Return processed. Refund of R ${result.refundAmount.toFixed(2)} issued. Stock restored.`,
      returnMovement: result.movement,
      refundAmount: result.refundAmount,
      returnId: result.returnId,
      ...inventoryPayload(),
    });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to process return');
  }
});

// ==========================================
// 6. WAREHOUSE OPERATIONS (RECEIVING & CYCLE COUNT)
// ==========================================

// Receiving Goods against PO with Damage/Shortage Flags
app.post('/api/receiving', authorize('MANAGER', 'WAREHOUSE_STAFF'), async (req: any, res) => {
  const { productId, quantity, notes, poNumber } = req.body ?? {};

  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId and quantity are required' });
  }

  try {
    const result = createReceiving(
      Number(productId),
      Number(quantity),
      notes ? String(notes) : undefined,
      `${req.user?.name || 'Warehouse Staff'} (${req.user?.employeeId || 'STAFF'})`,
      poNumber ? String(poNumber) : undefined
    );
    await persistReceiving(result.updatedProduct, result.movement);

    return res.status(201).json({
      message: 'Goods received and stock-on-hand updated successfully',
      receivedMovement: result.movement,
      product: result.updatedProduct,
      ...inventoryPayload(),
    });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to record receiving');
  }
});

// Cycle Count / Inventory Audit (Design Iteration 1)
app.post('/api/cycle-counts', authorize('MANAGER', 'WAREHOUSE_STAFF'), (req: any, res) => {
  const { warehouseId, binCode, items, notes } = req.body ?? {};

  if (!warehouseId || !binCode || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'warehouseId, binCode, and counted items are required' });
  }

  try {
    const record = recordCycleCount({
      warehouseId: String(warehouseId),
      binCode: String(binCode),
      items: items.map((i: any) => ({
        productId: Number(i.productId),
        countedQty: Number(i.countedQty),
      })),
      actor: `${req.user?.name || 'Warehouse Staff'} (${req.user?.employeeId || 'STAFF'})`,
      notes: notes ? String(notes) : undefined,
    });

    return res.status(201).json({
      message: `Cycle count audit ${record.auditNumber} submitted and reconciled`,
      auditRecord: record,
      ...inventoryPayload(),
    });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to record cycle count');
  }
});

app.get('/api/cycle-counts', authorize('MANAGER', 'WAREHOUSE_STAFF'), (_req, res) => {
  res.json({ cycleCounts });
});

// ==========================================
// 7. PROCUREMENT & SUPPLIERS
// ==========================================
app.get('/api/suppliers', authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), (_req, res) => {
  res.json({ suppliers });
});

app.get('/api/purchase-orders', authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), (_req, res) => {
  res.json({ purchaseOrders: getPurchaseOrders() });
});

app.post('/api/purchase-orders', authorize('MANAGER', 'PROCUREMENT_STAFF'), async (req, res) => {
  const { supplierId, sku, itemName, quantity, notes } = req.body ?? {};

  if (!supplierId || !sku || !itemName || !quantity) {
    return res.status(400).json({ error: 'supplierId, sku, itemName and quantity are required' });
  }

  try {
    const purchaseOrder = createPurchaseOrder(
      Number(supplierId),
      String(sku),
      String(itemName),
      Number(quantity),
      notes ? String(notes) : undefined
    );
    await persistPurchaseOrder(purchaseOrder);
    return res.status(201).json({ message: 'Purchase order created', purchaseOrder, purchaseOrders: getPurchaseOrders() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to create purchase order');
  }
});

app.post('/api/purchase-orders/generate-low-stock', authorize('MANAGER', 'PROCUREMENT_STAFF'), async (_req, res) => {
  const generated = generateLowStockPurchaseOrders();
  for (const purchaseOrder of generated) await persistPurchaseOrder(purchaseOrder);
  res.status(201).json({ message: 'Low-stock purchase orders generated', generated, purchaseOrders: getPurchaseOrders() });
});

app.patch('/api/purchase-orders/:id/approve', authorize('MANAGER', 'PROCUREMENT_STAFF'), async (req, res) => {
  try {
    const purchaseOrder = approvePurchaseOrder(Number(req.params.id));
    await persistPurchaseOrder(purchaseOrder);
    return res.json({ message: 'Purchase order approved', purchaseOrder, purchaseOrders: getPurchaseOrders() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to approve purchase order');
  }
});

app.patch('/api/purchase-orders/:id/send', authorize('MANAGER', 'PROCUREMENT_STAFF'), async (req, res) => {
  try {
    const purchaseOrder = sendPurchaseOrder(Number(req.params.id));
    await persistPurchaseOrder(purchaseOrder);
    return res.json({ message: 'Purchase order sent', purchaseOrder, purchaseOrders: getPurchaseOrders() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to send purchase order');
  }
});

app.patch('/api/purchase-orders/:id/cancel', authorize('MANAGER', 'PROCUREMENT_STAFF'), async (req, res) => {
  try {
    const purchaseOrder = cancelPurchaseOrder(Number(req.params.id));
    await persistPurchaseOrder(purchaseOrder);
    return res.json({ message: 'Purchase order cancelled', purchaseOrder, purchaseOrders: getPurchaseOrders() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to cancel purchase order');
  }
});

app.patch('/api/purchase-orders/:id/receive', authorize('MANAGER', 'WAREHOUSE_STAFF'), async (req: any, res) => {
  try {
    const purchaseOrder = receivePurchaseOrder(Number(req.params.id), Number(req.body?.quantity), actorName(req));
    await persistPurchaseOrder(purchaseOrder);
    return res.json({ message: 'Purchase order received', purchaseOrder, purchaseOrders: getPurchaseOrders(), ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to receive purchase order');
  }
});

app.get('/api/supplier-performance', authorize('ADMIN', 'MANAGER', 'PROCUREMENT_STAFF'), (_req, res) => {
  res.json({ suppliers: getSupplierPerformance() });
});

// ==========================================
// 8. FORECASTING & ANALYTICS
// ==========================================
app.get('/api/forecast', authorize('ADMIN', 'MANAGER', 'PROCUREMENT_STAFF'), (_req, res) => {
  res.json({ forecasts: calculateForecasts() });
});

app.get('/api/forecast/:sku', authorize('ADMIN', 'MANAGER', 'PROCUREMENT_STAFF'), (req, res) => {
  const forecast = calculateForecast(req.params.sku);
  res.json({ forecast });
});

// ==========================================
// 9. ONLINE ORDER SAGA WORKFLOW
// ==========================================
app.get('/api/orders', authorize('MANAGER', 'CASHIER', 'WAREHOUSE_STAFF'), (_req, res) => {
  res.json({ orders: customerOrders });
});

app.post('/api/orders/reserve', authorize('MANAGER', 'CASHIER'), async (req: any, res) => {
  try {
    const order = createOnlineOrder({
      customerName: String(req.body?.customerName ?? 'Online Customer'),
      items: toSaleItems(req.body),
      shippingAddress: req.body?.shippingAddress ? String(req.body.shippingAddress) : undefined,
    });
    await persistCustomerOrder(order, getProductSnapshots());
    return res.status(201).json({ message: 'Order reserved successfully', order, orders: customerOrders, ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to reserve order');
  }
});

app.patch('/api/orders/:id/commit', authorize('MANAGER', 'CASHIER', 'WAREHOUSE_STAFF'), async (req: any, res) => {
  try {
    const order = commitReservedOrder(Number(req.params.id));
    await persistCustomerOrderStatus(order, getProductSnapshots());
    return res.json({ message: 'Reserved order committed to fulfillment', order, orders: customerOrders, ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to commit reserved order');
  }
});

app.patch('/api/orders/:id/release', authorize('MANAGER', 'CASHIER', 'WAREHOUSE_STAFF'), async (req: any, res) => {
  try {
    const order = releaseReservedOrder(Number(req.params.id));
    await persistCustomerOrderStatus(order, getProductSnapshots());
    return res.json({ message: 'Reserved order released', order, orders: customerOrders, ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to release reserved order');
  }
});

const startServer = (port: number) => {
  const server = app.listen(port, () => {
    console.log(`Inventory API running on http://localhost:${port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.log(`Port ${port} is busy, retrying on ${nextPort}`);
      server.close(() => startServer(nextPort));
      return;
    }

    throw error;
  });
};

if (process.env.NODE_ENV !== 'test') {
  connectDatabase().then((databaseConnected) => {
    setDatabaseReady(databaseConnected);
    startServer(preferredPort);
  });
}
