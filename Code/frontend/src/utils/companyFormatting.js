const DEFAULT_CURRENCY = 'ZAR';
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';

export const formatCurrency = (amount, currency = DEFAULT_CURRENCY) => {
  const code = /^[A-Z]{3}$/.test(String(currency)) ? String(currency) : DEFAULT_CURRENCY;
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: code,
  }).format(Number(amount) || 0);
};

const validTimezone = (timezone) => {
  try {
    new Intl.DateTimeFormat('en-ZA', { timeZone: timezone }).format();
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

export const formatCompanyDateTime = (value, timezone = DEFAULT_TIMEZONE) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: validTimezone(timezone),
  }).format(date);
};

export const formatCompanyTime = (value, timezone = DEFAULT_TIMEZONE) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: validTimezone(timezone),
  }).format(date);
};

export const formatCompanyDate = (value, timezone = DEFAULT_TIMEZONE) => {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const date = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeZone: dateOnly ? 'UTC' : validTimezone(timezone),
  }).format(date);
};
