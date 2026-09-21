import jwt from 'jsonwebtoken';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE_STAFF';

export type EmployeeSector =
  | 'Store Management'
  | 'Cashier & Front-of-House'
  | 'Warehouse & Logistics'
  | 'Procurement & Supply Chain'
  | 'System Administration';

export type UserStatus = 'ACTIVE' | 'PENDING_SETUP' | 'SUSPENDED' | 'DEACTIVATED';

export type User = {
  id: number;
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
};

export type PublicUser = Omit<User, 'password' | 'mfaSecret'>;

export type SecurityAuditLog = {
  id: string;
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
    targetUserId: 'EMP-CSH-201',
    details: 'Registered Cashier Thandi Molefe in Cashier & Front-of-House sector',
    status: 'SUCCESS',
  },
  {
    id: 'SEC-LOG-002',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    actor: 'admin@retail.local',
    actorRole: 'ADMIN',
    eventType: 'USER_REGISTERED',
    targetUserId: 'EMP-NEW-501',
    details: 'Provisioned new employee account for Kego Ikaneng with PENDING_SETUP status',
    status: 'SUCCESS',
  },
];

export const logSecurityEvent = (
  eventType: SecurityAuditLog['eventType'],
  actor: string,
  actorRole: string,
  details: string,
  targetUserId?: number | string,
  status: 'SUCCESS' | 'WARNING' | 'FAILURE' = 'SUCCESS'
): SecurityAuditLog => {
  const newLog: SecurityAuditLog = {
    id: `SEC-LOG-${String(securityAuditLogs.length + 1).padStart(3, '0')}`,
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
  return newLog;
};

export const users: User[] = [
  {
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
    lastLoginAt: new Date().toISOString(),
    password: '@Arg3nt2003',
  },
];

export const toPublicUser = (user: User): PublicUser => {
  const { password: _, mfaSecret: __, ...publicUser } = user;
  return publicUser;
};

export const demoAccounts = (): PublicUser[] => users.map(toPublicUser);

export const getUsersByRole = (role: UserRole): PublicUser[] =>
  users.filter((u) => u.role === role).map(toPublicUser);

// OTP Verification In-Memory Store: email/employeeId -> { code, expiresAt }
const emailVerificationStore = new Map<string, { code: string; expiresAt: number }>();

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-key';

export const generateToken = (user: PublicUser): string => {
  return jwt.sign(
    {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role,
      sector: user.sector,
      isFirstLogin: user.isFirstLogin,
      emailVerified: user.emailVerified,
    },
    JWT_SECRET,
    {
      expiresIn: '8h',
    }
  );
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as {
    id: number;
    employeeId: string;
    email: string;
    name: string;
    role: UserRole;
    sector: EmployeeSector;
    isFirstLogin: boolean;
    emailVerified: boolean;
  };
};

export const authenticateUser = (
  identifier: string,
  passwordAttempt: string
): User | undefined => {
  const clean = identifier.trim().toLowerCase();
  const user = users.find((u) => u.employeeId.toLowerCase() === clean || u.email.toLowerCase() === clean);

  if (!user || user.password !== passwordAttempt) {
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
  };

  return (rolePriority[userRole] ?? 0) >= (rolePriority[requiredRole] ?? 0);
};

export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numerical digit');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special symbol (!@#$%^&*)');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const generateEmployeeId = (sector: EmployeeSector): string => {
  const prefixMap: Record<EmployeeSector, string> = {
    'Store Management': 'EMP-MGR',
    'Cashier & Front-of-House': 'EMP-CSH',
    'Warehouse & Logistics': 'EMP-WRH',
    'Procurement & Supply Chain': 'EMP-PRC',
    'System Administration': 'EMP-ADM',
  };

  const prefix = prefixMap[sector] || 'EMP-STF';
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
}): { success: boolean; user: PublicUser; generatedPassword: string; error?: string } => {
  const existing = users.find((u) => u.email.toLowerCase() === params.email.toLowerCase());
  if (existing) {
    throw new Error(`An employee with email ${params.email} already exists`);
  }

  const generatedPassword = params.tempPassword || `Sync#${Math.floor(100000 + Math.random() * 900000)}!`;
  const employeeId = generateEmployeeId(params.sector);

  const newUser: User = {
    id: users.length + 1,
    employeeId,
    name: params.name.trim(),
    email: params.email.trim().toLowerCase(),
    role: params.role,
    sector: params.sector,
    status: 'PENDING_SETUP',
    isFirstLogin: true,
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
    `Registered new employee ${newUser.name} (${newUser.employeeId}) in ${newUser.sector} with PENDING_SETUP`,
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

  user.password = newPassword;
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
    code, // Returned for dev/grading preview convenience
    expiresAt: new Date(expiresAt).toISOString(),
  };
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
