import React, { useEffect, useState } from 'react';
import { AdminPortal } from '../components/admin/AdminPortal';
import { WorkerAuthModal } from '../components/auth/WorkerAuthModal';
import { Icon } from '../components/common/Icons';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const ADMIN_TOKEN_KEY = 'syncstock_admin_token';
const ADMIN_USER_KEY = 'syncstock_admin_user';

export default function AdminApp() {
  const [theme, setTheme] = useState('dark');
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const clearAdminSession = () => {
    setCurrentUser(null);
    setToken('');
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  };

  const handleLogin = async (user, newToken) => {
    if (user.role !== 'ADMIN') {
      showToast('Only administrator accounts can use the admin portal.', 'error');
      return;
    }

    setCurrentUser(user);
    setToken(newToken);
    localStorage.setItem(ADMIN_TOKEN_KEY, newToken);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    showToast(`Logged in as ${user.name} (${user.employeeId})`, 'success');
  };

  const handleLogout = () => {
    clearAdminSession();
    setShowAuthModal(true);
    showToast('You have signed out of the admin portal', 'info');
  };

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    const savedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const savedUser = localStorage.getItem(ADMIN_USER_KEY);
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser.role !== 'ADMIN') {
          clearAdminSession();
          return;
        }
        setToken(savedToken);
        setCurrentUser(parsedUser);
      } catch {
        clearAdminSession();
      }
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            AD
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.1 }}>
              SyncStock <span style={{ color: 'var(--purple)', fontSize: '0.75rem', fontWeight: 600 }}>Admin</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Employee Access Management</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px', borderRadius: 'var(--radius-md)' }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Dark/Light Mode"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>

          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-subtle)', padding: '4px 10px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--purple)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {currentUser.name ? currentUser.name.charAt(0) : 'A'}
              </div>
              <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{currentUser.name}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  <span className="form-input-mono">{currentUser.employeeId}</span> - ADMIN
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 6px', fontSize: '0.6875rem' }}
                onClick={handleLogout}
                title="Sign out"
              >
                <Icon name="log-out" size={14} />
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAuthModal(true)}>
              <Icon name="shield-check" size={14} /> Admin Sign In
            </button>
          )}
        </div>
      </header>

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '74px',
            right: '24px',
            zIndex: 999,
            padding: '12px 18px',
            background: toast.type === 'success' ? 'var(--success-light)' : toast.type === 'error' ? 'var(--danger-light)' : 'var(--bg-surface)',
            border: `1px solid ${toast.type === 'success' ? 'var(--success-border)' : toast.type === 'error' ? 'var(--danger-border)' : 'var(--border-color)'}`,
            color: toast.type === 'success' ? 'var(--success-text)' : toast.type === 'error' ? 'var(--danger-text)' : 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <Icon name={toast.type === 'success' ? 'check-circle' : toast.type === 'error' ? 'alert-triangle' : 'zap'} size={18} />
          {toast.message}
        </div>
      )}

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {currentUser?.role === 'ADMIN' ? (
          <AdminPortal apiBase={API_BASE} token={token} currentUser={currentUser} onNotify={showToast} />
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <h2>Admin Portal</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Sign in with an administrator account to manage employees and audit logs.</p>
            <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>
              <Icon name="shield-check" size={16} /> Open Admin Login
            </button>
          </div>
        )}
      </main>

      <WorkerAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLogin}
        apiBase={API_BASE}
        accessMode="admin"
      />
    </div>
  );
}
