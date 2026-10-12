import assert from 'node:assert/strict';
import test from 'node:test';
test('production disables demo sign-in and applies the configured CORS allowlist', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabasePassword = process.env.DB_PASSWORD;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalCorsOrigins = process.env.CORS_ORIGINS;
  const originalEnforceHttps = process.env.ENFORCE_HTTPS;
  const originalTurnstileSiteKey = process.env.TURNSTILE_SITE_KEY;
  const originalTurnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;
  const originalTurnstileHostnames = process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  const originalFetch = globalThis.fetch;
  process.env.NODE_ENV = 'test';
  process.env.DB_PASSWORD ??= 'test-only-database-password';
  process.env.JWT_SECRET ??= 'test-only-jwt-secret-for-server-tests';
  process.env.CORS_ORIGINS = 'https://inventory.example.test';
  process.env.ENFORCE_HTTPS = 'false';

  const { app } = await import('./server');
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test API server did not bind to a TCP port');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    process.env.NODE_ENV = 'production';
    process.env.TURNSTILE_SITE_KEY = 'test-site-key';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'inventory.example.test';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
        const turnstilePayload = new URLSearchParams(String(init?.body));
        return new Response(JSON.stringify({
          success: true,
          action: turnstilePayload.get('response') === 'invalid-action-token' ? 'login' : 'auth',
          hostname: 'inventory.example.test',
        }), { status: 200 });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const { generateToken, toPublicUser, users } = await import('./modules/auth/auth');
    const admin = users.find((user) => user.role === 'ADMIN');
    assert.ok(admin);
    const adminToken = generateToken(toPublicUser(admin));
    const duplicateEmployeeResponse = await fetch(`${baseUrl}/api/admin/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', adminToken].join(' ') },
      body: JSON.stringify({
        name: 'Duplicate Employee',
        email: admin.email,
        role: 'CASHIER',
        sector: 'Cashier & Front-of-House',
      }),
    });
    assert.equal(duplicateEmployeeResponse.status, 409);

    const employeeDirectoryResponse = await fetch(`${baseUrl}/api/admin/employees`, {
      headers: { Authorization: ['Bearer', adminToken].join(' ') },
    });
    assert.equal(employeeDirectoryResponse.status, 200);
    const employeeDirectory = await employeeDirectoryResponse.json() as { employees: unknown[] };
    assert.ok(employeeDirectory.employees.length > 0);

    const managerToken = generateToken({ ...toPublicUser(admin), role: 'MANAGER' });
    const managerReviewResponse = await fetch(`${baseUrl}/api/purchase-orders/999999999/supplier-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', managerToken].join(' ') },
      body: JSON.stringify({ deliveryScore: 5, qualityScore: 5, communicationScore: 5 }),
    });
    assert.equal(managerReviewResponse.status, 403);

    const procurementToken = generateToken({ ...toPublicUser(admin), role: 'PROCUREMENT_STAFF' });
    const invalidSupplierResponse = await fetch(`${baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', procurementToken].join(' ') },
      body: JSON.stringify({ name: '', contact: '', leadTimeDays: '' }),
    });
    assert.equal(invalidSupplierResponse.status, 400);

    const invalidSupplierProductResponse = await fetch(`${baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', procurementToken].join(' ') },
      body: JSON.stringify({
        name: 'Invalid Assignment Supplier',
        contact: 'invalid-assignment@example.test',
        leadTimeDays: 3,
        productIds: [0],
      }),
    });
    assert.equal(invalidSupplierProductResponse.status, 400);

    const unknownSupplierProductResponse = await fetch(`${baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', procurementToken].join(' ') },
      body: JSON.stringify({
        name: 'Unknown Product Supplier',
        contact: 'unknown-product@example.test',
        leadTimeDays: 3,
        productIds: [999999999],
      }),
    });
    assert.equal(unknownSupplierProductResponse.status, 400);

    const managerSupplierResponse = await fetch(`${baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', managerToken].join(' ') },
      body: JSON.stringify({ name: 'Unauthorized Supplier', contact: 'unauthorized@example.test', leadTimeDays: 3 }),
    });
    assert.equal(managerSupplierResponse.status, 403);

    const invalidSupplierArchiveResponse = await fetch(`${baseUrl}/api/suppliers/1/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', procurementToken].join(' ') },
      body: JSON.stringify({ isArchived: 'yes' }),
    });
    assert.equal(invalidSupplierArchiveResponse.status, 400);

    const managerSupplierArchiveResponse = await fetch(`${baseUrl}/api/suppliers/1/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', managerToken].join(' ') },
      body: JSON.stringify({ isArchived: true }),
    });
    assert.equal(managerSupplierArchiveResponse.status, 403);

    const invalidSupplierDeleteResponse = await fetch(`${baseUrl}/api/suppliers/not-an-id`, {
      method: 'DELETE',
      headers: { Authorization: ['Bearer', procurementToken].join(' ') },
    });
    assert.equal(invalidSupplierDeleteResponse.status, 400);

    const missingOrderReviewResponse = await fetch(`${baseUrl}/api/purchase-orders/999999999/supplier-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', procurementToken].join(' ') },
      body: JSON.stringify({ deliveryScore: 5, qualityScore: 5, communicationScore: 5 }),
    });
    assert.equal(missingOrderReviewResponse.status, 404);

    const companyUpdateResponse = await fetch(`${baseUrl}/api/platform/companies/company-default`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ legalName: 'Updated Demo Company' }),
    });
    assert.equal(companyUpdateResponse.status, 200);
    const companyUpdate = await companyUpdateResponse.json() as { company: { legalName: string } };
    assert.equal(companyUpdate.company.legalName, 'Updated Demo Company');

    const invalidCompanyUpdateResponse = await fetch(`${baseUrl}/api/platform/companies/company-default`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ currency: 'US dollars' }),
    });
    assert.equal(invalidCompanyUpdateResponse.status, 400);

    const protectedDefaultArchiveResponse = await fetch(`${baseUrl}/api/platform/companies/company-default/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', adminToken].join(' ') },
      body: JSON.stringify({ subscriptionStatus: 'ARCHIVED' }),
    });
    assert.equal(protectedDefaultArchiveResponse.status, 400);

    const invalidCompanyStatusResponse = await fetch(`${baseUrl}/api/platform/companies/company-default/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', adminToken].join(' ') },
      body: JSON.stringify({ subscriptionStatus: 'DELETED' }),
    });
    assert.equal(invalidCompanyStatusResponse.status, 400);

    const nonPlatformArchiveResponse = await fetch(`${baseUrl}/api/platform/companies/company-default/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: ['Bearer', managerToken].join(' ') },
      body: JSON.stringify({ subscriptionStatus: 'ARCHIVED' }),
    });
    assert.equal(nonPlatformArchiveResponse.status, 403);

    const resetResponse = await fetch(`${baseUrl}/api/admin/employees/${admin.id}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resetResponse.status, 200);

    const missingTurnstileResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: admin.employeeId, password: 'ResetPass123!' }),
    });
    assert.equal(missingTurnstileResponse.status, 400);

    const invalidTurnstileActionResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: admin.employeeId,
        password: 'ResetPass123!',
        turnstileToken: 'invalid-action-token',
      }),
    });
    assert.equal(invalidTurnstileActionResponse.status, 400);

    const resetLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: admin.employeeId,
        password: 'ResetPass123!',
        turnstileToken: 'test-token',
      }),
    });
    assert.equal(resetLoginResponse.status, 200);
    const resetLogin = await resetLoginResponse.json() as { csrfToken: string; requiresFirstPasswordSetup: boolean };
    assert.equal(resetLogin.requiresFirstPasswordSetup, true);
    assert.equal('token' in resetLogin, false);
    assert.ok(resetLogin.csrfToken);
    const loginCookie = resetLoginResponse.headers.get('set-cookie');
    assert.ok(loginCookie);
    assert.match(loginCookie, /^syncstock_session=/);
    assert.match(loginCookie, /httponly/i);
    assert.match(loginCookie, /samesite=lax/i);
    assert.match(loginCookie, /secure/i);

    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: loginCookie.split(';', 1)[0] },
    });
    assert.equal(sessionResponse.status, 200);

    const missingCsrfResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: loginCookie.split(';', 1)[0] },
    });
    assert.equal(missingCsrfResponse.status, 403);

    admin.status = 'ACTIVE';
    const setupResponse = await fetch(`${baseUrl}/api/auth/set-first-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: loginCookie.split(';', 1)[0],
        'X-CSRF-Token': resetLogin.csrfToken,
      },
      body: JSON.stringify({ employeeId: admin.employeeId, newPassword: 'AdminResetSecure2026!' }),
    });
    assert.equal(setupResponse.status, 200);
    const setupData = await setupResponse.json() as { csrfToken: string };
    const setupCookie = setupResponse.headers.get('set-cookie');
    assert.ok(setupCookie);

    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: setupCookie.split(';', 1)[0],
        'X-CSRF-Token': setupData.csrfToken,
      },
    });
    assert.equal(logoutResponse.status, 200);
    const expiredSessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    });
    assert.equal(expiredSessionResponse.status, 401);
    assert.match(logoutResponse.headers.get('set-cookie') || '', /expires=thu, 01 jan 1970|max-age=0/i);

    const untrustedMutationResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: 'https://untrusted.example.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'ADM-001', password: process.env.ADMIN_PASSWORD || '@Arg3nt2003' }),
    });
    assert.equal(untrustedMutationResponse.status, 403);

    const demoAccountsResponse = await fetch(`${baseUrl}/api/auth/demo-accounts`);
    assert.equal(demoAccountsResponse.status, 404);

    const quickSwitchResponse = await fetch(`${baseUrl}/api/auth/quick-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'CSH-201' }),
    });
    assert.equal(quickSwitchResponse.status, 404);

    const firstPasswordWithoutLoginResponse = await fetch(`${baseUrl}/api/auth/set-first-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'ADM-001', newPassword: 'NewStrongPassword123!' }),
    });
    assert.equal(firstPasswordWithoutLoginResponse.status, 401);

    const allowedOriginResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://inventory.example.test' },
    });
    assert.equal(allowedOriginResponse.headers.get('access-control-allow-origin'), 'https://inventory.example.test');
    assert.equal(allowedOriginResponse.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(allowedOriginResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.match(allowedOriginResponse.headers.get('content-security-policy') || '', /default-src 'none'/);

    const deniedOriginResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://untrusted.example.test' },
    });
    assert.equal(deniedOriginResponse.headers.get('access-control-allow-origin'), null);
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
    if (originalCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalCorsOrigins;
    if (originalEnforceHttps === undefined) delete process.env.ENFORCE_HTTPS;
    else process.env.ENFORCE_HTTPS = originalEnforceHttps;
    if (originalTurnstileSiteKey === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
    if (originalTurnstileSecretKey === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecretKey;
    if (originalTurnstileHostnames === undefined) delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
    else process.env.TURNSTILE_ALLOWED_HOSTNAMES = originalTurnstileHostnames;
    globalThis.fetch = originalFetch;
  }
});