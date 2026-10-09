import assert from 'node:assert/strict';
import test from 'node:test';
test('production disables demo sign-in and applies the configured CORS allowlist', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabasePassword = process.env.DB_PASSWORD;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalCorsOrigins = process.env.CORS_ORIGINS;
  process.env.NODE_ENV = 'test';
  process.env.DB_PASSWORD ??= 'test-only-database-password';
  process.env.JWT_SECRET ??= 'test-only-jwt-secret-for-server-tests';
  process.env.CORS_ORIGINS = 'https://inventory.example.test';

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

    const { generateToken, toPublicUser, users } = await import('./modules/auth/auth');
    const admin = users.find((user) => user.role === 'ADMIN');
    assert.ok(admin);
    const adminToken = generateToken(toPublicUser(admin));
    const resetResponse = await fetch(`${baseUrl}/api/admin/employees/${admin.id}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resetResponse.status, 200);

    const resetLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: admin.employeeId, password: 'ResetPass123!' }),
    });
    assert.equal(resetLoginResponse.status, 200);
    const resetLogin = await resetLoginResponse.json() as { token: string; requiresFirstPasswordSetup: boolean };
    assert.equal(resetLogin.requiresFirstPasswordSetup, true);

    admin.status = 'ACTIVE';
    const setupResponse = await fetch(`${baseUrl}/api/auth/set-first-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resetLogin.token}`,
      },
      body: JSON.stringify({ employeeId: admin.employeeId, newPassword: 'AdminResetSecure2026!' }),
    });
    assert.equal(setupResponse.status, 200);

    const demoAccountsResponse = await fetch(`${baseUrl}/api/auth/demo-accounts`);
    assert.equal(demoAccountsResponse.status, 404);

    const quickSwitchResponse = await fetch(`${baseUrl}/api/auth/quick-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'EMP-CSH-201' }),
    });
    assert.equal(quickSwitchResponse.status, 404);

    const firstPasswordWithoutLoginResponse = await fetch(`${baseUrl}/api/auth/set-first-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'EMP-ADM-001', newPassword: 'NewStrongPassword123!' }),
    });
    assert.equal(firstPasswordWithoutLoginResponse.status, 401);

    const allowedOriginResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://inventory.example.test' },
    });
    assert.equal(allowedOriginResponse.headers.get('access-control-allow-origin'), 'https://inventory.example.test');

    const deniedOriginResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://untrusted.example.test' },
    });
    assert.equal(deniedOriginResponse.headers.get('access-control-allow-origin'), null);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve(undefined));
    });
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DB_PASSWORD = originalDatabasePassword;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.CORS_ORIGINS = originalCorsOrigins;
  }
});