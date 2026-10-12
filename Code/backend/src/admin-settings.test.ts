import assert from 'node:assert/strict';
import test from 'node:test';

test('admin profile and policy changes reject invalid data and never report an in-memory-only save', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabasePassword = process.env.DB_PASSWORD;
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'test';
  process.env.DB_PASSWORD ??= 'test-only-database-password';
  process.env.JWT_SECRET ??= 'test-only-jwt-secret-for-admin-settings-tests';

  const [{ app }, auth, { getCurrentPolicy, setCurrentPolicy }, { getCompany }] = await Promise.all([
    import('./server'),
    import('./modules/auth/auth'),
    import('./config/policies'),
    import('./config/tenancy'),
  ]);
  const admin = auth.users.find((user) => user.role === 'ADMIN');
  assert.ok(admin);
  const token = auth.generateToken(auth.toPublicUser(admin));
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test API server did not bind to a TCP port');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const originalMfaEnabled = admin.mfaEnabled;
  const originalMfaSecret = admin.mfaSecret;
  const policyBefore = { ...getCurrentPolicy(admin.companyId), controls: getCurrentPolicy(admin.companyId).controls.map((control) => ({ ...control })) };

  try {
    const companyBefore = { ...getCompany(admin.companyId)! };
    const invalidCompanyResponse = await fetch(`${baseUrl}/api/admin/company`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ timezone: 'Not/A_Timezone' }),
    });
    assert.equal(invalidCompanyResponse.status, 400);

    const validCompanyResponse = await fetch(`${baseUrl}/api/admin/company`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ currency: 'USD' }),
    });
    assert.equal(validCompanyResponse.status, 503);
    assert.equal(getCompany(admin.companyId)?.currency, companyBefore.currency);

    const validPolicyResponse = await fetch(`${baseUrl}/api/admin/policies`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ vatRate: 21 }),
    });
    assert.equal(validPolicyResponse.status, 503);
    assert.equal(getCurrentPolicy(admin.companyId).vatRate, policyBefore.vatRate);

    const invalidPolicyResponse = await fetch(`${baseUrl}/api/admin/policies`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ controls: [{ id: 'unknown-control', status: 'ENFORCED' }] }),
    });
    assert.equal(invalidPolicyResponse.status, 400);

    const tlsPolicyResponse = await fetch(`${baseUrl}/api/admin/policies`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        controls: [{ id: 'tls-edge', status: 'ENFORCED' }],
      }),
    });
    assert.equal(tlsPolicyResponse.status, 400);

    setCurrentPolicy(admin.companyId, {
      ...policyBefore,
      controls: policyBefore.controls.map((control) => control.id === 'mfa-enrollment'
        ? { ...control, status: 'ENFORCED' }
        : control),
    });
    admin.mfaEnabled = false;
    const readablePolicyResponse = await fetch(`${baseUrl}/api/admin/policies`, { headers });
    assert.equal(readablePolicyResponse.status, 200);
    const blockedCompanyResponse = await fetch(`${baseUrl}/api/admin/company`, { headers });
    assert.equal(blockedCompanyResponse.status, 403);

    const mfaEnrollmentResponse = await fetch(`${baseUrl}/api/auth/mfa/enroll`, {
      method: 'POST',
      headers,
    });
    assert.equal(mfaEnrollmentResponse.status, 503);

    const mfaVerificationResponse = await fetch(`${baseUrl}/api/auth/verify-mfa`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ employeeId: admin.employeeId, code: '000000' }),
    });
    assert.equal(mfaVerificationResponse.status, 401);

    const otherUserVerificationResponse = await fetch(`${baseUrl}/api/auth/verify-mfa`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ employeeId: 'ANOTHER-ACCOUNT', code: '000000' }),
    });
    assert.equal(otherUserVerificationResponse.status, 403);
  } finally {
    setCurrentPolicy(admin.companyId, policyBefore);
    admin.mfaEnabled = originalMfaEnabled;
    admin.mfaSecret = originalMfaSecret;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)));
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DB_PASSWORD = originalDatabasePassword;
    process.env.JWT_SECRET = originalJwtSecret;
  }
});
