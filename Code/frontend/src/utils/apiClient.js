let csrfToken = null;

export const setCsrfToken = (token) => {
  csrfToken = typeof token === 'string' && token.length > 0 ? token : null;
};

export const clearCsrfToken = () => {
  csrfToken = null;
};

export const apiFetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  headers.delete('Authorization');

  const method = (init.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
};
