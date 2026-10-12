import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { loadEnvironment } from '../../config/environment';
import { getCurrentPolicy, isPolicyEnforced } from '../../config/policies';
import { DEFAULT_COMPANY_ID, currentCompanyId } from '../../config/tenancy';

loadEnvironment();

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE_STAFF' | 'PROCUREMENT_STAFF';

export const permissionsForRole = (role: UserRole): string[] => {
  const permissions: Record<UserRole, string[]> = {
    ADMIN: ['company:read', 'company:manage', 'users:manage', 'policies:manage', 'inventory:manage', 'reports:read'],
    MANAGER: ['inventory:read', 'inventory:manage', 'sales:manage', 'procurement:manage', 'reports:read'],
    CASHIER: ['sales:manage', 'returns:manage'],
    WAREHOUSE_STAFF: ['inventory:read', 'inventory:manage', 'receiving:manage'],
    PROCUREMENT_STAFF: ['inventory:read', 'procurement:manage'],
  };
  return permissions[role] ?? [];
};

export type EmployeeSector =
  | 'Store Management'
  | 'Cashier & Front-of-House'
  | 'Warehouse & Logistics'
  | 'Procurement & Supply Chain'
  | 'System Administration';

export type UserStatus = 'ACTIVE' | 'PENDING_SETUP' | 'SUSPENDED' | 'DEACTIVATED';

export type User = {
  id: number;
  companyId: string;
  isPlatformAdmin: boolean;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  sector: EmployeeSector;
  status: UserStatus;
  isFirstLogin: boolean;
  mfaEnabled: boolean;
  emailVerified: boolean;
  mfaSecret?: string;
  lastLoginAt?: string;
  createdAt: string;
  password?: string;
  passwordHash?: string;
};

export type PublicUser = Omit<User, 'password' | 'passwordHash' | 'mfaSecret'>;

export type SecurityAuditLog = {
  id: string;
  companyId?: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  eventType:
  | 'USER_LOGIN'
  | 'FIRST_PASSWORD_SET'
  | 'USER_REGISTERED'
  | 'USER_ROLE_UPDATED'
  | 'USER_STATUS_UPDATED'
  | 'MFA_RESET'
  | 'EMAIL_CODE_SENT'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_RESET_TRIGGERED'
  | 'STOCK_OVERRIDE'
  | 'PO_APPROVED';
  targetUserId?: number | string;
  details: string;
  ipAddress?: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILURE';
};

export const securityAuditLogs: SecurityAuditLog[] = [
  {
    id: 'SEC-LOG-001',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    actor: 'admin@retail.local',
    actorRole: 'ADMIN',
    eventType: 'USER_REGISTERED',
    targetUserId: 'CSH-201',
    details: 'Registered Cashier Thandi Molefe in Cashier & Front-of-House sector',
    status: 'SUCCESS',
  },
  {
    id: 'SEC-LOG-002',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    actor: 'admin@retail.local',
    actorRole: 'ADMIN',
    eventType: 'USER_REGISTERED',
    targetUserId: 'NEW-501',
    details: 'Provisioned new employee account for Kego Ikaneng with PENDING_SETUP status',
    status: 'SUCCESS',
  },
];

let securityAuditWriter: ((log: SecurityAuditLog) => void) | undefined;

export const setSecurityAuditWriter = (writer: ((log: SecurityAuditLog) => void) | undefined): void => {
  securityAuditWriter = writer;
};

export const logSecurityEvent = (
  eventType: SecurityAuditLog['eventType'],
  actor: string,
  actorRole: string,
  details: string,
  targetUserId?: number | string,
  status: 'SUCCESS' | 'WARNING' | 'FAILURE' = 'SUCCESS'
): SecurityAuditLog => {
  const newLog: SecurityAuditLog = {
    id: `SEC-LOG-${randomUUID()}`,
    companyId: currentCompanyId(),
    timestamp: new Date().toISOString(),
    actor,
    actorRole,
    eventType,
    targetUserId,
    details,
    ipAddress: '127.0.0.1 (Internal Gateway)',
    status,
  };
  securityAuditLogs.unshift(newLog);
  securityAuditWriter?.(newLog);
  return newLog;
};

export const users: User[] = process.env.NODE_ENV === 'production' ? [] : [
  {
    id: 1,
    companyId: DEFAULT_COMPANY_ID,
    isPlatformAdmin: true,
    employeeId: 'ADM-001',
    name: 'Sibusiso Mathonsi',
    email: 'sibbs.agentmathonsi@gmail.com',
    role: 'ADMIN',
    sector: 'System Administration',
    status: 'ACTIVE',
    isFirstLogin: false,
    mfaEnabled: true,
    emailVerified: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    lastLoginAt: new Date().toISOString(),
    password: process.env.ADMIN_PASSWORD || '@Arg3nt2003',
  },
];

export const hydrateUsers = (storedUsers: Array<Record<string, any>>): void => {
  if (storedUsers.length === 0) return;
  users.splice(0, users.length, ...storedUsers.map((stored) => ({
    id: Number(stored.id),
    companyId: String(stored.companyId ?? DEFAULT_COMPANY_ID),
    isPlatformAdmin: Boolean(stored.isPlatformAdmin),
    employeeId: String(stored.employeeId),
    name: String(stored.name),
    email: String(stored.email),
    role: stored.role as UserRole,
    sector: stored.sector as EmployeeSector,
    status: stored.status as UserStatus,
    isFirstLogin: Boolean(stored.isFirstLogin),
    mfaEnabled: Boolean(stored.mfaEnabled),
    emailVerified: Boolean(stored.emailVerified),
    mfaSecret: stored.mfaSecret ?? undefined,
    lastLoginAt: stored.lastLoginAt ? new Date(stored.lastLoginAt).toISOString() : undefined,
    createdAt: stored.createdAt ? new Date(stored.createdAt).toISOString() : new Date().toISOString(),
    passwordHash: String(stored.passwordHash),
  })));
};

export const toPublicUser = (user: User): PublicUser => {
  const { password: _, passwordHash: __, mfaSecret: ___, ...publicUser } = user;
  return publicUser;
};

export const demoAccounts = (): PublicUser[] => users.map(toPublicUser);

export const getUsersByRole = (role: UserRole): PublicUser[] =>
  users.filter((u) => u.role === role).map(toPublicUser);

// OTP Verification In-Memory Store: email/employeeId -> { code, expiresAt }
const emailVerificationStore = new Map<string, { code: string; expiresAt: number }>();

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be set before signing or verifying tokens.');
  }
  return secret;
};

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
const mailer = smtpConfigured
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })
  : null;

export const generateToken = (user: PublicUser): string => {
  return jwt.sign(
    {
      id: user.id,
      companyId: user.companyId,
      isPlatformAdmin: user.isPlatformAdmin,
      permissions: permissionsForRole(user.role),
      employeeId: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role,
      sector: user.sector,
      isFirstLogin: user.isFirstLogin,
      emailVerified: user.emailVerified,
    },
    getJwtSecret(),
    {
      expiresIn: `${getCurrentPolicy(user.companyId).sessionDurationHours}h`,
    }
  );
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, getJwtSecret()) as {
    id: number;
    companyId: string;
    isPlatformAdmin: boolean;
    permissions: string[];
    employeeId: string;
    email: string;
    name: string;
    role: UserRole;
    sector: EmployeeSector;
    isFirstLogin: boolean;
    emailVerified: boolean;
  };
};

export const enrollMfa = (identifier: string): { secret: string; uri: string; user: PublicUser } | undefined => {
  const clean = identifier.trim().toLowerCase();
  const user = users.find((entry) => entry.employeeId.toLowerCase() === clean || entry.email.toLowerCase() === clean);
  if (!user) return undefined;
  const secret = generateSecret();
  user.mfaSecret = secret;
  user.mfaEnabled = false;
  return { secret, uri: generateURI({ issuer: 'SyncStock', label: user.email, secret }), user: toPublicUser(user) };
};

export const verifyMfa = (identifier: string, code: string): User | undefined => {
  const clean = identifier.trim().toLowerCase();
  const user = users.find((entry) => entry.employeeId.toLowerCase() === clean || entry.email.toLowerCase() === clean);
  if (!user?.mfaSecret || !/^\d{6}$/.test(code.trim())) return undefined;
  const result = verifySync({ token: code.trim(), secret: user.mfaSecret });
  if (!result.valid) return undefined;
  user.mfaEnabled = true;
  return user;
};

export const authenticateUser = (
  identifier: string,
  passwordAttempt: string,
  companyId?: string
): User | undefined => {
  const clean = identifier.trim().toLowerCase();
  const user = users.find((u) => (!companyId || u.companyId === companyId) && (u.employeeId.toLowerCase() === clean || u.email.toLowerCase() === clean));

  const passwordMatches = user?.passwordHash
    ? bcrypt.compareSync(passwordAttempt, user.passwordHash)
    : user?.password === passwordAttempt;
  if (!user || !passwordMatches) {
    return undefined;
  }

  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    return undefined;
  }

  user.lastLoginAt = new Date().toISOString();
  return user;
};

export const hasPermission = (userRole: UserRole, requiredRole: UserRole): boolean => {
  if (requiredRole === 'ADMIN' || userRole === 'ADMIN') {
    return userRole === requiredRole;
  }

  const rolePriority: Record<UserRole, number> = {
    ADMIN: 0,
    MANAGER: 3,
    CASHIER: 2,
    WAREHOUSE_STAFF: 1,
    PROCUREMENT_STAFF: 1,
  };

  return (rolePriority[userRole] ?? 0) >= (rolePriority[requiredRole] ?? 0);
};

export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!password || password.length < getCurrentPolicy().password.minimumLength) {
    errors.push(`Password must be at least ${getCurrentPolicy().password.minimumLength} characters long`);
  }
  if (getCurrentPolicy().password.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (getCurrentPolicy().password.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (getCurrentPolicy().password.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numerical digit');
  }
  if (getCurrentPolicy().password.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special symbol (!@#$%^&*)');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const generateEmployeeId = (sector: EmployeeSector): string => {
  const prefixMap: Record<EmployeeSector, string> = {
    'Store Management': 'MGR',
    'Cashier & Front-of-House': 'CSH',
    'Warehouse & Logistics': 'WRH',
    'Procurement & Supply Chain': 'PRC',
    'System Administration': 'ADM',
  };

  const prefix = prefixMap[sector] || 'STF';
  const sectorCount = users.filter((u) => u.sector === sector).length + 1;
  return `${prefix}-${String(sectorCount).padStart(3, '0')}`;
};

export const registerEmployee = (params: {
  name: string;
  email: string;
  role: UserRole;
  sector: EmployeeSector;
  tempPassword?: string;
  adminActor?: string;
  companyId?: string;
}): { success: boolean; user: PublicUser; generatedPassword: string; error?: string } => {
  const companyId = params.companyId ?? DEFAULT_COMPANY_ID;
  const existing = users.find((u) => u.companyId === companyId && u.email.toLowerCase() === params.email.toLowerCase());
  if (existing) {
    throw new Error(`An employee with email ${params.email} already exists`);
  }

  const generatedPassword = params.tempPassword || `Sync#${Math.floor(100000 + Math.random() * 900000)}!`;
  const employeeId = generateEmployeeId(params.sector);

  const newUser: User = {
    id: users.length + 1,
    companyId,
    isPlatformAdmin: false,
    employeeId,
    name: params.name.trim(),
    email: params.email.trim().toLowerCase(),
    role: params.role,
    sector: params.sector,
    status: getCurrentPolicy(companyId).password.firstLoginChangeRequired && isPolicyEnforced('first-login-password', companyId) ? 'PENDING_SETUP' : 'ACTIVE',
    isFirstLogin: getCurrentPolicy(companyId).password.firstLoginChangeRequired && isPolicyEnforced('first-login-password', companyId),
    mfaEnabled: false,
    emailVerified: false,
    createdAt: new Date().toISOString(),
    password: generatedPassword,
  };

  users.push(newUser);
  logSecurityEvent(
    'USER_REGISTERED',
    params.adminActor || 'admin',
    'ADMIN',
    `Registered new employee ${newUser.name} (${newUser.employeeId}) in ${newUser.sector} with ${newUser.status}`,
    newUser.employeeId
  );

  return { success: true, user: toPublicUser(newUser), generatedPassword };
};

export const setFirstPassword = (
  identifier: string,
  newPassword: string
): { success: boolean; user?: PublicUser; error?: string } => {
  const validation = validatePasswordStrength(newPassword);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(', ') };
  }

  const user = users.find(
    (u) => u.employeeId.toUpperCase() === identifier.trim().toUpperCase() || u.email.toLowerCase() === identifier.trim().toLowerCase()
  );

  if (!user) {
    return { success: false, error: 'Employee account not found' };
  }
  if (!user.isFirstLogin) {
    return { success: false, error: 'This account is not awaiting first-time password setup' };
  }

  user.password = newPassword;
  user.passwordHash = undefined;
  user.isFirstLogin = false;
  user.status = 'ACTIVE';

  logSecurityEvent(
    'FIRST_PASSWORD_SET',
    user.email,
    user.role,
    `Employee ${user.name} (${user.employeeId}) successfully set their permanent password and activated their account`,
    user.employeeId
  );

  return { success: true, user: toPublicUser(user) };
};

// Generate & Dispatch Email Verification Code (OTP)
export const sendEmailVerificationCode = (
  identifier: string
): { success: boolean; email?: string; code?: string; expiresAt?: string; error?: string } => {
  const clean = identifier.trim().toLowerCase();
  const user = users.find((u) => u.employeeId.toLowerCase() === clean || u.email.toLowerCase() === clean);

  if (!user) {
    return { success: false, error: `Employee not found for identifier "${identifier}"` };
  }

  // Generate 6-digit numeric verification code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  emailVerificationStore.set(user.email.toLowerCase(), { code, expiresAt });
  emailVerificationStore.set(user.employeeId.toLowerCase(), { code, expiresAt });

  console.log(`\n📧 [EMAIL DISPATCH SIMULATOR] =============================`);
  console.log(`To: ${user.name} <${user.email}>`);
  console.log(`Subject: SyncStock Security: Your Verification Code`);
  console.log(`Code: ${code} (Expires in 10 minutes)`);
  console.log(`===========================================================\n`);

  logSecurityEvent(
    'EMAIL_CODE_SENT',
    'system',
    'SYSTEM',
    `Sent 6-digit email confirmation code to ${user.email} (${user.employeeId})`,
    user.employeeId
  );

  return {
    success: true,
    email: user.email,
    code,
    expiresAt: new Date(expiresAt).toISOString(),
  };
};

export const dispatchEmailVerificationCode = async (identifier: string, code: string): Promise<void> => {
  if (!mailer) {
    return;
  }

  const clean = identifier.trim().toLowerCase();
  const user = users.find((entry) => entry.employeeId.toLowerCase() === clean || entry.email.toLowerCase() === clean);
  if (!user) {
    throw new Error('Employee not found');
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: user.email,
    subject: 'SyncStock email verification code',
    text: `Your SyncStock verification code is ${code}. It expires in 10 minutes and can only be used once.`,
  });
};

// Validate 6-Digit Email Verification Code
export const verifyEmailCode = (
  identifier: string,
  code: string
): { success: boolean; user?: PublicUser; error?: string } => {
  const clean = identifier.trim().toLowerCase();
  const user = users.find((u) => u.employeeId.toLowerCase() === clean || u.email.toLowerCase() === clean);

  if (!user) {
    return { success: false, error: 'Employee not found' };
  }

  const stored = emailVerificationStore.get(user.email.toLowerCase()) || emailVerificationStore.get(user.employeeId.toLowerCase());

  if (!stored) {
    return { success: false, error: 'No verification code was requested or code has expired. Please send a new code.' };
  }

  if (Date.now() > stored.expiresAt) {
    emailVerificationStore.delete(user.email.toLowerCase());
    return { success: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if (stored.code !== code.trim()) {
    return { success: false, error: 'Invalid 6-digit code. Please check your email and try again.' };
  }

  // Mark as verified
  user.emailVerified = true;
  emailVerificationStore.delete(user.email.toLowerCase());
  emailVerificationStore.delete(user.employeeId.toLowerCase());

  logSecurityEvent(
    'EMAIL_VERIFIED',
    user.email,
    user.role,
    `Email address confirmed & verified for ${user.name} (${user.employeeId})`,
    user.employeeId
  );

  return { success: true, user: toPublicUser(user) };
};
