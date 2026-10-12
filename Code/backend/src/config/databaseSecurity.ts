export const getDatabaseSslOptions = (): false | { rejectUnauthorized: true } => {
  const sslEnabled = process.env.DB_SSL === 'true';
  if (process.env.NODE_ENV === 'production' && !sslEnabled) {
    throw new Error('DB_SSL=true is required for PostgreSQL connections in production.');
  }
  if (process.env.NODE_ENV === 'production' && process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    throw new Error('PostgreSQL certificate verification cannot be disabled in production.');
  }
  return sslEnabled ? { rejectUnauthorized: true } : false;
};
