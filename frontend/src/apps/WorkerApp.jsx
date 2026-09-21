import React, { useEffect, useState } from 'react';
import { WorkerAuthModal } from '../components/auth/WorkerAuthModal';
import { CashierWorkspace } from '../components/cashier/CashierWorkspace';
import { Icon } from '../components/common/Icons';
import { ManagerWorkspace } from '../components/manager/ManagerWorkspace';
import { WarehouseWorkspace } from '../components/warehouse/WarehouseWorkspace';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const WORKER_TOKEN_KEY = 'syncstock_worker_token';
const WORKER_USER_KEY = 'syncstock_worker_user';

const initialWorkspace = {
  products: [],
  categories: [],
  summary: {
    lowStockCount: 0,
    dailySales: 0,
    stockOnHand: 0,
    availableStock: 0,
    reservedUnits: 0,
    inventoryValue: 0,
    inventoryRetailValue: 0,
    grossMarginPct: 0,
    movementCount: 0,
    topProducts: [],
  },
  lowStockProducts: [],
  movements: [],
  receipts: [],
  cycleCounts: [],
  suppliers: [],
  purchaseOrders: [],
  supplierPerformance: [],
  forecasts: [],
  orders: [],
};

export default function WorkerApp() {
  const [theme, setTheme] = useState('dark');
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const clearWorkerSession = () => {
    setCurrentUser(null);
    setToken('');
    localStorage.removeItem(WORKER_TOKEN_KEY);
    localStorage.removeItem(WORKER_USER_KEY);
  };

  const fetchDemoAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/demo-accounts`);
      const data = await res.json();
      if (res.ok && data.users) {
        setDemoUsers(data.users.filter((user) => user.role !== 'ADMIN'));
      }
    } catch (err) {
      console.warn('API demo accounts offline', err);
    }
  };

  const fetchWorkspace = async () => {
    if (!token || !currentUser || currentUser.role === 'ADMIN') {
      setWorkspace(initialWorkspace);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/inventory/workspace`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setWorkspace(data);
      } else if (res.status === 401 || res.status === 403) {
        clearWorkerSession();
        setShowAuthModal(true);
      }
    } catch (err) {
      console.warn('Could not refresh workspace data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (user, newToken) => {
    if (user.role === 'ADMIN') {
      showToast('Admin accounts must use the admin portal.', 'error');
      return;
    }

    setCurrentUser(user);
    setToken(newToken);
    localStorage.setItem(WORKER_TOKEN_KEY, newToken);
    localStorage.setItem(WORKER_USER_KEY, JSON.stringify(user));
    showToast(`Logged in as ${user.name} (${user.employeeId})`, 'success');
  };

  const handleLogout = () => {
    clearWorkerSession();
    setShowAuthModal(true);
    showToast('You have signed out of your worker session', 'info');
  };

  const handleQuickSwitch = async (targetUser) => {
    if (!targetUser?.employeeId || targetUser.role === 'ADMIN') return;

    try {
      const res = await fetch(`${API_BASE}/api/auth/quick-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: targetUser.employeeId }),
      });
      const data = await res.json();
      if (res.ok && data.token && data.user?.role !== 'ADMIN') {
        setCurrentUser(data.user);
        setToken(data.token);
        localStorage.setItem(WORKER_TOKEN_KEY, data.token);
        localStorage.setItem(WORKER_USER_KEY, JSON.stringify(data.user));
        showToast(`Switched session to ${data.user.name} (${data.user.employeeId})`, 'info');
      }
    } catch (err) {
      console.warn('Could not switch worker profile', err);
    }
  };

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    fetchDemoAccounts();

    const savedToken = localStorage.getItem(WORKER_TOKEN_KEY);
    const savedUser = localStorage.getItem(WORKER_USER_KEY);
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser.role === 'ADMIN') {
          clearWorkerSession();
          return;
        }
        setToken(savedToken);
        setCurrentUser(parsedUser);
      } catch {
        clearWorkerSession();
      }
    }
  }, []);

  useEffect(() => {
    if (token && currentUser?.role !== 'ADMIN') {
      fetchWorkspace();
    }
  }, [token, currentUser?.role]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            SS
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.1 }}>
              SyncStock <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>2.0</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Worker Operations</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
            <span>{loading ? 'Syncing' : 'PostgreSQL Synced'}</span>
          </div>

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
                  background: currentUser.role === 'MANAGER' ? 'var(--primary)' : 'var(--success)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {currentUser.name ? currentUser.name.charAt(0) : 'U'}
              </div>
              <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{currentUser.name}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  <span className="form-input-mono">{currentUser.employeeId}</span> - {currentUser.role}
                </div>
              </div>

              {demoUsers.length > 0 && (
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '2px 6px', fontSize: '0.6875rem', marginLeft: '4px' }}
                  value={currentUser.employeeId}
                  onChange={(e) => {
                    const selected = demoUsers.find((user) => user.employeeId === e.target.value);
                    if (selected) handleQuickSwitch(selected);
                  }}
                >
                  {demoUsers.map((user) => (
                    <option key={user.employeeId} value={user.employeeId}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              )}

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
              <Icon name="lock" size={14} /> Worker Sign In
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
        {currentUser?.role === 'MANAGER' ? (
          <ManagerWorkspace workspace={workspace} apiBase={API_BASE} token={token} onRefresh={fetchWorkspace} onNotify={showToast} />
        ) : currentUser?.role === 'CASHIER' ? (
          <CashierWorkspace workspace={workspace} apiBase={API_BASE} token={token} currentUser={currentUser} onRefresh={fetchWorkspace} onNotify={showToast} />
        ) : currentUser?.role === 'WAREHOUSE_STAFF' ? (
          <WarehouseWorkspace workspace={workspace} apiBase={API_BASE} token={token} currentUser={currentUser} onRefresh={fetchWorkspace} onNotify={showToast} />
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <h2>Worker Operations</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Sign in with a manager, cashier, or warehouse account.</p>
            <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>
              <Icon name="lock" size={16} /> Open Worker Login
            </button>
          </div>
        )}
      </main>

      <WorkerAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLogin}
        demoUsers={demoUsers}
        apiBase={API_BASE}
        accessMode="worker"
      />
    </div>
  );
}
