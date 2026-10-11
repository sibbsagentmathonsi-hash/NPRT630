import { AsyncLocalStorage } from 'node:async_hooks';

export const DEFAULT_COMPANY_ID = 'company-default';

const tenantStorage = new AsyncLocalStorage<string>();

export const currentCompanyId = (): string => tenantStorage.getStore() ?? DEFAULT_COMPANY_ID;
export const runInCompany = (companyId: string, callback: () => void): void => tenantStorage.run(companyId, callback);
export const belongsToCompany = (companyId?: string): boolean => (companyId ?? DEFAULT_COMPANY_ID) === currentCompanyId();

export type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type Company = {
  id: string;
  legalName: string;
  tradingName: string;
  registrationNumber?: string;
  taxNumber?: string;
  currency: string;
  timezone: string;
  subscriptionStatus: CompanyStatus;
  createdAt: string;
};

export const defaultCompany: Company = {
  id: DEFAULT_COMPANY_ID,
  legalName: 'SyncStock Demo Company (Pty) Ltd',
  tradingName: 'SyncStock Demo',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
  subscriptionStatus: 'ACTIVE',
  createdAt: '2026-01-01T08:00:00.000Z',
};

export const companies: Company[] = [defaultCompany];

export const getCompany = (companyId: string): Company | undefined => companies.find((company) => company.id === companyId);

export const createCompany = (input: Pick<Company, 'legalName' | 'tradingName' | 'currency' | 'timezone'> & Partial<Pick<Company, 'registrationNumber' | 'taxNumber'>>): Company => {
  const id = `company-${Date.now().toString(36)}`;
  const company: Company = {
    id,
    legalName: input.legalName.trim(),
    tradingName: input.tradingName.trim(),
    registrationNumber: input.registrationNumber?.trim(),
    taxNumber: input.taxNumber?.trim(),
    currency: input.currency,
    timezone: input.timezone,
    subscriptionStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  companies.push(company);
  return company;
};
