import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authenticateUser,
  generateToken,
  hasPermission,
  sendEmailVerificationCode,
  verifyEmailCode,
  type UserRole,
} from './auth';

test('admin can log in with sibbs.agentmathonsi@gmail.com and EMP-ADM-001', () => {
  const byEmail = authenticateUser('sibbs.agentmathonsi@gmail.com', '@Arg3nt2003');
  assert.ok(byEmail);
  assert.equal(byEmail.employeeId, 'EMP-ADM-001');
  assert.equal(byEmail.role, 'ADMIN');

  const byId = authenticateUser('EMP-ADM-001', '@Arg3nt2003');
  assert.ok(byId);
  assert.equal(byId.email, 'sibbs.agentmathonsi@gmail.com');
});

test('generateToken returns a usable signed token for a user', () => {
  const token = generateToken({
    id: 1,
    employeeId: 'EMP-ADM-001',
    name: 'Sibusiso Mathonsi',
    email: 'sibbs.agentmathonsi@gmail.com',
    role: 'ADMIN',
    sector: 'System Administration',
    status: 'ACTIVE',
    isFirstLogin: false,
    mfaEnabled: true,
    emailVerified: true,
    createdAt: '2026-01-01T08:00:00.000Z',
  });
  assert.ok(token.length > 20);
});

test('hasPermission allows matching role access', () => {
  const allowed = hasPermission('ADMIN', 'ADMIN' as UserRole);
  assert.equal(allowed, true);
});

test('hasPermission keeps admin separate from worker operations', () => {
  const denied = hasPermission('ADMIN', 'MANAGER' as UserRole);
  assert.equal(denied, false);
});

test('hasPermission denies lower role access', () => {
  const denied = hasPermission('CASHIER', 'MANAGER' as UserRole);
  assert.equal(denied, false);
});

test('sendEmailVerificationCode generates and dispatches 6-digit OTP for admin', () => {
  const result = sendEmailVerificationCode('EMP-ADM-001');
  assert.equal(result.success, true);
  assert.ok(result.code && result.code.length === 6);
  assert.equal(result.email, 'sibbs.agentmathonsi@gmail.com');
});

test('verifyEmailCode confirms email and updates user verification status', () => {
  const sendRes = sendEmailVerificationCode('EMP-ADM-001');
  assert.ok(sendRes.code);

  const verifyRes = verifyEmailCode('EMP-ADM-001', sendRes.code);
  assert.equal(verifyRes.success, true);
  assert.equal(verifyRes.user?.emailVerified, true);
});
