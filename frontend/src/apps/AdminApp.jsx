import React, { useEffect, useState } from 'react';
import { AdminPortal } from '../components/admin/AdminPortal';
import { WorkerAuthModal } from '../components/auth/WorkerAuthModal';
import { Icon } from '../components/common/Icons';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const ADMIN_TOKEN_KEY = 'syncstock_admin_token';
const ADMIN_USER_KEY = 'syncstock_admin_user';

export default function AdminApp() {
  const [theme, setTheme] = useState('dark');
  const [isBooting, setIsBooting] = useState(true);
  const [headerCompact, setHeaderCompact] = useState(false);
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

  const handleSessionExpired = () => {
    clearAdminSession();
    setShowAuthModal(true);
    showToast('Your admin session expired. Please sign in again.', 'error');
  };

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setIsBooting(false), 850);
    const handleScroll = () => setHeaderCompact(window.scrollY > 18);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.clearTimeout(bootTimer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
    <div className={`admin-app worker-app ${headerCompact ? 'header-compact' : ''}`}>
      {isBooting && (
        <div className="boot-screen" role="status" aria-live="polite">
          <div className="boot-mark boot-mark-icon"><Icon name="shield-check" size={22} /></div>
          <div className="boot-copy">
            <span>SyncStock Admin</span>
            <small>Securing governance console</small>
          </div>
          <div className="boot-progress"><span /></div>
        </div>

      )}

      <header className={`app-header ${headerCompact ? 'is-compact' : ''}`}>
        <div className="app-brand">
          <div className="app-brand-mark app-brand-mark-icon"><Icon name="shield-check" size={20} /></div>
          <div>
            <div className="app-brand-name">SyncStock <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>Admin</span></div>
            <div className="app-brand-caption">Employee access / Governance</div>
          </div>
        </div>

        <div className="app-header-actions">
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
        <div className={`toast toast-${toast.type}`}>
          <Icon name={toast.type === 'success' ? 'check-circle' : toast.type === 'error' ? 'alert-triangle' : 'zap'} size={18} />
          {toast.message}
        </div>
      )}

      <main className="app-main">
        {currentUser?.role === 'ADMIN' ? (
          <AdminPortal apiBase={API_BASE} token={token} currentUser={currentUser} onNotify={showToast} onSessionExpired={handleSessionExpired} />
        ) : (
          <div className="welcome-panel admin-welcome">
            <div className="welcome-grid" aria-hidden="true" />
            <div className="welcome-copy">
              <span className="eyebrow"><span className="eyebrow-line" /> Governance and access</span>
              <h1>Keep every<br /><em>door accountable.</em></h1>
              <p>Manage employee access, warehouse ownership, and the audit trail behind every operational decision.</p>
              <button className="btn btn-primary btn-lg" onClick={() => setShowAuthModal(true)}>
                <Icon name="shield-check" size={16} /> Open Admin Login
              </button>
            </div>
            <div className="welcome-signal" aria-hidden="true">
              <span>SECURITY / TIER 1</span>
              <strong>LOCKED</strong>
              <i />
            </div>
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
