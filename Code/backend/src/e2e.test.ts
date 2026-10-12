// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';

type Json = Record<string, any>;

test('e2e: cashier onboarding, POS sale, receipt history, and movement audit flow', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabasePassword = process.env.DB_PASSWORD;
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'test';
  process.env.DB_PASSWORD ??= 'test-only-database-password';
  process.env.JWT_SECRET ??= 'test-only-jwt-secret-for-e2e-tests';

  const { app } = await import('./server');
  const { users } = await import('./modules/auth/auth');
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('E2E API server did not bind to a TCP port');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let sessionCookie = '';
  let csrfToken = '';

  const request = async (path: string, options: RequestInit = {}): Promise<{ response: Response; body: Json }> => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    });
    headers.delete('Authorization');
    if (sessionCookie) headers.set('Cookie', sessionCookie);
    if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes((options.method ?? 'GET').toUpperCase())) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    const body = await response.json().catch(() => ({}));
    const setCookie = response.headers.get('set-cookie');
    if (setCookie?.startsWith('syncstock_session=')) {
      sessionCookie = setCookie.split(';', 1)[0];
      if (/;\s*max-age=0(?:;|$)/i.test(setCookie)) sessionCookie = '';
    }
    if (typeof body.csrfToken === 'string') csrfToken = body.csrfToken;
    return { response, body };
  };

  try {
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 'ADM-001', password: process.env.ADMIN_PASSWORD || '@Arg3nt2003' }),
    });
    assert.equal(adminLogin.response.status, 200);
    assert.equal(adminLogin.body.user.role, 'ADMIN');
    const adminToken = 'cookie-session';

    const unique = Date.now();
    const registerCashier = await request('/api/admin/employees', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'E2E Cashier',
        email: `e2e.cashier.${unique}@synctest.local`,
        role: 'CASHIER',
        sector: 'Cashier & Front-of-House',
        tempPassword: 'TempCashier123!',
      }),
    });
    assert.equal(registerCashier.response.status, 201);
    assert.equal(registerCashier.body.user.role, 'CASHIER');
    assert.equal(registerCashier.body.user.isFirstLogin, true);
    const cashierRecord = users.find((user) => user.employeeId === registerCashier.body.user.employeeId);
    assert.ok(cashierRecord?.passwordHash);
    assert.equal(cashierRecord?.password, undefined);

    const firstLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: registerCashier.body.user.employeeId,
        password: 'TempCashier123!',
      }),
    });
    assert.equal(firstLogin.response.status, 200);
    assert.equal(firstLogin.body.requiresFirstPasswordSetup, true);

    const setupPassword = await request('/api/auth/set-first-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${firstLogin.body.token}` },
      body: JSON.stringify({
        employeeId: registerCashier.body.user.employeeId,
        newPassword: 'CashierFinal123!',
      }),
    });
    assert.equal(setupPassword.response.status, 200);

    const cashierLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: registerCashier.body.user.employeeId,
        password: 'CashierFinal123!',
      }),
    });
    assert.equal(cashierLogin.response.status, 200);
    assert.equal(cashierLogin.body.requiresFirstPasswordSetup, false);
    const cashierToken = 'cookie-session';

    const workspaceBefore = await request('/api/inventory/workspace', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(workspaceBefore.response.status, 200);
    const saleProduct = workspaceBefore.body.products.find((product: Json) => product.isActive && product.availableStock > 0);
    assert.ok(saleProduct, 'expected at least one sellable product in the seeded catalogue');
    const receiptCountBefore = workspaceBefore.body.receipts.length;

    const sale = await request('/api/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        items: [{ productId: saleProduct.id, quantity: 1 }],
        paymentMethod: 'CASH',
        tenderAmount: 100000,
        notes: 'E2E POS checkout',
      }),
    });
    assert.equal(sale.response.status, 201);
    assert.match(sale.body.receipt.receiptNumber, /^REC-/);
    assert.equal(sale.body.receipt.cashierEmployeeId, registerCashier.body.user.employeeId);
    assert.equal(sale.body.receipt.items[0].productId, saleProduct.id);
    assert.equal(sale.body.receipt.items[0].quantity, 1);

    const updatedProduct = sale.body.products.find((product: Json) => product.id === saleProduct.id);
    assert.equal(updatedProduct.stock, saleProduct.stock - 1);

    const receipts = await request('/api/sales/receipts', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(receipts.response.status, 200);
    assert.equal(receipts.body.receipts.length, receiptCountBefore + 1);
    assert.ok(receipts.body.receipts.some((receipt: Json) => receipt.receiptNumber === sale.body.receipt.receiptNumber));

    const stockMovements = await request('/api/stock-movements', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(stockMovements.response.status, 200);
    assert.ok(stockMovements.body.movements.some((movement: Json) => (
      movement.type === 'SALE'
      && movement.reference === sale.body.receipt.receiptNumber
      && movement.productId === saleProduct.id
      && movement.quantity === 1
    )));

    const adminSession = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 'ADM-001', password: process.env.ADMIN_PASSWORD || '@Arg3nt2003' }),
    });
    assert.equal(adminSession.response.status, 200);
    const auditLogs = await request('/api/admin/audit-logs');
    assert.equal(auditLogs.response.status, 200);
    assert.ok(auditLogs.body.logs.some((log: Json) => (
      log.eventType === 'USER_REGISTERED'
      && String(log.targetUserId) === registerCashier.body.user.employeeId
    )));
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve(undefined));
    });
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalDatabasePassword === undefined) delete process.env.DB_PASSWORD;
    else process.env.DB_PASSWORD = originalDatabasePassword;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});
