import { currentCompanyId, DEFAULT_COMPANY_ID } from './tenancy';

export type PolicyControlStatus = 'ENFORCED' | 'RECOMMENDED' | 'REQUIRES_DEPLOYMENT' | 'DISABLED';

export type SystemPolicy = {
  version: string;
  effectiveDate: string;
  owner: string;
  reviewDate: string;
  currency: string;
  vatRate: number;
  sessionDurationHours: number;
  tlsStatus: 'CONFIGURED' | 'REQUIRES_DEPLOYMENT';
  password: {
    minimumLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
    firstLoginChangeRequired: boolean;
  };
  controls: Array<{
    id: string;
    name: string;
    description: string;
    status: PolicyControlStatus;
  }>;
  history: Array<{ version: string; changedAt: string; changedBy: string; summary: string }>;
};

export const systemPolicy: SystemPolicy = {
  version: '1.3',
  effectiveDate: '2026-10-01',
  owner: 'System Administration',
  reviewDate: '2027-01-01',
  currency: 'ZAR',
  vatRate: 15,
  sessionDurationHours: 8,
  tlsStatus: 'REQUIRES_DEPLOYMENT',
  password: {
    minimumLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    firstLoginChangeRequired: true,
  },
  controls: [
    { id: 'first-login-password', name: 'First-login password change', description: 'New employees must replace their temporary password.', status: 'ENFORCED' },
    { id: 'negative-inventory', name: 'Negative inventory prevention', description: 'Sales cannot exceed available stock.', status: 'ENFORCED' },
    { id: 'returns-verification', name: 'Return verification', description: 'Returns require a receipt and item verification.', status: 'ENFORCED' },
    { id: 'mfa-enrollment', name: 'MFA enrollment', description: 'Administrators should enroll an authenticator device.', status: 'RECOMMENDED' },
    { id: 'tls-edge', name: 'TLS at deployment edge', description: 'Terminate HTTPS at the trusted reverse proxy or load balancer.', status: 'REQUIRES_DEPLOYMENT' },
  ],
  history: [
    { version: '1.3', changedAt: '2026-10-01', changedBy: 'System Administration', summary: 'Added explicit control ownership and deployment status.' },
    { version: '1.2', changedAt: '2026-07-01', changedBy: 'System Administration', summary: 'Reviewed access and inventory controls.' },
  ],
};

const policyByCompany = new Map<string, SystemPolicy>([[DEFAULT_COMPANY_ID, systemPolicy]]);

export const getCurrentPolicy = (companyId = currentCompanyId()): SystemPolicy => {
  const existing = policyByCompany.get(companyId);
  if (existing) return existing;
  const copy: SystemPolicy = JSON.parse(JSON.stringify(systemPolicy));
  policyByCompany.set(companyId, copy);
  return copy;
};

export const hydratePolicies = (records: Array<{ companyId: string; configuration: SystemPolicy }>): void => {
  for (const record of records) policyByCompany.set(record.companyId, record.configuration);
};

export const updateSystemPolicy = (
  changes: Partial<SystemPolicy>,
  changedBy: string,
  companyId = currentCompanyId(),
): SystemPolicy => {
  const policy = getCurrentPolicy(companyId);
  const nextVersion = `1.${Number(policy.version.split('.')[1] || 0) + 1}`;
  const nextPolicy: SystemPolicy = {
    ...policy,
    ...changes,
    password: { ...policy.password, ...changes.password },
    controls: changes.controls
      ? policy.controls.map((control) => ({
        ...control,
        status: changes.controls?.find((candidate) => candidate.id === control.id)?.status ?? control.status,
      }))
      : policy.controls,
  };
  nextPolicy.password.firstLoginChangeRequired = nextPolicy.controls
    .some((control) => control.id === 'first-login-password' && control.status === 'ENFORCED');
  Object.assign(nextPolicy, {
    version: nextVersion,
    effectiveDate: new Date().toISOString().slice(0, 10),
    history: [
      { version: nextVersion, changedAt: new Date().toISOString(), changedBy, summary: 'Policy configuration updated by an administrator.' },
      ...policy.history,
    ],
  });
  return nextPolicy;
};

export const setCurrentPolicy = (companyId: string, policy: SystemPolicy): void => {
  policyByCompany.set(companyId, policy);
};

export const isPolicyEnforced = (controlId: string, companyId?: string): boolean =>
  getCurrentPolicy(companyId).controls.some((control) => control.id === controlId && control.status === 'ENFORCED');
