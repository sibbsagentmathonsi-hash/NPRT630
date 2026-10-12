import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

export const SESSION_COOKIE_NAME = 'syncstock_session';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const SESSION_COOKIE_PATH = '/';

export const createCsrfToken = (): string => randomBytes(32).toString('base64url');

export const isValidCsrfToken = (expected: unknown, provided: unknown): boolean => {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
};

export const readCookie = (req: Request, name: string): string | undefined => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const prefix = `${name}=`;
  const entry = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return undefined;
  }
};

const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.SESSION_COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path: SESSION_COOKIE_PATH,
});

export const setSessionCookie = (res: Response, token: string, maxAgeSeconds: number): void => {
  res.cookie(SESSION_COOKIE_NAME, token, { ...sessionCookieOptions(), maxAge: maxAgeSeconds * 1000 });
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
};

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many sign-in attempts. Wait 15 minutes before trying again.' },
});

export const verificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many verification attempts. Wait 15 minutes before trying again.' },
});
