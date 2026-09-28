import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSync } from 'otplib';

import {
  authenticateUser,
  enrollMfa,
  generateToken,
  hasPermission,
  registerEmployee,
  sendEmailVerificationCode,
  setFirstPassword,
  toPublicUser,
  validatePasswordStrength,
  verifyEmailCode,
  verifyMfa,
  verifyToken,
  type PublicUser,
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

test('authenticateUser rejects incorrect password and nonexistent user', () => {
  const wrongPass = authenticateUser('sibbs.agentmathonsi@gmail.com', 'WrongPassword123!');
  assert.equal(wrongPass, undefined);

  const wrongUser = authenticateUser('nonexistent@domain.com', '@Arg3nt2003');
  assert.equal(wrongUser, undefined);
});

test('generateToken returns a usable signed token for a user', () => {
  const admin = authenticateUser('EMP-ADM-001', '@Arg3nt2003');
  assert.ok(admin);
  const user = toPublicUser(admin);
  const token = generateToken(user);
  assert.ok(token.length > 20);

  const payload = verifyToken(token);
  assert.equal(payload.employeeId, 'EMP-ADM-001');
  assert.equal(payload.email, 'sibbs.agentmathonsi@gmail.com');
  assert.equal(payload.role, 'ADMIN');
});

test('verifyToken throws on corrupted or tampered token', () => {
  assert.throws(() => verifyToken('invalid.token.here'));
});

test('hasPermission enforces role hierarchy and admin isolation', () => {
  assert.equal(hasPermission('ADMIN', 'ADMIN'), true);
  assert.equal(hasPermission('ADMIN', 'MANAGER'), false);
  assert.equal(hasPermission('MANAGER', 'CASHIER'), true);
  assert.equal(hasPermission('MANAGER', 'WAREHOUSE_STAFF'), true);
  assert.equal(hasPermission('CASHIER', 'MANAGER'), false);
  assert.equal(hasPermission('WAREHOUSE_STAFF', 'MANAGER'), false);
  assert.equal(hasPermission('PROCUREMENT_STAFF', 'WAREHOUSE_STAFF'), true);
});

test('validatePasswordStrength checks length, casing, numbers, and special characters', () => {
  const tooShort = validatePasswordStrength('Ab1!');
  assert.equal(tooShort.isValid, false);
  assert.ok(tooShort.errors.some((e) => e.includes('8 characters')));

  const noUpper = validatePasswordStrength('lowercase123!');
  assert.equal(noUpper.isValid, false);
  assert.ok(noUpper.errors.some((e) => e.includes('uppercase')));

  const noNumber = validatePasswordStrength('NoNumbersHere!');
  assert.equal(noNumber.isValid, false);
  assert.ok(noNumber.errors.some((e) => e.includes('digit')));

  const noSpecial = validatePasswordStrength('ValidPassword123');
  assert.equal(noSpecial.isValid, false);
  assert.ok(noSpecial.errors.some((e) => e.includes('special symbol') || e.includes('special character')));

  const strong = validatePasswordStrength('SuperSecurePass2026!');
  assert.equal(strong.isValid, true);
  assert.equal(strong.errors.length, 0);
});

test('registerEmployee generates sector-specific IDs and sets initial state', () => {
  const reg1 = registerEmployee({
    name: 'Bongani Sithole',
    email: 'bongani@store.local',
    role: 'MANAGER',
    sector: 'Store Management',
    adminActor: 'sibbs.agentmathonsi@gmail.com',
  });
  assert.equal(reg1.success, true);
  assert.ok(reg1.user?.employeeId.startsWith('EMP-MGR-'));
  assert.equal(reg1.user?.status, 'PENDING_SETUP');
  assert.equal(reg1.user?.isFirstLogin, true);

  const reg2 = registerEmployee({
    name: 'Zola Mthembu',
    email: 'zola@cashier.local',
    role: 'CASHIER',
    sector: 'Cashier & Front-of-House',
    adminActor: 'sibbs.agentmathonsi@gmail.com',
  });
  assert.equal(reg2.success, true);
  assert.ok(reg2.user?.employeeId.startsWith('EMP-CSH-'));

  // Disallow duplicate email
  assert.throws(
    () =>
      registerEmployee({
        name: 'Duplicate Test',
        email: 'bongani@store.local',
        role: 'CASHIER',
        sector: 'Cashier & Front-of-House',
      }),
    /already exists/
  );
});

test('setFirstPassword activates newly registered user', () => {
  const reg = registerEmployee({
    name: 'First Password Tester',
    email: 'firstpass@test.local',
    role: 'WAREHOUSE_STAFF',
    sector: 'Warehouse & Logistics',
  });
  assert.ok(reg.user);

  const update = setFirstPassword(reg.user.employeeId, 'BrandNewP@ssw0rd2026!');
  assert.equal(update.success, true);
  assert.equal(update.user?.status, 'ACTIVE');
  assert.equal(update.user?.isFirstLogin, false);

  const login = authenticateUser(reg.user.employeeId, 'BrandNewP@ssw0rd2026!');
  assert.ok(login);
  assert.equal(login.status, 'ACTIVE');
});

test('toPublicUser strips password field', () => {
  const user = authenticateUser('EMP-ADM-001', '@Arg3nt2003');
  assert.ok(user);
  assert.ok('password' in user);

  const pub = toPublicUser(user);
  assert.equal('password' in pub, false);
  assert.equal(pub.email, user.email);
  assert.equal(pub.employeeId, user.employeeId);
});

test('sendEmailVerificationCode and verifyEmailCode workflow', () => {
  const sendRes = sendEmailVerificationCode('EMP-ADM-001');
  assert.equal(sendRes.success, true);
  assert.ok(sendRes.code && sendRes.code.length === 6);
  assert.equal(sendRes.email, 'sibbs.agentmathonsi@gmail.com');

  // Wrong code fails
  const wrongRes = verifyEmailCode('EMP-ADM-001', '000000');
  assert.equal(wrongRes.success, false);

  // Correct code succeeds
  const verifyRes = verifyEmailCode('EMP-ADM-001', sendRes.code);
  assert.equal(verifyRes.success, true);
  assert.equal(verifyRes.user?.emailVerified, true);
});

test('enrollMfa and verifyMfa validate authentic TOTP codes', () => {
  const enrollment = enrollMfa('EMP-ADM-001');
  assert.ok(enrollment);
  assert.ok(enrollment.secret);
  assert.ok(enrollment.uri.startsWith('otpauth://totp/'));

  // Invalid 6-digit code fails
  const invalid = verifyMfa('EMP-ADM-001', '999999');
  assert.equal(invalid, undefined);

  // Valid TOTP generated with secret succeeds
  const validOtp = generateSync({ secret: enrollment.secret });
  const verifiedUser = verifyMfa('EMP-ADM-001', validOtp);
  assert.ok(verifiedUser);
  assert.equal(verifiedUser.mfaEnabled, true);
});
