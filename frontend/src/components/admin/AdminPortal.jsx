import React, { useState, useEffect } from 'react';
import { Icon } from '../common/Icons';

const sectorsList = [
  'Store Management',
  'Cashier & Front-of-House',
  'Warehouse & Logistics',
  'Procurement & Supply Chain',
  'System Administration',
];

const rolesList = [
  { role: 'ADMIN', label: 'Admin (Full Privileges)' },
  { role: 'MANAGER', label: 'Store Manager (Analytics & PO Approval)' },
  { role: 'CASHIER', label: 'Cashier (POS & Returns)' },
  { role: 'WAREHOUSE_STAFF', label: 'Warehouse Staff (Receiving & Audits)' },
];

export const AdminPortal = ({ apiBase, token, currentUser, onNotify, onSessionExpired }) => {
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'warehouses' | 'audit-logs' | 'policies'
  const [employees, setEmployees] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');

  // Registration Form State
  const [showRegModal, setShowRegModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSector, setRegSector] = useState(sectorsList[1]);
  const [regRole, setRegRole] = useState('CASHIER');
  const [regTempPass, setRegTempPass] = useState('TempPass123!');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccessData, setRegSuccessData] = useState(null);

  // Warehouse configuration mock data
  const [warehouses, setWarehouses] = useState([
    {
      id: 'JHB-01',
      name: 'Johannesburg Central Distribution Hub',
      city: 'Johannesburg, Gauteng',
      binsCount: 48,
      activeSkus: 8,
      capacityPct: 78,
      supervisor: 'Jayden Khoza (EMP-MGR-101)',
      status: 'OPERATIONAL',
    },
    {
      id: 'CPT-02',
      name: 'Cape Town Coastal Fulfillment Facility',
      city: 'Cape Town, Western Cape',
      binsCount: 36,
      activeSkus: 5,
      capacityPct: 62,
      supervisor: 'Hlonela Dlamini (EMP-WRH-301)',
      status: 'OPERATIONAL',
    },
    {
      id: 'DBN-01',
      name: 'Durban Port Logistics Depot',
      city: 'Durban, KwaZulu-Natal',
      binsCount: 24,
      activeSkus: 3,
      capacityPct: 45,
      supervisor: 'Unassigned',
      status: 'STANDBY',
    },
  ]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/api/admin/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401) {
        onSessionExpired?.();
        return;
      }
      if (res.ok && data.employees) {
        setEmployees(data.employees);
      }
    } catch (err) {
      console.error('Failed to load employees', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401) {
        onSessionExpired?.();
        return;
      }
      if (res.ok && data.logs) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchAuditLogs();
  }, [token]);

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          sector: regSector,
          role: regRole,
          tempPassword: regTempPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          onSessionExpired?.();
          return;
        }
        throw new Error(data.error || 'Failed to register employee');
      }

      setRegSuccessData(data.user);
      fetchEmployees();
      fetchAuditLogs();
      onNotify?.(`Successfully registered ${data.user.name} with Employee ID ${data.user.employeeId}`, 'success');

      // Reset fields
      setRegName('');
      setRegEmail('');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setRegLoading(false);
    }
  };

  const handleUpdateStatus = async (user, newStatus) => {
    try {
      const res = await fetch(`${apiBase}/api/admin/employees/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchEmployees();
        fetchAuditLogs();
        onNotify?.(`Updated status for ${user.employeeId} to ${newStatus}`, 'success');
      }
    } catch (err) {
      onNotify?.('Failed to update status', 'error');
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Are you sure you want to reset password for ${user.name} (${user.employeeId})?`)) return;
    try {
      const res = await fetch(`${apiBase}/api/admin/employees/${user.id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        fetchEmployees();
        fetchAuditLogs();
        onNotify?.(data.message, 'success');
      }
    } catch (err) {
      onNotify?.('Failed to reset password', 'error');
    }
  };

  const handleSendEmailCode = async (user) => {
    try {
      const res = await fetch(`${apiBase}/api/auth/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: user.employeeId }),
      });
      const data = await res.json();
      if (res.ok) {
        onNotify?.(`Verification OTP sent to ${data.email} (Dev Code: ${data.code})`, 'success');
        fetchAuditLogs();
      } else {
        onNotify?.(data.error, 'error');
      }
    } catch {
      onNotify?.('Failed to send verification code', 'error');
    }
  };

  const handleResetMFA = async (user) => {
    try {
      const res = await fetch(`${apiBase}/api/admin/employees/${user.id}/reset-mfa`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        fetchEmployees();
        fetchAuditLogs();
        onNotify?.(data.message, 'success');
      }
    } catch (err) {
      onNotify?.('Failed to reset MFA', 'error');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = selectedSector === 'ALL' || emp.sector === selectedSector;
    return matchesSearch && matchesSector;
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Title Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-purple" style={{ padding: '4px 10px', fontSize: '0.8125rem' }}>
              <Icon name="shield-check" size={16} /> Enterprise Administration System
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Security Level: Tier 1 Root</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em' }}>
            Human Resources & Governance Portal
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setRegSuccessData(null);
              setShowRegModal(true);
            }}
            className="btn btn-primary"
          >
            <Icon name="plus" size={16} /> Register New Employee
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          className={`btn ${activeTab === 'employees' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('employees')}
        >
          <Icon name="users" size={16} /> Employee & Sector Directory ({employees.length})
        </button>
        <button
          className={`btn ${activeTab === 'warehouses' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('warehouses')}
        >
          <Icon name="box" size={16} /> Multi-Warehouse Locations ({warehouses.length})
        </button>
        <button
          className={`btn ${activeTab === 'audit-logs' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('audit-logs')}
        >
          <Icon name="clipboard-list" size={16} /> Security & Audit Logs ({auditLogs.length})
        </button>
        <button
          className={`btn ${activeTab === 'policies' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('policies')}
        >
          <Icon name="lock" size={16} /> System Policies & Security Compliance
        </button>
      </div>

      {/* TAB 1: EMPLOYEE DIRECTORY & SECTOR MANAGEMENT */}
      {activeTab === 'employees' && (
        <div>
          {/* Filter Bar */}
          <div
            className="card"
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
            }}
          >
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by Employee ID (e.g. EMP-CSH-201), Name, or Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ width: '260px' }}>
              <select
                className="form-select"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
              >
                <option value="ALL">All Operational Sectors</option>
                {sectorsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Employee Directory Table */}
          <div className="table-container card" style={{ padding: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Full Name & Contact</th>
                  <th>Operational Sector</th>
                  <th>System Role</th>
                  <th>Account Status</th>
                  <th>Email Status</th>
                  <th>MFA Status</th>
                  <th>Last Active</th>
                  <th style={{ textAlign: 'right' }}>Security Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <span className="badge badge-primary form-input-mono" style={{ fontSize: '0.8125rem' }}>
                        {emp.employeeId}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{emp.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.email}</div>
                    </td>
                    <td>
                      <span className="badge badge-gray">{emp.sector || 'Unassigned'}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          emp.role === 'ADMIN'
                            ? 'badge-purple'
                            : emp.role === 'MANAGER'
                            ? 'badge-primary'
                            : emp.role === 'CASHIER'
                            ? 'badge-success'
                            : 'badge-warning'
                        }`}
                      >
                        {emp.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          emp.status === 'ACTIVE'
                            ? 'badge-success'
                            : emp.status === 'PENDING_SETUP'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                      >
                        {emp.status === 'PENDING_SETUP' ? 'Pending Password Setup' : emp.status}
                      </span>
                    </td>
                    <td>
                      {emp.emailVerified ? (
                        <span className="badge badge-success">
                          <Icon name="check-circle" size={12} /> Verified
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="badge badge-warning"
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="Click to dispatch verification code"
                          onClick={() => handleSendEmailCode(emp)}
                        >
                          ✉️ Send Code
                        </button>
                      )}
                    </td>
                    <td>
                      {emp.mfaEnabled ? (
                        <span className="badge badge-success">
                          <Icon name="check-circle" size={12} /> TOTP Active
                        </span>
                      ) : (
                        <span className="badge badge-gray">Not Enrolled</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Dispatch Email OTP"
                          onClick={() => handleSendEmailCode(emp)}
                        >
                          ✉️ Code
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Reset Password"
                          onClick={() => handleResetPassword(emp)}
                        >
                          <Icon name="key" size={14} /> Reset Pass
                        </button>
                        {emp.mfaEnabled && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Reset MFA"
                            onClick={() => handleResetMFA(emp)}
                          >
                            <Icon name="shield" size={14} /> Reset MFA
                          </button>
                        )}
                        {emp.status === 'ACTIVE' ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => handleUpdateStatus(emp, 'SUSPENDED')}
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--success)' }}
                            onClick={() => handleUpdateStatus(emp, 'ACTIVE')}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-WAREHOUSE LOCATIONS */}
      {activeTab === 'warehouses' && (
        <div>
          <div className="grid-cols-3" style={{ marginBottom: '1.5rem' }}>
            {warehouses.map((wh) => (
              <div key={wh.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="badge badge-primary form-input-mono">{wh.id}</span>
                  <span className={`badge ${wh.status === 'OPERATIONAL' ? 'badge-success' : 'badge-warning'}`}>
                    {wh.status}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '4px' }}>{wh.name}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{wh.city}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Configured Bins:</span>
                    <strong>{wh.binsCount} bin locations</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Active Stock SKUs:</span>
                    <strong>{wh.activeSkus} lines</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Facility Supervisor:</span>
                    <strong>{wh.supervisor}</strong>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Capacity Utilization:</span>
                      <strong>{wh.capacityPct}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${wh.capacityPct}%`,
                          height: '100%',
                          background: wh.capacityPct > 75 ? 'var(--primary)' : 'var(--success)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
              <Icon name="box" size={18} /> Standardized Bin Taxonomy (Phase 3 Specification)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Bins are partitioned into high-velocity zones (Aisle A-01..A-05 for quick POS items) and bulk pallet storage (Aisle C3-042 for electronics and fragile goods).
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['A-01 (Dairy Cooler)', 'A-03 (Bakery Front)', 'B-01 (Coffee Pantry)', 'B-04 (Grains Depot)', 'C-01 (Cosmetics Bay)', 'C3-042 (Electronics Secure)', 'D-01 (Stationery)', 'E-01 (Apparel Rack)'].map((b) => (
                <span key={b} className="badge badge-gray form-input-mono" style={{ padding: '6px 12px' }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: IMMUTABLE AUDIT LOGS (NFR-SEC-01) */}
      {activeTab === 'audit-logs' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">
                <Icon name="shield-check" size={18} /> Cryptographic Security & Operational Audit Trail
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Immutable event stream recording all administrative, authentication, and inventory transactions.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchAuditLogs}>
              <Icon name="refresh-cw" size={14} /> Refresh Logs
            </button>
          </div>

          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Timestamp (UTC)</th>
                  <th>Actor / Operator</th>
                  <th>Event Type</th>
                  <th>Target Entity</th>
                  <th>Details & Context</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="form-input-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.id}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{log.actor}</div>
                      <span className="badge badge-gray" style={{ fontSize: '0.6875rem' }}>{log.actorRole}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          log.eventType.includes('LOGIN')
                            ? 'badge-primary'
                            : log.eventType.includes('REGISTER') || log.eventType.includes('PASSWORD')
                            ? 'badge-purple'
                            : 'badge-warning'
                        }`}
                      >
                        {log.eventType}
                      </span>
                    </td>
                    <td>
                      <span className="form-input-mono" style={{ fontSize: '0.8125rem' }}>
                        {log.targetUserId || 'SYSTEM'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{log.details}</td>
                    <td>
                      <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM POLICIES & SECURITY */}
      {activeTab === 'policies' && (
        <div className="grid-cols-2">
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>
              <Icon name="lock" size={18} /> Password & Access Governance Policy
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Enforce Mandatory First-Time Password Change:</strong> Enabled for all newly registered staff.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Complexity:</strong> Minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Session Management:</strong> Stateless JWT Tokens signed with SHA-256 (8-hour expiration).</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Transport Security:</strong> TLS 1.3 encryption across all client-server communications.</span>
              </li>
            </ul>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>
              <Icon name="dollar-sign" size={18} /> Fiscal & Inventory Rules (RSA Regulatory)
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Value Added Tax (VAT):</strong> 15.0% South African statutory standard rate.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Currency Standard:</strong> South African Rand (ZAR / R).</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Negative Inventory Prevention:</strong> ACID transactions reject sales exceeding available stock.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Returns Policy:</strong> 2-step verification restores inventory and prevents ghost stock.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {showRegModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            {!regSuccessData ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Register New Employee</h2>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowRegModal(false)}>✕</button>
                </div>

                <form onSubmit={handleRegisterEmployee}>
                  <div className="form-group">
                    <label className="form-label">Full Employee Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Neo Khumalo"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Work Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. neo.khumalo@retail.local"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Operational Sector / Department</label>
                    <select
                      className="form-select"
                      value={regSector}
                      onChange={(e) => {
                        setRegSector(e.target.value);
                        if (e.target.value === 'Store Management') setRegRole('MANAGER');
                        else if (e.target.value === 'Cashier & Front-of-House') setRegRole('CASHIER');
                        else if (e.target.value === 'Warehouse & Logistics') setRegRole('WAREHOUSE_STAFF');
                        else if (e.target.value === 'System Administration') setRegRole('ADMIN');
                      }}
                    >
                      {sectorsList.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">System Role Permission</label>
                    <select
                      className="form-select"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                    >
                      {rolesList.map((r) => (
                        <option key={r.role} value={r.role}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Temporary Password</label>
                    <input
                      type="text"
                      className="form-input form-input-mono"
                      value={regTempPass}
                      onChange={(e) => setRegTempPass(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      User will be strictly forced to set a strong personal password on first login.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRegModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={regLoading}>
                      {regLoading ? 'Registering...' : 'Complete Registration'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Success Confirmation Card */
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'var(--success-light)',
                    color: 'var(--success)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <Icon name="check-circle" size={32} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Employee Registered!</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  The employee profile has been provisioned and added to the enterprise directory.
                </p>

                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div><strong>Employee ID:</strong> <span className="badge badge-primary form-input-mono">{regSuccessData.employeeId}</span></div>
                  <div><strong>Name:</strong> {regSuccessData.name}</div>
                  <div><strong>Email:</strong> {regSuccessData.email}</div>
                  <div><strong>Sector:</strong> {regSuccessData.sector}</div>
                  <div><strong>Role:</strong> {regSuccessData.role}</div>
                  <div><strong>Initial Password:</strong> <code className="form-input-mono">{regTempPass}</code></div>
                  <div><strong>Onboarding Status:</strong> <span className="badge badge-warning">Pending First-Time Password Setup</span></div>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => {
                    setShowRegModal(false);
                    setRegSuccessData(null);
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

