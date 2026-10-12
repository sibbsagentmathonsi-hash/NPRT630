import type { NextFunction, Request, RequestHandler, Response } from 'express';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type SiteverifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

type TurnstileOptions = {
  secret: string;
  allowedHostnames: string[];
  remoteIp?: string;
};

const configuredOptions = (): TurnstileOptions | undefined => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const allowedHostnames = process.env.TURNSTILE_ALLOWED_HOSTNAMES
    ?.split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (!secret && !siteKey && !allowedHostnames?.length && process.env.NODE_ENV !== 'production') {
    return undefined;
  }
  if (!secret || !siteKey || !allowedHostnames?.length) {
    throw new Error('Turnstile requires TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY, and TURNSTILE_ALLOWED_HOSTNAMES.');
  }

  return { secret, allowedHostnames };
};

export const verifyTurnstileToken = async (
  token: string,
  expectedAction: string,
  options: TurnstileOptions,
  fetcher: typeof fetch = fetch,
): Promise<boolean> => {
  const body = new URLSearchParams({
    secret: options.secret,
    response: token,
  });
  if (options.remoteIp) body.set('remoteip', options.remoteIp);

  const response = await fetcher(SITEVERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Turnstile Siteverify returned HTTP ${response.status}.`);
  }

  const result = await response.json() as SiteverifyResponse;
  return result.success === true
    && result.action === expectedAction
    && typeof result.hostname === 'string'
    && options.allowedHostnames.includes(result.hostname.toLowerCase());
};

const handleTurnstileRequest = (
  expectedAction: string,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }

  let options: TurnstileOptions | undefined;
  try {
    options = configuredOptions();
  } catch (error) {
    console.error('Turnstile configuration error', error);
    res.status(503).json({ error: 'Bot protection is not configured. Contact your administrator.' });
    return;
  }

  if (!options) {
    next();
    return;
  }

  const token = req.body?.turnstileToken;
  if (typeof token !== 'string' || token.length === 0) {
    res.status(400).json({ error: 'Complete the security check and try again.' });
    return;
  }

  void verifyTurnstileToken(token, expectedAction, { ...options, remoteIp: req.ip })
    .then((verified) => {
      if (verified) {
        next();
        return;
      }
      res.status(400).json({ error: 'The security check could not be verified. Please try again.' });
    })
    .catch((error) => {
      console.error('Turnstile Siteverify request failed', error);
      res.status(503).json({ error: 'Bot protection could not be reached. Please try again.' });
    });
};

export const requireTurnstile = (expectedAction: string): RequestHandler => (req, res, next) => {
  handleTurnstileRequest(expectedAction, req, res, next);
};
