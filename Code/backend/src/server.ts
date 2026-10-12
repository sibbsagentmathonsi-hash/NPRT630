import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

import {
  categories,
  calculateSaleTotal,
  commitReservedOrder,
  createStockAdjustment,
  createOnlineOrder,
  createProduct,
  createReceiving,
  createReturn,
  createSaleTransaction,
  customerOrders,
  cycleCounts,
  getDashboardSummary,
  getInventoryItems,
  getLowStockProducts,
  getProductSnapshots,
  findProductBySku,
  findProductById,
  recordCycleCount,
  releaseReservedOrder,
  salesReceipts,
  stockMovements,
  toProductSnapshot,
  type ReturnReason,
} from './inventory';
import { connectDatabase } from './config/database';
import { CompanyModel } from './models/DomainModels';
import {
  authenticateUser,
  clearEmailVerificationCode,
  demoAccounts,
  dispatchEmailVerificationCode,
  enrollMfa,
  generateToken,
  getUsersByRole,
  isEmailDeliveryConfigured,
  logSecurityEvent,
  registerEmployee,
  setSecurityAuditWriter,
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
  permissionsForRole,
} from './modules/auth/auth';
import { requireTurnstile } from './modules/auth/botProtection';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  generateLowStockPurchaseOrders,
  getPurchaseOrders,
  getActiveSupplierById,
  getSupplierById,
  getSupplierPerformance,
  addSupplier,
  removeSupplier,
  setSupplierArchived,
  addSupplierReview,
  SupplierError,
  receivePurchaseOrder,
  sendPurchaseOrder,
  SupplierReviewError,
  validateNewSupplier,
  validateSupplierReview,
} from './modules/procurement/procurement';
import { calculateForecast, calculateForecasts } from './modules/forecasting/forecasting';
import { loadEnvironment } from './config/environment';
import { getCurrentPolicy, isPolicyEnforced, setCurrentPolicy, updateSystemPolicy } from './config/policies';
import { belongsToCompany, companies, createCompany, currentCompanyId, getCompany, runInCompany } from './config/tenancy';
import { authorizeElectronicPayment, refundElectronicPayment, voidElectronicPayment, type ElectronicPaymentMethod } from './modules/integrations/contracts';
import { getRequestMetrics, requestMetricsMiddleware } from './observability';
import {
  clearSessionCookie,
  createCsrfToken,
  CSRF_HEADER_NAME,
  isValidCsrfToken,
  loginRateLimiter,
  readCookie,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verificationRateLimiter,
} from './security';
import {
  persistCustomerOrder,
  persistCustomerOrderStatus,
  getPersistedAuditLogs,
  getWarehouses,
  persistAuditLog,
  persistCycleCount,
  persistPurchaseOrder,
  persistProduct,
  persistReceiving,
  persistStockAdjustment,
  persistReturn,
  persistSale,
  persistSupplier,
  persistSupplierArchivedStatus,
  deletePersistedSupplier,
  persistSupplierReview,
  persistUser,
  persistUserState,
  persistMfaState,
  removeUser,
  saveWarehouse,
  deleteWarehouse,
  persistUserVerification,
  isDatabaseReady,
  setDatabaseReady,
  persistCompanyPolicy,
  persistCompanyProfile,
  persistCompanyStatus,
} from './persistence';

loadEnvironment();

export const app = express();
const preferredPort = Number(process.env.PORT ?? 4000);
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}
app.set('trust proxy', trustedProxyHops);

const configuredCorsOrigins = process.env.CORS_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = configuredCorsOrigins
  ?? (process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5175', 'http://127.0.0.1:5175', 'http://localhost:5176', 'http://127.0.0.1:5176']);

app.use(cors({
  origin: (origin, callback) => {
    callback(null, !origin || allowedCorsOrigins.includes(origin));
  },
  credentials: true,
}));
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !allowedCorsOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  return next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true }
    : false,
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'production'
    && process.env.ENFORCE_HTTPS !== 'false'
    && req.method !== 'OPTIONS'
    && !req.secure
  ) {
    return res.status(426).json({ error: 'HTTPS is required.' });
  }
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  return next();
});
app.use(express.json({ limit: '1mb' }));
app.use(requestMetricsMiddleware);
app.use((req: any, _res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : readCookie(req, SESSION_COOKIE_NAME);
  if (!token) return next();
  try {
    const payload = verifyToken(token) as TokenPayload;
    return runInCompany(payload.companyId, next);
  } catch {
    return next();
  }
});

type TokenPayload = {
  id: number;
  companyId: string;
  isPlatformAdmin: boolean;
  permissions: string[];
  employeeId: string;
  email: string;
  name: string;
  role: UserRole;
  sector: EmployeeSector;
  isFirstLogin: boolean;
  csrfToken?: string;
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
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = readCookie(req, SESSION_COOKIE_NAME);
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const payload = verifyToken(token) as TokenPayload;

    if (!bearerToken && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS'
      && !isValidCsrfToken(payload.csrfToken, req.headers[CSRF_HEADER_NAME])) {
      return res.status(403).json({ error: 'A valid CSRF token is required for this request.' });
    }
    if (!payload.companyId || !getCompany(payload.companyId) || getCompany(payload.companyId)?.subscriptionStatus !== 'ACTIVE') {
      return res.status(403).json({ error: 'Company access is inactive or unavailable' });
    }
    payload.permissions = payload.permissions?.length ? payload.permissions : permissionsForRole(payload.role);

    if (!roleCanAccess(payload.role, allowedRoles)) {
      return res.status(403).json({ error: 'Insufficient permissions for this operation' });
    }

    if (
      payload.role === 'ADMIN'
      && isPolicyEnforced('mfa-enrollment', payload.companyId)
      && !users.some((user) => user.id === payload.id && user.companyId === payload.companyId && user.mfaEnabled)
      && req.path !== '/api/auth/mfa/enroll'
      && req.path !== '/api/auth/verify-mfa'
      && req.path !== '/api/auth/session'
      && req.path !== '/api/auth/logout'
      && !(req.method === 'GET' && req.path === '/api/admin/policies')
    ) {
      return res.status(403).json({ error: 'MFA enrollment is required by the active company policy', code: 'MFA_ENROLLMENT_REQUIRED' });
    }

    req.user = payload;
    req.companyId = payload.companyId;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
};

const actorName = (req: any): string => req.user?.name ?? req.user?.email ?? 'System';

const authorizePlatformAdmin = (req: any, res: any, next: any) => authorize('ADMIN')(req, res, () => {
  const account = users.find((user) => user.id === req.user.id && user.companyId === req.user.companyId);
  if (!account?.isPlatformAdmin) return res.status(403).json({ error: 'Platform administrator access is required' });
  req.user.isPlatformAdmin = true;
  return next();
});

const issueSessionCookie = (res: any, user: ReturnType<typeof toPublicUser>): string => {
  const csrfToken = createCsrfToken();
  const token = generateToken(user, csrfToken);
  const maxAgeSeconds = getCurrentPolicy(user.companyId).sessionDurationHours * 60 * 60;
  setSessionCookie(res, token, maxAgeSeconds);
  return csrfToken;
};

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
  vatRate: getCurrentPolicy().vatRate,
  policyControls: getCurrentPolicy().controls,
  companySettings: (() => {
    const company = getCompany(currentCompanyId());
    return { currency: company?.currency ?? 'ZAR', timezone: company?.timezone ?? 'Africa/Johannesburg' };
  })(),
  summary: getDashboardSummary(),
  lowStockProducts: getLowStockProducts(),
  movements: stockMovements.filter((movement) => belongsToCompany(movement.companyId)).slice(0, 50),
  receipts: salesReceipts.filter((receipt) => belongsToCompany(receipt.companyId)).slice(0, 30),
  cycleCounts: cycleCounts.filter((count) => belongsToCompany(count.companyId)).slice(0, 20),
});

const workspacePayload = async (role: UserRole) => {
  const base = {
    ...inventoryPayload(),
    orders: customerOrders.filter((order) => belongsToCompany(order.companyId)),
    warehouses: await getWarehouses(),
  };

  if (role === 'CASHIER') {
    return base;
  }

  if (role === 'WAREHOUSE_STAFF') {
    return {
      ...base,
      suppliers: getSupplierPerformance(),
      purchaseOrders: getPurchaseOrders(),
    };
  }

  if (role === 'PROCUREMENT_STAFF') {
    return {
      ...base,
      suppliers: getSupplierPerformance(),
      purchaseOrders: getPurchaseOrders(),
      supplierPerformance: getSupplierPerformance(),
      forecasts: calculateForecasts(),
    };
  }

  return {
    ...base,
    suppliers: getSupplierPerformance(),
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
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/ready', (_req, res) => {
  const databaseConnected = isDatabaseReady();
  const ready = databaseConnected || process.env.NODE_ENV !== 'production';
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not-ready',
    storage: databaseConnected ? 'postgres' : 'in-memory',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/admin/metrics', authorize('ADMIN'), (_req, res) => {
  res.json({ uptimeSeconds: Math.floor(process.uptime()), routes: getRequestMetrics() });
});

app.get('/api/auth/demo-accounts', (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.sendStatus(404);
  }
  res.json({ users: demoAccounts() });
});

// ==========================================
// 2. AUTHENTICATION & ONBOARDING
// ==========================================

// Email-first access check. Only a safe public account summary is returned.
app.post('/api/auth/lookup-email', loginRateLimiter, requireTurnstile('auth'), (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const requestedCompanyId = req.body?.companyId ? String(req.body.companyId) : undefined;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const matches = users.filter((entry) => (
    (entry.email.toLowerCase() === email
      || (configuredAdminEmail === email && entry.employeeId === 'ADM-001' && entry.role === 'ADMIN'))
    && (!requestedCompanyId || entry.companyId === requestedCompanyId)
  ));
  if (matches.length === 0) {
    return res.status(404).json({ error: 'No SyncStock account was found for that email address' });
  }
  if (matches.length > 1) return res.status(409).json({ error: 'This email belongs to multiple companies. Select a company before continuing.', companies: matches.map((entry) => getCompany(entry.companyId)).filter(Boolean) });
  const user = matches[0];

  return res.json({ user: toPublicUser(user) });
});

app.get('/api/auth/policy', (req, res) => {
  const companyId = req.query.companyId ? String(req.query.companyId) : undefined;
  res.json({ password: getCurrentPolicy(companyId).password, sessionDurationHours: getCurrentPolicy(companyId).sessionDurationHours });
});

// Universal & Worker Login (accepts Employee ID or Email)
app.post('/api/auth/login', loginRateLimiter, requireTurnstile('auth'), (req, res) => {
  const { email, employeeId, identifier: rawId, password, companyId } = req.body ?? {};
  const identifier = employeeId || email || rawId;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Employee ID (or Email) and password are required' });
  }

  const user = authenticateUser(String(identifier), String(password), companyId ? String(companyId) : undefined);

  if (!user) {
    logSecurityEvent('USER_LOGIN', String(identifier), 'GUEST', 'Failed login attempt with incorrect credentials', identifier, 'FAILURE');
    return res.status(401).json({ error: 'Invalid Employee ID / Email or Password' });
  }
  if (getCompany(user.companyId)?.subscriptionStatus !== 'ACTIVE') {
    return res.status(403).json({ error: 'This company workspace is inactive. Contact your platform administrator.' });
  }

  const publicUser = toPublicUser(user);
  const csrfToken = issueSessionCookie(res, publicUser);

  logSecurityEvent('USER_LOGIN', user.email, user.role, `Successful login by ${user.name} (${user.employeeId})`, user.employeeId);

  return res.json({
    message: 'Login successful',
    user: publicUser,
    csrfToken,
    requiresFirstPasswordSetup: user.isFirstLogin || user.status === 'PENDING_SETUP',
  });
});

app.get('/api/auth/session', authorize('ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), (req: any, res) => {
  const user = users.find((entry) => entry.id === req.user.id && entry.companyId === req.user.companyId);
  if (!user) return res.status(401).json({ error: 'Session account is no longer available.' });
  return res.json({ user: toPublicUser(user), csrfToken: req.user.csrfToken });
});

app.post('/api/auth/logout', authorize('ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), (req: any, res) => {
  clearSessionCookie(res);
  logSecurityEvent('USER_LOGIN', req.user.email, req.user.role, 'User signed out', req.user.employeeId);
  return res.json({ message: 'Signed out successfully.' });
});

// Mandatory First-Time Password Setup Wizard
app.post('/api/auth/set-first-password', authorize('ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), async (req: any, res) => {
  const { employeeId, email, newPassword } = req.body ?? {};
  const identifier = email || employeeId;

  if (!identifier || !newPassword) {
    return res.status(400).json({ error: 'Employee identifier and new password are required' });
  }
  if (
    !req.user.isFirstLogin
    || (
      String(identifier).trim().toUpperCase() !== String(req.user.employeeId).toUpperCase()
      && String(identifier).trim().toLowerCase() !== String(req.user.email).toLowerCase()
    )
  ) {
    return res.status(403).json({ error: 'A valid first-login session for this employee is required' });
  }

  const result = setFirstPassword(String(identifier), String(newPassword), req.user.companyId);

  const firstPasswordUser = result.user;
  if (!result.success || !firstPasswordUser) {
    return res.status(400).json({ error: result.error || 'Password setup failed' });
  }

  const account = users.find((user) => user.id === firstPasswordUser.id && user.companyId === req.user.companyId);
  if (!account) return res.status(500).json({ error: 'Password setup could not be saved. Please try again.' });
  await persistUser(account, await bcrypt.hash(String(newPassword), 12));

  const csrfToken = issueSessionCookie(res, firstPasswordUser);

  return res.json({
    message: 'Password successfully updated. Account activated.',
    user: firstPasswordUser,
    csrfToken,
  });
});

// MFA Enrollment and TOTP Verification
app.post('/api/auth/mfa/enroll', authorize('ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), async (req: any, res) => {
  const account = users.find((user) => user.id === req.user.id && user.companyId === req.user.companyId);
  if (!account) return res.status(404).json({ error: 'Employee account not found' });
  const previousMfaState = { mfaEnabled: account.mfaEnabled, mfaSecret: account.mfaSecret };
  const result = enrollMfa(req.user.email, req.user.companyId);
  if (!result) return res.status(404).json({ error: 'Employee account not found' });
  try {
    await persistMfaState(account);
  } catch (error) {
    account.mfaEnabled = previousMfaState.mfaEnabled;
    account.mfaSecret = previousMfaState.mfaSecret;
    console.error('Failed to persist MFA enrollment', error);
    return res.status(isDatabaseReady() ? 500 : 503).json({ error: 'MFA enrollment could not be saved to PostgreSQL. Please try again.' });
  }
  return res.json({ message: 'MFA enrollment created. Scan the URI with an authenticator app.', secret: result.secret, uri: result.uri, user: result.user });
});

app.post('/api/auth/verify-mfa', verificationRateLimiter, authorize('ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), async (req: any, res) => {
  const { code, employeeId, email } = req.body ?? {};
  const identifier = email || employeeId;

  if (!code || !identifier || String(code).length !== 6) {
    return res.status(400).json({ error: 'Valid 6-digit MFA code required' });
  }
  if (
    String(identifier).trim().toUpperCase() !== String(req.user.employeeId).toUpperCase()
    && String(identifier).trim().toLowerCase() !== String(req.user.email).toLowerCase()
  ) {
    return res.status(403).json({ error: 'You can only verify MFA for your own account' });
  }

  const accountBeforeVerification = users.find((entry) => entry.id === req.user.id && entry.companyId === req.user.companyId);
  const previousMfaEnabled = accountBeforeVerification?.mfaEnabled ?? false;
  const user = verifyMfa(req.user.email, String(code), req.user.companyId);
  if (!user) return res.status(401).json({ error: 'Invalid MFA code or MFA is not enrolled' });
  try {
    await persistMfaState(user);
  } catch (error) {
    user.mfaEnabled = previousMfaEnabled;
    console.error('Failed to persist MFA verification', error);
    return res.status(isDatabaseReady() ? 500 : 503).json({ error: 'MFA verification could not be saved to PostgreSQL. Please try again.' });
  }

  return res.json({
    message: 'MFA verified successfully',
    verified: true,
    user: toPublicUser(user),
  });
});

// Quick-Switch Endpoint for instant signed token issuance
app.post('/api/auth/quick-switch', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.sendStatus(404);
  }
  const { employeeId, email, companyId } = req.body ?? {};
  const identifier = String(email || employeeId || '').trim().toLowerCase();
  const matches = users.filter((user) => (
    (!companyId || user.companyId === String(companyId))
    && (email ? user.email.toLowerCase() === identifier : user.employeeId.toLowerCase() === identifier)
  ));
  if (matches.length > 1) {
    return res.status(409).json({ error: 'This employee ID belongs to multiple accounts. Switch using the account email and company.' });
  }
  const user = matches[0];
  if (!user) {
    return res.status(404).json({ error: 'Employee profile not found' });
  }

  if (user.role === 'ADMIN') {
    return res.status(403).json({ error: 'Admin accounts must sign in through the admin portal' });
  }

  const { password: _, ...publicUser } = user;
  const csrfToken = issueSessionCookie(res, publicUser);
  return res.json({
    message: `Switched session to ${user.name}`,
    user: publicUser,
    csrfToken,
  });
});

// Send 6-Digit Email Verification Code (OTP)
app.post('/api/auth/send-verification-code', verificationRateLimiter, requireTurnstile('auth'), async (req, res) => {
  const { identifier, employeeId, email, companyId } = req.body ?? {};
  const target = identifier || employeeId || email;

  if (!target) {
    return res.status(400).json({ error: 'Employee ID or email is required to send verification code' });
  }

  if (!isEmailDeliveryConfigured()) {
    return res.status(503).json({ error: 'Email delivery is not configured. Contact your administrator.' });
  }

  const requestedCompanyId = companyId ? String(companyId) : undefined;
  const result = sendEmailVerificationCode(String(target), requestedCompanyId);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to dispatch verification code' });
  }

  try {
    await dispatchEmailVerificationCode(String(target), result.code || '', requestedCompanyId);
  } catch (error) {
    clearEmailVerificationCode(String(target), requestedCompanyId);
    return res.status(502).json({ error: error instanceof Error ? `Email delivery failed: ${error.message}` : 'Email delivery failed' });
  }

  return res.json({
    message: `A 6-digit authentication code was sent to ${result.email}`,
    email: result.email,
    expiresAt: result.expiresAt,
  });
});

// Confirm & Verify Email Code
app.post('/api/auth/verify-email-code', verificationRateLimiter, requireTurnstile('auth'), async (req, res) => {
  const { identifier, employeeId, email, code, companyId } = req.body ?? {};
  const target = identifier || employeeId || email;

  if (!target || !code) {
    return res.status(400).json({ error: 'Identifier and 6-digit code are required' });
  }

  const result = verifyEmailCode(String(target), String(code), companyId ? String(companyId) : undefined);
  if (!result.success || !result.user) {
    return res.status(400).json({ error: result.error || 'Invalid verification code' });
  }

  await persistUserVerification(result.user.id, result.user.companyId);

  const csrfToken = issueSessionCookie(res, result.user);
  return res.json({
    message: `Email verified successfully! Your account is now confirmed.`,
    user: result.user,
    csrfToken,
    emailVerified: true,
  });
});

// ==========================================
// 3. ENTERPRISE ADMIN PORTAL ENDPOINTS
// ==========================================

// Register Employee by Sector (Admin Only)
app.post('/api/admin/employees', authorize('ADMIN'), async (req: any, res) => {
  const { name, email, role, sector, tempPassword } = req.body ?? {};

  let result: ReturnType<typeof registerEmployee>;
  try {
    result = registerEmployee({
      name: String(name ?? ''),
      email: String(email ?? ''),
      role: role as UserRole,
      sector: sector as EmployeeSector,
      tempPassword: tempPassword ? String(tempPassword) : undefined,
      adminActor: req.user.email,
      companyId: req.user.companyId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register employee';
    const status = message.startsWith('An employee with email ') ? 409 : 400;
    return res.status(status).json({ error: message });
  }

  if (!result.success || !result.user) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const account = users.find((user) => user.id === result.user.id && user.companyId === req.user.companyId);
    if (!account) throw new Error('New employee account was not available for persistence.');
    await persistUser(account, await bcrypt.hash(result.generatedPassword, 12));
  } catch (error) {
    const userIndex = users.findIndex((user) => user.id === result.user.id);
    if (userIndex >= 0) users.splice(userIndex, 1);
    console.error('Failed to persist newly registered employee', error);
    return res.status(500).json({ error: 'Employee registration could not be saved. Please try again.' });
  }

  return res.status(201).json({
    message: `Employee registered successfully with ID: ${result.user.employeeId}`,
    user: result.user,
    employees: demoAccounts().filter((employee) => employee.companyId === req.user.companyId),
  });
});

// List all Employees with Sectors
app.get('/api/admin/employees', authorize('ADMIN'), (req: any, res) => {
  res.json({ employees: demoAccounts().filter((employee) => employee.companyId === req.user.companyId) });
});

app.get('/api/admin/company', authorize('ADMIN'), (req: any, res) => {
  const company = getCompany(req.user.companyId);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  return res.json({ company });
});

app.get('/api/admin/platform-status', authorize('ADMIN'), (req: any, res) => {
  const account = users.find((user) => user.id === req.user.id && user.companyId === req.user.companyId);
  return res.json({ isPlatformAdmin: Boolean(account?.isPlatformAdmin) });
});

app.get('/api/platform/companies', authorizePlatformAdmin, (_req, res) => {
  return res.json({ companies });
});

app.patch('/api/admin/company', authorize('ADMIN'), async (req: any, res) => {
  const company = getCompany(req.user.companyId);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const updates: Record<string, string> = {};
  const fields = ['legalName', 'tradingName', 'registrationNumber', 'taxNumber', 'currency', 'timezone'] as const;
  for (const key of fields) {
    if (req.body?.[key] === undefined) continue;
    if (typeof req.body[key] !== 'string') return res.status(400).json({ error: `${key} must be a string` });
    const value = req.body[key].trim();
    if ((key === 'legalName' || key === 'tradingName' || key === 'currency' || key === 'timezone') && !value) {
      return res.status(400).json({ error: `${key} cannot be empty` });
    }
    if (key === 'legalName' && value.length > 200) return res.status(400).json({ error: 'legalName cannot exceed 200 characters' });
    if (key === 'tradingName' && value.length > 150) return res.status(400).json({ error: 'tradingName cannot exceed 150 characters' });
    if ((key === 'registrationNumber' || key === 'taxNumber') && value.length > 100) {
      return res.status(400).json({ error: `${key} cannot exceed 100 characters` });
    }
    if (key === 'currency') {
      const code = value.toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return res.status(400).json({ error: 'currency must be a three-letter currency code' });
      try {
        new Intl.NumberFormat('en-ZA', { style: 'currency', currency: code });
      } catch {
        return res.status(400).json({ error: 'currency must be a supported ISO 4217 currency code' });
      }
      updates[key] = code;
      continue;
    }
    if (key === 'timezone') {
      if (value.length > 80) return res.status(400).json({ error: 'timezone cannot exceed 80 characters' });
      try {
        new Intl.DateTimeFormat('en-ZA', { timeZone: value });
      } catch {
        return res.status(400).json({ error: 'timezone must be a valid IANA timezone' });
      }
    }
    updates[key] = value;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'At least one company detail must be provided' });
  try {
    await persistCompanyProfile(req.user.companyId, updates);
  } catch (error) {
    console.error('Failed to persist company profile', error);
    return res.status(isDatabaseReady() ? 500 : 503).json({ error: 'Company profile could not be saved to PostgreSQL. Please try again.' });
  }
  Object.assign(company, updates);
  return res.json({ message: 'Company profile updated', company });
});

app.post('/api/platform/companies', authorizePlatformAdmin, async (req: any, res) => {
  const legalName = String(req.body?.legalName ?? '').trim();
  const tradingName = String(req.body?.tradingName ?? '').trim();
  if (!legalName || !tradingName) return res.status(400).json({ error: 'legalName and tradingName are required' });
  const company = createCompany({
    legalName,
    tradingName,
    registrationNumber: req.body?.registrationNumber ? String(req.body.registrationNumber) : undefined,
    taxNumber: req.body?.taxNumber ? String(req.body.taxNumber) : undefined,
    currency: String(req.body?.currency ?? 'ZAR'),
    timezone: String(req.body?.timezone ?? 'Africa/Johannesburg'),
  });
  if (isDatabaseReady()) await CompanyModel.create(company as any);
  return res.status(201).json({ message: 'Company created', company, companies });
});

app.patch('/api/platform/companies/:companyId', authorizePlatformAdmin, async (req: any, res) => {
  const company = getCompany(req.params.companyId);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const updates: Partial<typeof company> = {};
  for (const key of ['legalName', 'tradingName', 'registrationNumber', 'taxNumber', 'currency', 'timezone'] as const) {
    if (req.body?.[key] === undefined) continue;
    if (typeof req.body[key] !== 'string') return res.status(400).json({ error: `${key} must be a string` });
    const value = req.body[key].trim();
    if ((key === 'legalName' || key === 'tradingName' || key === 'currency' || key === 'timezone') && !value) {
      return res.status(400).json({ error: `${key} cannot be empty` });
    }
    if (key === 'currency' && !/^[A-Za-z]{3}$/.test(value)) {
      return res.status(400).json({ error: 'currency must be a three-letter code' });
    }
    updates[key] = key === 'currency' ? value.toUpperCase() : value;
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'At least one company detail must be provided' });
  if (isDatabaseReady()) await CompanyModel.update(updates, { where: { id: company.id } });
  Object.assign(company, updates);
  return res.json({ message: 'Company details updated', company, companies });
});

app.patch('/api/platform/companies/:companyId/status', authorizePlatformAdmin, async (req: any, res) => {
  const company = getCompany(req.params.companyId);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const status: unknown = req.body?.subscriptionStatus;
  if (status !== 'ACTIVE' && status !== 'SUSPENDED' && status !== 'ARCHIVED') {
    return res.status(400).json({ error: 'subscriptionStatus must be ACTIVE, SUSPENDED, or ARCHIVED' });
  }
  if (status === company.subscriptionStatus) {
    return res.status(400).json({ error: `Company is already ${status.toLowerCase()}` });
  }
  if (status === 'ARCHIVED' && (company.id === 'company-default' || company.id === req.user.companyId)) {
    return res.status(400).json({ error: 'You cannot archive the default company or your own platform administrator workspace' });
  }

  try {
    await persistCompanyStatus(company.id, status);
  } catch (error) {
    console.error('Failed to persist company status', error);
    return res.status(isDatabaseReady() ? 500 : 503).json({ error: 'Company status could not be saved to PostgreSQL. Please try again.' });
  }

  company.subscriptionStatus = status;
  logSecurityEvent('USER_ROLE_UPDATED', req.user.email, 'ADMIN', `Company ${company.tradingName} status changed to ${status}`, company.id);
  return res.json({ message: `Company status changed to ${status.toLowerCase()}`, company, companies });
});

app.post('/api/platform/companies/:companyId/admin', authorizePlatformAdmin, async (req: any, res) => {
  const company = getCompany(req.params.companyId);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  const result = registerEmployee({
    name: String(req.body?.name ?? ''),
    email: String(req.body?.email ?? ''),
    role: 'ADMIN',
    sector: 'System Administration',
    tempPassword: req.body?.tempPassword ? String(req.body.tempPassword) : undefined,
    adminActor: req.user.email,
    companyId: company.id,
  });
  const account = users.find((user) => user.id === result.user.id && user.companyId === company.id);
  if (!account) throw new Error('New company administrator account was not available for persistence.');
  await persistUser(account, await bcrypt.hash(result.generatedPassword, 12));
  return res.status(201).json({ message: 'Company administrator created', company, user: result.user, temporaryPassword: result.generatedPassword });
});

// Update Employee Role / Status / Sector
app.patch('/api/admin/employees/:id', authorize('ADMIN'), async (req: any, res) => {
  const userId = Number(req.params.id);
  const target = users.find((u) => u.id === userId && u.companyId === req.user.companyId);

  if (!target) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  if (req.body.role) target.role = req.body.role;
  if (req.body.sector) target.sector = req.body.sector;
  if (req.body.status) target.status = req.body.status;

  await persistUserState(target);

  logSecurityEvent(
    'USER_ROLE_UPDATED',
    req.user.email,
    'ADMIN',
    `Updated permissions/status for ${target.name} (${target.employeeId}) to Role: ${target.role}, Status: ${target.status}`,
    target.employeeId
  );

  return res.json({
    message: 'Employee updated successfully',
    user: toPublicUser(target),
    employees: demoAccounts().filter((employee) => employee.companyId === req.user.companyId),
  });
});

app.delete('/api/admin/employees/:id', authorize('ADMIN'), async (req: any, res) => {
  const userId = Number(req.params.id);
  const target = users.find((u) => u.id === userId && u.companyId === req.user.companyId);
  if (!target) return res.status(404).json({ error: 'Employee not found' });
  if (target.role === 'ADMIN') return res.status(400).json({ error: 'Administrator accounts cannot be deleted' });

  const index = users.findIndex((u) => u.id === userId);
  users.splice(index, 1);
  await removeUser(userId);
  logSecurityEvent('USER_STATUS_UPDATED', req.user.email, 'ADMIN', `Deleted employee ${target.name} (${target.employeeId})`, target.employeeId);
  return res.json({ message: 'Employee deleted successfully', employees: demoAccounts().filter((employee) => employee.companyId === req.user.companyId) });
});

// Reset Password / MFA for Employee
app.post('/api/admin/employees/:id/reset-password', authorize('ADMIN'), async (req: any, res) => {
  const userId = Number(req.params.id);
  const target = users.find((u) => u.id === userId && u.companyId === req.user.companyId);

  if (!target) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const resetPassword = 'ResetPass123!';
  const resetPasswordHash = await bcrypt.hash(resetPassword, 12);
  target.password = undefined;
  target.passwordHash = resetPasswordHash;
  target.isFirstLogin = true;
  target.status = 'PENDING_SETUP';
  await persistUser(target, resetPasswordHash);

  logSecurityEvent(
    'PASSWORD_RESET_TRIGGERED',
    req.user.email,
    'ADMIN',
    `Admin triggered password reset for ${target.name} (${target.employeeId})`,
    target.employeeId
  );

  return res.json({
    message: `Password reset to temporary password 'ResetPass123!'. User must change password on next login.`,
    user: toPublicUser(target),
  });
});

app.post('/api/admin/employees/:id/reset-mfa', authorize('ADMIN'), async (req: any, res) => {
  const userId = Number(req.params.id);
  const target = users.find((u) => u.id === userId && u.companyId === req.user.companyId);

  if (!target) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  target.mfaEnabled = false;
  await persistUserState(target);

  logSecurityEvent(
    'MFA_RESET',
    req.user.email,
    'ADMIN',
    `Admin reset MFA device for ${target.name} (${target.employeeId})`,
    target.employeeId
  );

  return res.json({
    message: `MFA device reset for ${target.name}. User will be prompted to re-enroll.`,
    user: toPublicUser(target),
  });
});

// Security Audit Logs Viewer
app.get('/api/admin/audit-logs', authorize('ADMIN'), async (_req, res) => {
  const persistedLogs = await getPersistedAuditLogs();
  const logs = persistedLogs.length > 0 ? persistedLogs : securityAuditLogs;
  res.json({ logs: logs.filter((log: any) => belongsToCompany(log.companyId)) });
});

app.get('/api/admin/policies', authorize('ADMIN'), (_req, res) => {
  res.json({ policy: getCurrentPolicy() });
});

app.patch('/api/admin/policies', authorize('ADMIN'), async (req: any, res) => {
  const allowed = ['owner', 'reviewDate', 'vatRate', 'sessionDurationHours', 'password', 'controls'];
  const changes: any = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) changes[key] = req.body[key];
  if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'At least one editable policy setting is required' });
  if (changes.owner !== undefined && (typeof changes.owner !== 'string' || !changes.owner.trim() || changes.owner.length > 120)) {
    return res.status(400).json({ error: 'Policy owner must be a non-empty value of at most 120 characters' });
  }
  if (changes.reviewDate !== undefined) {
    const parsedReviewDate = typeof changes.reviewDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(changes.reviewDate)
      ? new Date(`${changes.reviewDate}T00:00:00Z`)
      : undefined;
    if (!parsedReviewDate || Number.isNaN(parsedReviewDate.getTime()) || parsedReviewDate.toISOString().slice(0, 10) !== changes.reviewDate) {
      return res.status(400).json({ error: 'Review date must be a valid date in YYYY-MM-DD format' });
    }
  }
  if (changes.owner !== undefined) changes.owner = changes.owner.trim();
  if (changes.vatRate !== undefined && (!Number.isFinite(Number(changes.vatRate)) || Number(changes.vatRate) < 0 || Number(changes.vatRate) > 100)) {
    return res.status(400).json({ error: 'VAT rate must be between 0 and 100' });
  }
  if (changes.vatRate !== undefined) changes.vatRate = Number(changes.vatRate);
  if (changes.sessionDurationHours !== undefined && (!Number.isInteger(Number(changes.sessionDurationHours)) || Number(changes.sessionDurationHours) < 1 || Number(changes.sessionDurationHours) > 24)) {
    return res.status(400).json({ error: 'Session duration must be a whole number between 1 and 24 hours' });
  }
  if (changes.sessionDurationHours !== undefined) changes.sessionDurationHours = Number(changes.sessionDurationHours);
  if (changes.tlsStatus !== undefined && !['CONFIGURED', 'REQUIRES_DEPLOYMENT'].includes(changes.tlsStatus)) {
    return res.status(400).json({ error: 'TLS status is invalid' });
  }
  if (changes.password !== undefined) {
    const password = changes.password;
    if (!password || typeof password !== 'object' || Array.isArray(password)) {
      return res.status(400).json({ error: 'Password requirements must be an object' });
    }
    if (password.minimumLength !== undefined && (!Number.isInteger(Number(password.minimumLength)) || Number(password.minimumLength) < 6 || Number(password.minimumLength) > 64)) {
      return res.status(400).json({ error: 'Password minimum length must be a whole number between 6 and 64' });
    }
    if (password.minimumLength !== undefined) password.minimumLength = Number(password.minimumLength);
    const passwordFlags = ['requireUppercase', 'requireLowercase', 'requireNumber', 'requireSpecial', 'firstLoginChangeRequired'];
    if (passwordFlags.some((key) => password[key] !== undefined && typeof password[key] !== 'boolean')) {
      return res.status(400).json({ error: 'Password requirements must be boolean values' });
    }
  }
  if (changes.controls !== undefined) {
    const validStatuses = ['ENFORCED', 'RECOMMENDED', 'REQUIRES_DEPLOYMENT', 'DISABLED'];
    const existingPolicy = getCurrentPolicy(req.user.companyId);
    const existingControlIds = new Set(existingPolicy.controls.map((control) => control.id));
    if (
      !Array.isArray(changes.controls)
      || changes.controls.length === 0
      || changes.controls.some((control: any) => !existingControlIds.has(control?.id) || !validStatuses.includes(control?.status))
      || new Set(changes.controls.map((control: any) => control.id)).size !== changes.controls.length
    ) {
      return res.status(400).json({ error: 'Each policy control must have a valid status' });
    }
    const oldTlsStatus = existingPolicy.controls.find((control) => control.id === 'tls-edge')?.status;
    if (changes.controls.some((control: any) => control.id === 'tls-edge' && control.status !== oldTlsStatus)) {
      return res.status(400).json({ error: 'TLS edge configuration is deployment-managed and cannot be changed in the application' });
    }
  }
  const policy = updateSystemPolicy(changes, req.user?.email || 'admin', req.user.companyId);
  try {
    await persistCompanyPolicy(req.user.companyId, policy);
  } catch (error) {
    console.error('Failed to persist company policy', error);
    return res.status(isDatabaseReady() ? 500 : 503).json({ error: 'Policy changes could not be saved to PostgreSQL. Please try again.' });
  }
  setCurrentPolicy(req.user.companyId, policy);
  logSecurityEvent('USER_ROLE_UPDATED', req.user?.email || 'admin', 'ADMIN', `Policy version ${policy.version} updated`, 'SYSTEM-POLICY');
  return res.json({ message: `Policy version ${policy.version} saved`, policy });
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
  res.json({ products: getProductSnapshots((_req as any).user?.role === 'ADMIN' || _req.query.includeInactive === 'true'), categories });
});

app.post('/api/products', authorize('ADMIN', 'MANAGER', 'PROCUREMENT_STAFF'), async (req: any, res) => {
  try {
    const supplierId = Number(req.body?.supplierId);
    if (!Number.isInteger(supplierId) || !getActiveSupplierById(supplierId)) {
      return res.status(400).json({ error: 'Choose an active supplier that is registered with this company' });
    }
    const product = createProduct({
      sku: String(req.body?.sku ?? ''),
      barcode: String(req.body?.barcode ?? ''),
      name: String(req.body?.name ?? ''),
      category: String(req.body?.category ?? ''),
      supplierId,
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
    const product = findProductById(Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (req.body?.supplierId !== undefined) {
      const supplierId = Number(req.body.supplierId);
      const currentSupplierId = Number(product.supplierId);
      const supplier = getSupplierById(supplierId);
      if (!Number.isInteger(supplierId) || !supplier || (supplier.isArchived && supplierId !== currentSupplierId)) {
        return res.status(400).json({ error: 'Choose an active supplier that is registered with this company' });
      }
    }

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
  res.json({ movements: stockMovements.filter((movement) => belongsToCompany(movement.companyId)) });
});

app.get('/api/dashboard/summary', authorize('MANAGER'), (_req, res) => {
  res.json(getDashboardSummary());
});

app.get('/api/inventory/workspace', authorize('MANAGER', 'CASHIER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), async (req: any, res) => {
  res.json(await workspacePayload(req.user.role));
});

app.get('/api/inventory/items', authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), (req, res) => {
  const productId = req.query.productId === undefined ? undefined : Number(req.query.productId);
  if (productId !== undefined && (!Number.isInteger(productId) || productId <= 0)) {
    return res.status(400).json({ error: 'productId must be a positive integer' });
  }
  return res.json({ inventoryItems: getInventoryItems(productId) });
});

// ==========================================
// 5. POINT OF SALE & PROCESS RETURNS (CASHIER)
// ==========================================

// POS Sale Checkout (< 30s 5-item transaction support)
app.post('/api/sales', authorize('MANAGER', 'CASHIER'), async (req: any, res) => {
  let paymentReference: string | undefined;
  try {
    const items = toSaleItems(req.body);
    const paymentMethod = req.body?.paymentMethod ?? 'CASH';
    if (!['CASH', 'CARD', 'QR'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Payment method must be CASH, CARD, or QR' });
    }
    const discountPercent = Number(req.body?.discountPercent ?? 0);
    const total = calculateSaleTotal(items, discountPercent);

    if (paymentMethod !== 'CASH') {
      const authorization = await authorizeElectronicPayment({
        amount: total,
        currency: 'ZAR',
        method: paymentMethod as ElectronicPaymentMethod,
        idempotencyKey: randomUUID(),
      });
      paymentReference = authorization.reference;
    }

    const saleResult = createSaleTransaction(toSaleItems(req.body), {
      cashierName: req.user?.name || req.user?.email || 'Cashier',
      cashierEmployeeId: req.user?.employeeId || 'CSH-201',
      paymentMethod,
      paymentReference,
      discountPercent,
      tenderAmount: req.body?.tenderAmount === undefined ? undefined : Number(req.body.tenderAmount),
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
    if (paymentReference) {
      await voidElectronicPayment(paymentReference).catch((voidError) => {
        console.error('Unable to void payment authorization:', voidError instanceof Error ? voidError.message : voidError);
      });
    }
    return handleDomainError(res, error, 'Unable to complete sale transaction');
  }
});

app.get('/api/sales/receipts', authorize('MANAGER', 'CASHIER'), (_req, res) => {
  res.json({ receipts: salesReceipts.filter((receipt) => belongsToCompany(receipt.companyId)) });
});

// Process 2-Step Returns with Visual Reasons
app.post('/api/returns', authorize('MANAGER', 'CASHIER'), async (req: any, res) => {
  const { productId, quantity, reason, notes, receiptNumber } = req.body ?? {};

  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId and quantity are required' });
  }
  if (isPolicyEnforced('returns-verification') && !String(receiptNumber || '').trim()) {
    return res.status(400).json({ error: 'A receipt is required by the active return verification policy' });
  }

  try {
    const receipt = receiptNumber
      ? salesReceipts.find((entry) => belongsToCompany(entry.companyId) && entry.receiptNumber.toUpperCase() === String(receiptNumber).trim().toUpperCase())
      : undefined;
    const purchasedLine = receipt?.items.find((item) => item.productId === Number(productId));
    if (isPolicyEnforced('returns-verification') && !receipt) {
      return res.status(400).json({ error: 'The supplied receipt could not be verified' });
    }
    if (receipt && (!purchasedLine || Number(quantity) > purchasedLine.quantity)) {
      return res.status(400).json({ error: 'Return quantity exceeds the quantity on the original receipt' });
    }
    if (receipt && receipt.paymentMethod !== 'CASH') {
      if (!receipt.paymentReference) {
        return res.status(409).json({ error: 'Cannot refund this electronic sale: no provider authorization is recorded' });
      }
      await refundElectronicPayment(
        receipt.paymentReference,
        Number(((purchasedLine!.unitPrice) * Number(quantity)).toFixed(2)),
        randomUUID(),
      );
    }

    const result = createReturn({
      productId: Number(productId),
      quantity: Number(quantity),
      unitPrice: purchasedLine?.unitPrice,
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
  const { productId, quantity, notes, poNumber, warehouseId, binCode } = req.body ?? {};

  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId and quantity are required' });
  }

  try {
    const result = createReceiving(
      Number(productId),
      Number(quantity),
      notes ? String(notes) : undefined,
      `${req.user?.name || 'Warehouse Staff'} (${req.user?.employeeId || 'STAFF'})`,
      poNumber ? String(poNumber) : undefined,
      warehouseId ? String(warehouseId) : undefined,
      binCode ? String(binCode) : undefined
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

app.post('/api/inventory/adjustments', authorize('MANAGER', 'WAREHOUSE_STAFF'), async (req: any, res) => {
  const { productId, quantity, type, reason, warehouseId, binCode } = req.body ?? {};
  const adjustmentType: 'ADD' | 'DEDUCT' | undefined =
    type === 'ADD' || type === 'DEDUCT' ? type : undefined;
  if (productId === undefined || quantity === undefined || !adjustmentType || !reason) {
    return res.status(400).json({ error: 'productId, quantity, type, and reason are required' });
  }

  try {
    const result = createStockAdjustment(
      Number(productId),
      Number(quantity),
      adjustmentType,
      String(reason),
      actorName(req),
      warehouseId ? String(warehouseId) : undefined,
      binCode ? String(binCode) : undefined,
    );
    await persistStockAdjustment(result.updatedProduct, result.movement);
    return res.status(201).json({
      message: 'Stock adjustment recorded',
      movement: result.movement,
      product: result.updatedProduct,
      ...inventoryPayload(),
    });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to record stock adjustment');
  }
});

// Cycle Count / Inventory Audit (Design Iteration 1)
app.post('/api/cycle-counts', authorize('MANAGER', 'WAREHOUSE_STAFF'), async (req: any, res) => {
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
    await persistCycleCount(record, getProductSnapshots());

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
  res.json({ cycleCounts: cycleCounts.filter((count) => belongsToCompany(count.companyId)) });
});

// ==========================================
// 7. PROCUREMENT & SUPPLIERS
// ==========================================
app.get('/api/suppliers', authorize('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF', 'PROCUREMENT_STAFF'), (_req, res) => {
  res.json({ suppliers: getSupplierPerformance() });
});

app.post('/api/suppliers', authorize('PROCUREMENT_STAFF'), async (req, res) => {
  try {
    const input = validateNewSupplier(req.body ?? {});
    const requestedProductIds = req.body?.productIds ?? [];
    if (!Array.isArray(requestedProductIds) || requestedProductIds.some((id: unknown) => !Number.isInteger(id) || Number(id) <= 0)) {
      return res.status(400).json({ error: 'Product assignments must be a list of valid product IDs' });
    }
    const productIds = [...new Set(requestedProductIds as number[])];
    if (productIds.length !== requestedProductIds.length || productIds.some((id) => !findProductById(id))) {
      return res.status(400).json({ error: 'One or more selected products are invalid for this company' });
    }

    const supplier = await persistSupplier(input, productIds);
    addSupplier(supplier);
    for (const productId of productIds) {
      const product = findProductById(productId);
      if (product) {
        product.supplierId = supplier.id;
        product.updatedAt = new Date().toISOString();
      }
    }
    return res.status(201).json({
      message: 'Supplier added',
      supplier: getSupplierPerformance().find((entry) => entry.id === supplier.id),
      suppliers: getSupplierPerformance(),
      assignedProductIds: productIds,
    });
  } catch (error) {
    if (error instanceof SupplierError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Unable to add supplier', error);
    return res.status(500).json({ error: 'Unable to add supplier' });
  }
});

app.patch('/api/suppliers/:id/archive', authorize('PROCUREMENT_STAFF'), async (req, res) => {
  const supplierId = Number(req.params.id);
  if (!Number.isInteger(supplierId) || supplierId <= 0 || typeof req.body?.isArchived !== 'boolean') {
    return res.status(400).json({ error: 'A valid supplier ID and archive status are required' });
  }
  if (!getSupplierById(supplierId)) return res.status(404).json({ error: 'Supplier not found' });

  try {
    const updated = await persistSupplierArchivedStatus(supplierId, req.body.isArchived);
    if (!updated) return res.status(404).json({ error: 'Supplier not found' });
    setSupplierArchived(supplierId, req.body.isArchived);
    return res.json({
      message: req.body.isArchived ? 'Supplier archived' : 'Supplier restored',
      suppliers: getSupplierPerformance(),
    });
  } catch (error) {
    console.error('Unable to update supplier archive status', error);
    return res.status(500).json({ error: 'Unable to update supplier archive status' });
  }
});

app.delete('/api/suppliers/:id', authorize('PROCUREMENT_STAFF'), async (req, res) => {
  const supplierId = Number(req.params.id);
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return res.status(400).json({ error: 'A valid supplier ID is required' });
  }

  try {
    const result = await deletePersistedSupplier(supplierId);
    if (!result.found) return res.status(404).json({ error: 'Supplier not found' });
    if (!result.deleted) {
      return res.status(409).json({
        error: 'Reassign this supplier’s products and purchase orders before deleting it.',
        productCount: result.productCount,
        purchaseOrderCount: result.purchaseOrderCount,
      });
    }
    removeSupplier(supplierId);
    return res.json({ message: 'Supplier permanently deleted', suppliers: getSupplierPerformance() });
  } catch (error) {
    console.error('Unable to delete supplier', error);
    return res.status(500).json({ error: 'Unable to delete supplier' });
  }
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
    const receivedOrder = receivePurchaseOrder(
      Number(req.params.id),
      Number(req.body?.quantity),
      actorName(req),
      req.body?.warehouseId ? String(req.body.warehouseId) : undefined,
      req.body?.binCode ? String(req.body.binCode) : undefined,
    );
    const { receivingMovement, ...purchaseOrder } = receivedOrder;
    if (receivingMovement && (req.body?.condition || req.body?.notes)) {
      receivingMovement.notes = [
        receivingMovement.notes,
        req.body?.condition ? `Condition: ${String(req.body.condition)}` : '',
        req.body?.notes ? `Note: ${String(req.body.notes)}` : '',
      ].filter(Boolean).join(' | ');
    }
    const product = findProductBySku(purchaseOrder.sku);
    if (product && receivingMovement) {
      await persistReceiving(toProductSnapshot(product), receivingMovement);
    }
    await persistPurchaseOrder(purchaseOrder);
    return res.json({ message: 'Purchase order received', purchaseOrder, purchaseOrders: getPurchaseOrders(), ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to receive purchase order');
  }
});

app.post('/api/purchase-orders/:id/supplier-review', authorize('PROCUREMENT_STAFF'), async (req: any, res) => {
  try {
    const purchaseOrderId = Number(req.params.id);
    const feedback = req.body?.feedback;
    if (feedback !== undefined && typeof feedback !== 'string') {
      return res.status(400).json({ error: 'Feedback must be text' });
    }
    const review = validateSupplierReview(purchaseOrderId, {
      deliveryScore: req.body?.deliveryScore,
      qualityScore: req.body?.qualityScore,
      communicationScore: req.body?.communicationScore,
      feedback,
      reviewerId: String(req.user.id),
      reviewerName: actorName(req),
    });
    await persistSupplierReview(review);
    addSupplierReview(review);
    return res.status(201).json({
      message: 'Supplier review submitted',
      supplierReview: review,
      suppliers: getSupplierPerformance(),
      purchaseOrders: getPurchaseOrders(),
    });
  } catch (error) {
    if (error instanceof SupplierReviewError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error && typeof error === 'object' && 'name' in error && error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'This purchase order has already been reviewed' });
    }
    console.error('Unable to submit supplier review', error);
    return res.status(500).json({ error: 'Unable to submit supplier review' });
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
  res.json({ orders: customerOrders.filter((order) => belongsToCompany(order.companyId)) });
});

app.post('/api/orders/reserve', authorize('MANAGER', 'CASHIER'), async (req: any, res) => {
  try {
    const order = createOnlineOrder({
      customerName: String(req.body?.customerName ?? 'Online Customer'),
      items: toSaleItems(req.body),
      shippingAddress: req.body?.shippingAddress ? String(req.body.shippingAddress) : undefined,
    });
    await persistCustomerOrder(order, getProductSnapshots());
    return res.status(201).json({ message: 'Order reserved successfully', order, orders: customerOrders.filter((entry) => belongsToCompany(entry.companyId)), ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to reserve order');
  }
});

app.patch('/api/orders/:id/commit', authorize('MANAGER', 'CASHIER', 'WAREHOUSE_STAFF'), async (req: any, res) => {
  try {
    const order = commitReservedOrder(Number(req.params.id));
    await persistCustomerOrderStatus(order, getProductSnapshots());
    return res.json({ message: 'Reserved order committed to fulfillment', order, orders: customerOrders.filter((entry) => belongsToCompany(entry.companyId)), ...inventoryPayload() });
  } catch (error) {
    return handleDomainError(res, error, 'Unable to commit reserved order');
  }
});

app.patch('/api/orders/:id/release', authorize('MANAGER', 'CASHIER', 'WAREHOUSE_STAFF'), async (req: any, res) => {
  try {
    const order = releaseReservedOrder(Number(req.params.id));
    await persistCustomerOrderStatus(order, getProductSnapshots());
    return res.json({ message: 'Reserved order released', order, orders: customerOrders.filter((entry) => belongsToCompany(entry.companyId)), ...inventoryPayload() });
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
      throw new Error(
        `API port ${port} is already in use. Stop the existing API process or set PORT and VITE_API_PROXY_TARGET to the same port.`,
      );
    }

    throw error;
  });
};

if (process.env.NODE_ENV !== 'test') {
  connectDatabase().then((databaseConnected) => {
    setDatabaseReady(databaseConnected);
    if (process.env.NODE_ENV === 'production' && !databaseConnected) {
      console.error('PostgreSQL is unavailable; refusing to start production API with in-memory storage.');
      process.exitCode = 1;
      return;
    }
    setSecurityAuditWriter(databaseConnected ? (log) => {
      void persistAuditLog(log).catch((error) => {
        console.error('Unable to persist security audit event:', error instanceof Error ? error.message : error);
      });
    } : undefined);
    startServer(preferredPort);
  });
}
