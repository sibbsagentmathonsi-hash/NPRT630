import assert from 'node:assert/strict';
import test from 'node:test';

test('development CORS fallback allows the local Vite origins on ports 5175 and 5176', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabasePassword = process.env.DB_PASSWORD;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalCorsOrigins = process.env.CORS_ORIGINS;
  process.env.NODE_ENV = 'test';
  process.env.DB_PASSWORD ??= 'test-only-database-password';
  process.env.JWT_SECRET ??= 'test-only-jwt-secret-for-cors-tests';
  delete process.env.CORS_ORIGINS;

  const { app } = await import('./server');
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test API server did not bind to a TCP port');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    for (const origin of [
      'http://localhost:5175',
      'http://127.0.0.1:5175',
      'http://localhost:5176',
      'http://127.0.0.1:5176',
    ]) {
      const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
    }
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
  }
});
