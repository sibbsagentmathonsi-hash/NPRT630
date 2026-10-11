import React, { useEffect, useState } from 'react';
import { AdminPortal } from '../components/admin/AdminPortal';
import { WorkerAuthModal } from '../components/auth/WorkerAuthModal';
import { BrandLogo } from '../components/common/BrandLogo';
import { AppSidebar } from '../components/common/AppSidebar';
import { Icon } from '../components/common/Icons';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const ADMIN_TOKEN_KEY = 'syncstock_admin_token';
const ADMIN_USER_KEY = 'syncstock_admin_user';
const WORKER_TOKEN_KEY = 'syncstock_worker_token';
const WORKER_USER_KEY = 'syncstock_worker_user';

const normalizeEmployeeId = (value) => {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/^EMP-/i, '');
};

const normalizeStoredUser = (user) => {
  if (!user) return user;
  return {
    ...user,
    employeeId: normalizeEmployeeId(user.employeeId),
  };
};

export default function AdminApp() {
  const [theme, setTheme] = useState('light');
  const [isBooting, setIsBooting] = useState(true);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeNav, setActiveNav] = useState('employees');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const clearAdminSession = () => {
    setCurrentUser(null);
    setToken('');
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.removeItem(WORKER_TOKEN_KEY);
    localStorage.removeItem(WORKER_USER_KEY);
  };

  const handleLogin = async (user, newToken) => {
    if (user.role !== 'ADMIN') {
      showToast('Only administrator accounts can use the admin portal.', 'error');
      return;
    }

    const normalizedUser = normalizeStoredUser(user);

    setCurrentUser(normalizedUser);
    setToken(newToken);
    localStorage.setItem(ADMIN_TOKEN_KEY, newToken);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(normalizedUser));
    showToast(`Logged in as ${normalizedUser.name} (${normalizedUser.employeeId})`, 'success');
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
        const parsedUser = normalizeStoredUser(JSON.parse(savedUser));
        if (parsedUser.role !== 'ADMIN') {
          clearAdminSession();
          return;
        }
        setToken(savedToken);
        setCurrentUser(parsedUser);
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(parsedUser));
        fetch(`${API_BASE}/api/admin/platform-status`, { headers: { Authorization: `Bearer ${savedToken}` } })
          .then((res) => (res.ok ? res.json() : null))
          .then((status) => {
            if (!status) return;
            setCurrentUser((user) => {
              const refreshed = { ...user, isPlatformAdmin: Boolean(status.isPlatformAdmin) };
              localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(refreshed));
              return refreshed;
            });
          })
          .catch(() => {});
      } catch {
        clearAdminSession();
      }
    }
  }, []);

  return (
    <div className={`admin-app worker-app ${headerCompact ? 'header-compact' : ''}`}>
      {isBooting && (
        <div className="boot-screen" role="status" aria-live="polite">
          <BrandLogo size={44} variant="admin" />
          <div className="boot-copy">
            <span>SyncStock Admin</span>
            <small>Securing governance console</small>
          </div>
          <div className="boot-progress"><span /></div>
        </div>

      )}

      <header className={`app-header ${headerCompact ? 'is-compact' : ''}`}>
        <div className="app-brand">
          <BrandLogo size={36} variant="admin" />
          <div className="app-brand-copy">
            <div className="app-brand-name">SyncStock</div>
            <div className="app-brand-caption">Admin</div>
          </div>
        </div>

        <div className="app-header-actions">
          <button
            className="btn btn-secondary btn-sm header-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Dark/Light Mode"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>

          {currentUser ? (
            <div className="header-user-card">
              <div className="header-user-avatar">
                {currentUser.name ? currentUser.name.charAt(0) : 'A'}
              </div>
              <div className="header-user-meta">
                <div className="header-user-name">{currentUser.name}</div>
                <div className="header-user-role">
                  <span className="form-input-mono employee-id-inline">{currentUser.employeeId}</span> · ADMIN
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm header-signout"
                onClick={handleLogout}
                title="Sign out"
              >
                <Icon name="log-out" size={14} />
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm header-signin" onClick={() => setShowAuthModal(true)}>
              <Icon name="shield-check" size={14} /> Sign in
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

      <div className="app-layout">
        {currentUser && <AppSidebar role="ADMIN" platformAdmin={currentUser.isPlatformAdmin} activeItem={activeNav} onNavigate={setActiveNav} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />}
        <main className={`app-main ${currentUser ? 'has-sidebar' : ''}`}>
        {currentUser?.role === 'ADMIN' ? (
          <AdminPortal apiBase={API_BASE} token={token} currentUser={currentUser} onNotify={showToast} onSessionExpired={handleSessionExpired} initialTab={activeNav} />
        ) : (
          <div className="welcome-panel admin-welcome">
            <div className="welcome-grid" aria-hidden="true" />
            <div className="welcome-copy">
              <span className="eyebrow"><span className="eyebrow-line" /> Governance and access</span>
              <h1>Protect the<br /><em>chain of custody.</em></h1>
              <p>Manage employee access, warehouse ownership, and the audit trail behind every decision that moves stock from receipt to shelf.</p>
              <button className="btn btn-primary btn-lg" onClick={() => setShowAuthModal(true)}>
                <Icon name="shield-check" size={16} /> Open Admin Login
              </button>
            </div>
            <div className="welcome-signal" aria-hidden="true">
              <span>SECURITY / TIER 1</span>
              <strong>MONITORED</strong>
              <i />
            </div>
          </div>
        )}
        </main>
      </div>

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
