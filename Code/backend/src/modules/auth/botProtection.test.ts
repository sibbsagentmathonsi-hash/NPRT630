// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { requireTurnstile, verifyTurnstileToken } from './botProtection';

const options = {
  secret: 'test-secret',
  allowedHostnames: ['inventory.example.test'],
  remoteIp: '203.0.113.10',
};

test('Turnstile validation posts the token and requires the expected action and hostname', async () => {
  let requestBody = '';
  const fakeFetch = async (_input: unknown, init: { body?: BodyInit | null } = {}): Promise<Response> => {
    requestBody = String(init.body);
    return new Response(JSON.stringify({
      success: true,
      action: 'auth',
      hostname: 'inventory.example.test',
    }), { status: 200 });
  };

  assert.equal(await verifyTurnstileToken('one-time-token', 'auth', options, fakeFetch as typeof fetch), true);
  assert.equal(await verifyTurnstileToken('one-time-token', 'login', options, fakeFetch as typeof fetch), false);
  assert.equal(new URLSearchParams(requestBody).get('secret'), options.secret);
  assert.equal(new URLSearchParams(requestBody).get('response'), 'one-time-token');
  assert.equal(new URLSearchParams(requestBody).get('remoteip'), options.remoteIp);
});

test('Turnstile rejects hostnames outside the allowlist', async () => {
  const fakeFetch = async (): Promise<Response> => new Response(JSON.stringify({
    success: true,
    action: 'auth',
    hostname: 'attacker.example.test',
  }), { status: 200 });

  assert.equal(await verifyTurnstileToken('one-time-token', 'auth', options, fakeFetch as typeof fetch), false);
});

test('production Turnstile middleware fails closed when configuration is incomplete', () => {
  const original = {
    nodeEnv: process.env.NODE_ENV,
    siteKey: process.env.TURNSTILE_SITE_KEY,
    secretKey: process.env.TURNSTILE_SECRET_KEY,
    allowedHostnames: process.env.TURNSTILE_ALLOWED_HOSTNAMES,
  };
  process.env.NODE_ENV = 'production';
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;

  const capturedResponse: { status: number; error: string } = { status: 0, error: '' };
  let continued = false;
  let response: Response;
  const status = (statusCode: number): Response => {
    capturedResponse.status = statusCode;
    return response;
  };
  const json = (body: { error?: string }): Response => {
    capturedResponse.error = body.error ?? '';
    return response;
  };
  response = { status, json } as unknown as Response;
  const request = { body: {} } as unknown as Request;

  try {
    requireTurnstile('auth')(request, response, () => {
      continued = true;
    });
    assert.equal(capturedResponse.status, 503);
    assert.match(capturedResponse.error, /not configured/i);
    assert.equal(continued, false);
  } finally {
    if (original.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.nodeEnv;
    if (original.siteKey === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = original.siteKey;
    if (original.secretKey === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = original.secretKey;
    if (original.allowedHostnames === undefined) delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
    else process.env.TURNSTILE_ALLOWED_HOSTNAMES = original.allowedHostnames;
  }
});
