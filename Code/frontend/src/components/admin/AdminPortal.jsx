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
  { role: 'PROCUREMENT_STAFF', label: 'Procurement Staff (Suppliers & Purchase Orders)' },
];

export const AdminPortal = ({ apiBase, token, currentUser, onNotify, onSessionExpired, initialTab = 'employees' }) => {
  const isPlatformAdmin = Boolean(currentUser?.isPlatformAdmin);
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'products' | 'procurement' | 'warehouses' | 'audit-logs' | 'policies' | 'companies'
  useEffect(() => setActiveTab(['employees', 'products', 'procurement', 'warehouses', 'audit-logs', 'policies', 'companies'].includes(initialTab) ? initialTab : 'employees'), [initialTab]);
  const [employees, setEmployees] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [productQuery, setProductQuery] = useState('');
  const [productStatus, setProductStatus] = useState('ALL');
  const [poStatus, setPoStatus] = useState('ALL');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditStatus, setAuditStatus] = useState('ALL');
  const [policy, setPolicy] = useState(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [company, setCompany] = useState(null);
  const [companySaving, setCompanySaving] = useState(false);
  const [platformCompanies, setPlatformCompanies] = useState([]);
  const [companyProvisioning, setCompanyProvisioning] = useState(false);
  const [newCompany, setNewCompany] = useState({ legalName: '', tradingName: '', registrationNumber: '', taxNumber: '', currency: 'ZAR', timezone: 'Africa/Johannesburg' });
  const [companyAdmin, setCompanyAdmin] = useState({ companyId: '', name: '', email: '', tempPassword: 'TempPass123!' });

  // Registration Form State
  const [showRegModal, setShowRegModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSector, setRegSector] = useState(sectorsList[1]);
  const [regRole, setRegRole] = useState('CASHIER');
  const [regTempPass, setRegTempPass] = useState('TempPass123!');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccessData, setRegSuccessData] = useState(null);
  const [newWarehouse, setNewWarehouse] = useState({ id: '', name: '', city: '', binsCount: 0, activeSkus: 0, capacityPct: 0, supervisor: 'Unassigned', status: 'STANDBY' });

  // Warehouse configuration mock data
  const [warehouses, setWarehouses] = useState([
    {
      id: 'JHB-01',
      name: 'Johannesburg Central Distribution Hub',
      city: 'Johannesburg, Gauteng',
      binsCount: 48,
      activeSkus: 8,
      capacityPct: 78,
      supervisor: 'Jayden Khoza (MGR-101)',
      status: 'OPERATIONAL',
    },
    {
      id: 'CPT-02',
      name: 'Cape Town Coastal Fulfillment Facility',
      city: 'Cape Town, Western Cape',
      binsCount: 36,
      activeSkus: 5,
      capacityPct: 62,
      supervisor: 'Hlonela Dlamini (WRH-301)',
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

  const fetchOperationalData = async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [productsRes, suppliersRes, ordersRes] = await Promise.all([
        fetch(`${apiBase}/api/products?includeInactive=true`, { headers }),
        fetch(`${apiBase}/api/suppliers`, { headers }),
        fetch(`${apiBase}/api/purchase-orders`, { headers }),
      ]);
      const [productsData, suppliersData, ordersData] = await Promise.all([
        productsRes.json(), suppliersRes.json(), ordersRes.json(),
      ]);
      if (productsRes.ok) setProducts(productsData.products || []);
      if (suppliersRes.ok) setSuppliers(suppliersData.suppliers || []);
      if (ordersRes.ok) setPurchaseOrders(ordersData.purchaseOrders || []);
    } catch (err) {
      console.error('Failed to load operational data', err);
    }
  };

  const toggleProductActive = async (product) => {
    try {
      const res = await fetch(`${apiBase}/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update product status');
      setProducts(products.map((item) => item.id === product.id ? data.product : item));
      fetchAuditLogs();
      onNotify?.(`${product.name} ${product.isActive ? 'archived' : 'restored'}`, 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
    }
  };

  const fetchWarehouses = async () => {
    const res = await fetch(`${apiBase}/api/admin/warehouses`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setWarehouses(data.warehouses || []);
  };

  const fetchPolicy = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/policies`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setPolicy(data.policy);
    } catch (err) {
      console.error('Failed to load policy configuration', err);
    }
  };

  const fetchCompany = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/company`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setCompany(data.company);
    } catch (err) {
      console.error('Failed to load company profile', err);
    }
  };

  const fetchPlatformCompanies = async () => {
    if (!isPlatformAdmin) return;
    const res = await fetch(`${apiBase}/api/platform/companies`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setPlatformCompanies(data.companies || []);
  };

  useEffect(() => {
    fetchEmployees();
    fetchAuditLogs();
    fetchOperationalData();
    fetchWarehouses();
    fetchPolicy();
    fetchCompany();
    fetchPlatformCompanies();
  }, [token]);

  const savePolicy = async (changes) => {
    setPolicySaving(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/policies`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(changes),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save policy');
      setPolicy(data.policy);
      fetchAuditLogs();
      onNotify?.(data.message, 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setPolicySaving(false);
    }
  };

  const saveCompany = async () => {
    setCompanySaving(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/company`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(company) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save company profile');
      setCompany(data.company);
      onNotify?.('Company profile saved', 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setCompanySaving(false);
    }
  };

  const createCompany = async (event) => {
    event.preventDefault();
    setCompanyProvisioning(true);
    try {
      const res = await fetch(`${apiBase}/api/platform/companies`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(newCompany) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create company');
      setPlatformCompanies(data.companies || []);
      setCompanyAdmin({ ...companyAdmin, companyId: data.company.id });
      setNewCompany({ legalName: '', tradingName: '', registrationNumber: '', taxNumber: '', currency: 'ZAR', timezone: 'Africa/Johannesburg' });
      onNotify?.('Company created. Provision its administrator below.', 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setCompanyProvisioning(false);
    }
  };

  const provisionCompanyAdmin = async (event) => {
    event.preventDefault();
    setCompanyProvisioning(true);
    try {
      const res = await fetch(`${apiBase}/api/platform/companies/${companyAdmin.companyId}/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(companyAdmin) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to provision administrator');
      onNotify?.(`Administrator created. Temporary password: ${data.temporaryPassword}`, 'success');
      setCompanyAdmin({ companyId: '', name: '', email: '', tempPassword: 'TempPass123!' });
    } catch (err) {
      onNotify?.(err.message, 'error');
    } finally {
      setCompanyProvisioning(false);
    }
  };

  const saveNewWarehouse = async (event) => {
    event.preventDefault();
    const res = await fetch(`${apiBase}/api/admin/warehouses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newWarehouse),
    });
    const data = await res.json();
    if (!res.ok) return onNotify?.(data.error || 'Unable to save warehouse', 'error');
    setWarehouses(data.warehouses || []);
    setNewWarehouse({ id: '', name: '', city: '', binsCount: 0, activeSkus: 0, capacityPct: 0, supervisor: 'Unassigned', status: 'STANDBY' });
    onNotify?.('Warehouse saved', 'success');
  };

  const deleteWarehouse = async (warehouse) => {
    if (!window.confirm(`Delete warehouse ${warehouse.id}?`)) return;
    const res = await fetch(`${apiBase}/api/admin/warehouses/${warehouse.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setWarehouses(data.warehouses || []);
  };

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

  const handleUpdateEmployee = async (user, changes) => {
    try {
      const res = await fetch(`${apiBase}/api/admin/employees/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(changes),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update employee');
      setEmployees(data.employees || employees);
      fetchAuditLogs();
      onNotify?.('Employee permissions updated', 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
    }
  };

  const handleDeleteEmployee = async (user) => {
    if (!window.confirm(`Delete ${user.name} (${user.employeeId})?`)) return;
    try {
      const res = await fetch(`${apiBase}/api/admin/employees/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete employee');
      setEmployees(data.employees || []);
      fetchAuditLogs();
      onNotify?.('Employee deleted', 'success');
    } catch (err) {
      onNotify?.(err.message, 'error');
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
        onNotify?.(data.code ? `Verification OTP sent to ${data.email} (Dev Code: ${data.code})` : `Verification OTP sent to ${data.email}. Check the inbox.`, 'success');
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

  const filteredProducts = products.filter((product) => {
    const query = productQuery.toLowerCase();
    const matchesQuery = !query || [product.name, product.sku, product.barcode, product.warehouseId, product.binLocation].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesQuery && (productStatus === 'ALL' || product.status === productStatus);
  });
  const filteredPurchaseOrders = purchaseOrders.filter((order) => poStatus === 'ALL' || order.status === poStatus);
  const filteredAuditLogs = auditLogs.filter((log) => {
    const query = auditQuery.toLowerCase();
    const matchesQuery = !query || [log.id, log.actor, log.actorRole, log.eventType, log.targetUserId, log.details].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesQuery && (auditStatus === 'ALL' || log.status === auditStatus);
  });

  return (
    <div className="portal-shell">
      <div className="portal-hero">
        <div className="portal-hero-copy">
          <div className="portal-hero-badges">
            <span className="badge badge-purple" style={{ padding: '4px 10px', fontSize: '0.8125rem' }}>
              <Icon name="shield-check" size={16} /> Enterprise Administration System
            </span>
            <span className="portal-kicker">Security Level: Tier 1 Root</span>
          </div>
          <h1 className="portal-title">Human Resources & Governance Portal</h1>
        </div>

        <div className="portal-hero-actions">
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

      <div className="portal-tab-bar">
        {isPlatformAdmin && <button className={`portal-tab ${activeTab === 'companies' ? 'is-active' : ''}`} onClick={() => setActiveTab('companies')}><Icon name="box" size={16} /> Companies ({platformCompanies.length})</button>}
        <button
          className={`portal-tab ${activeTab === 'employees' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          <Icon name="users" size={16} /> Employee & Sector Directory ({employees.length})
        </button>
        <button
          className={`portal-tab ${activeTab === 'warehouses' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('warehouses')}
        >
          <Icon name="box" size={16} /> Multi-Warehouse Locations ({warehouses.length})
        </button>
        <button
          className={`portal-tab ${activeTab === 'products' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <Icon name="barcode" size={16} /> Product Catalogue ({products.length})
        </button>
        <button
          className={`portal-tab ${activeTab === 'procurement' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('procurement')}
        >
          <Icon name="truck" size={16} /> Procurement ({purchaseOrders.length})
        </button>
        <button
          className={`portal-tab ${activeTab === 'audit-logs' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('audit-logs')}
        >
          <Icon name="clipboard-list" size={16} /> Security & Audit Logs ({auditLogs.length})
        </button>
        <button
          className={`portal-tab ${activeTab === 'policies' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          <Icon name="lock" size={16} /> System Policies & Security Compliance
        </button>
      </div>

      {activeTab === 'companies' && isPlatformAdmin && <div className="company-management-grid"><form className="card company-management-card" onSubmit={createCompany}><div className="card-header"><h2 className="card-title"><Icon name="building" size={18} /> Add company</h2><button className="btn btn-primary btn-sm" disabled={companyProvisioning}>{companyProvisioning ? 'Creating…' : 'Create company'}</button></div><p className="policy-help">Create an isolated company workspace. Its administrator will receive a separate login.</p><div className="policy-form-grid"><label className="form-label">Legal name<input className="form-input" required value={newCompany.legalName} onChange={(e) => setNewCompany({ ...newCompany, legalName: e.target.value })} /></label><label className="form-label">Trading name<input className="form-input" required value={newCompany.tradingName} onChange={(e) => setNewCompany({ ...newCompany, tradingName: e.target.value })} /></label><label className="form-label">Registration number<input className="form-input" value={newCompany.registrationNumber} onChange={(e) => setNewCompany({ ...newCompany, registrationNumber: e.target.value })} /></label><label className="form-label">Tax number<input className="form-input" value={newCompany.taxNumber} onChange={(e) => setNewCompany({ ...newCompany, taxNumber: e.target.value })} /></label><label className="form-label">Currency<input className="form-input" required maxLength="3" value={newCompany.currency} onChange={(e) => setNewCompany({ ...newCompany, currency: e.target.value.toUpperCase() })} /></label><label className="form-label">Timezone<input className="form-input" required value={newCompany.timezone} onChange={(e) => setNewCompany({ ...newCompany, timezone: e.target.value })} /></label></div></form><form className="card company-management-card" onSubmit={provisionCompanyAdmin}><div className="card-header"><h2 className="card-title"><Icon name="user-plus" size={18} /> Provision administrator</h2><button className="btn btn-primary btn-sm" disabled={companyProvisioning || !companyAdmin.companyId}>{companyProvisioning ? 'Provisioning…' : 'Create administrator'}</button></div><p className="policy-help">Only a platform administrator can provision the first administrator for a company.</p><div className="policy-form-grid"><label className="form-label">Company<select className="form-input" required value={companyAdmin.companyId} onChange={(e) => setCompanyAdmin({ ...companyAdmin, companyId: e.target.value })}><option value="">Select company</option>{platformCompanies.map((item) => <option key={item.id} value={item.id}>{item.tradingName}</option>)}</select></label><label className="form-label">Administrator name<input className="form-input" required value={companyAdmin.name} onChange={(e) => setCompanyAdmin({ ...companyAdmin, name: e.target.value })} /></label><label className="form-label">Administrator email<input className="form-input" type="email" required value={companyAdmin.email} onChange={(e) => setCompanyAdmin({ ...companyAdmin, email: e.target.value })} /></label><label className="form-label">Temporary password<input className="form-input" required value={companyAdmin.tempPassword} onChange={(e) => setCompanyAdmin({ ...companyAdmin, tempPassword: e.target.value })} /></label></div></form><div className="card company-management-card company-list-card"><div className="card-header"><h2 className="card-title"><Icon name="layers" size={18} /> Tenant directory</h2></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Company</th><th>Company ID</th><th>Currency</th><th>Status</th></tr></thead><tbody>{platformCompanies.map((item) => <tr key={item.id}><td><strong>{item.tradingName}</strong><small>{item.legalName}</small></td><td className="form-input-mono">{item.id}</td><td>{item.currency}</td><td><span className="badge badge-success">{item.subscriptionStatus}</span></td></tr>)}</tbody></table></div></div></div>}

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
                placeholder="Search by Employee ID (e.g. CSH-201), Name, or Email..."
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
          <div className="table-container card employee-directory-table" style={{ padding: 0 }}>
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
                      <span className="employee-id-badge form-input-mono">
                        {emp.employeeId}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{emp.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.email}</div>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ minWidth: '170px', fontSize: '0.75rem' }}
                        value={emp.sector || ''}
                        onChange={(e) => handleUpdateEmployee(emp, { sector: e.target.value })}
                      >
                        {sectorsList.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{ minWidth: '145px', fontSize: '0.75rem' }}
                        value={emp.role}
                        onChange={(e) => handleUpdateEmployee(emp, { role: e.target.value })}
                      >
                        {rolesList.map((role) => <option key={role.role} value={role.role}>{role.role}</option>)}
                      </select>
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
                        <span className="badge badge-success">Verified</span>
                      ) : (
                        <button
                          type="button"
                          className="badge badge-warning"
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="Click to dispatch verification code"
                          onClick={() => handleSendEmailCode(emp)}
                        >
                          Send Code
                        </button>
                      )}
                    </td>
                    <td>
                      {emp.mfaEnabled ? (
                        <span className="badge badge-success">TOTP Active</span>
                      ) : (
                        <span className="badge badge-gray">Not Enrolled</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="employee-directory-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Dispatch Email OTP"
                          onClick={() => handleSendEmailCode(emp)}
                        >
                          Code
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Reset Password"
                          onClick={() => handleResetPassword(emp)}
                        >
                          Reset Pass
                        </button>
                        {emp.mfaEnabled && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Reset MFA"
                            onClick={() => handleResetMFA(emp)}
                          >
                            Reset MFA
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
                        {emp.role !== 'ADMIN' && (
                          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteEmployee(emp)}>
                            Delete
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

      {/* TAB 2: PRODUCT CATALOGUE */}
      {activeTab === 'products' && (
        <div className="table-container card" style={{ padding: 0 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title"><Icon name="barcode" size={18} /> Product Catalogue Oversight</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Products, generated barcodes, pricing, stock, and status.</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchOperationalData}><Icon name="refresh-cw" size={14} /> Refresh</button>
          </div>
          <div className="admin-filter-bar">
            <input className="form-input" placeholder="Search SKU, barcode, warehouse, or product..." value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
            <select className="form-select" value={productStatus} onChange={(e) => setProductStatus(e.target.value)}>
              <option value="ALL">All stock statuses</option><option value="Healthy">Healthy</option><option value="Watch">Watch</option><option value="Reorder">Reorder</option>
            </select>
          </div>
          <table className="custom-table">
            <thead><tr><th>Product</th><th>Barcode</th><th>Supplier</th><th>Warehouse</th><th>Price</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{filteredProducts.map((product) => (
              <tr key={product.id}>
                <td><strong>{product.name}</strong><div className="form-input-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{product.sku}</div></td>
                <td className="form-input-mono">{product.barcode}</td>
                <td>{suppliers.find((supplier) => supplier.id === product.supplierId)?.name || product.supplierId}</td>
                <td>{product.warehouseId} / {product.binLocation}</td>
                <td>R {Number(product.price).toFixed(2)}</td>
                <td>{product.stock} ({product.availableStock} available)</td>
                <td><span className={`badge ${!product.isActive ? 'badge-gray' : product.status === 'Healthy' ? 'badge-success' : product.status === 'Reorder' ? 'badge-danger' : 'badge-warning'}`}>{product.isActive ? product.status : 'Archived'}</span></td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => toggleProductActive(product)}>{product.isActive ? 'Archive' : 'Restore'}</button></td>
              </tr>
            ))}</tbody>
          </table>
          {filteredProducts.length === 0 && <div className="empty-state"><Icon name="box" size={28} /><strong>No products match this view</strong><span>Try a different search or status filter.</span></div>}
        </div>
      )}

      {/* TAB 3: PROCUREMENT OVERSIGHT */}
      {activeTab === 'procurement' && (
        <div>
          <div className="grid-cols-3" style={{ marginBottom: '1.25rem' }}>
            {suppliers.map((supplier) => (
              <div className="card" key={supplier.id}><span className="badge badge-primary">Supplier</span><h3 style={{ marginTop: '8px' }}>{supplier.name}</h3><p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{supplier.contact}</p><p style={{ marginTop: '8px' }}>Lead time: {supplier.leadTimeDays} days · Rating: {supplier.rating}</p></div>
            ))}
          </div>
          <div className="table-container card" style={{ padding: 0 }}>
            <div className="card-header"><h3 className="card-title"><Icon name="truck" size={18} /> Purchase Orders</h3><div className="admin-inline-actions"><select className="form-select" value={poStatus} onChange={(e) => setPoStatus(e.target.value)}><option value="ALL">All statuses</option>{[...new Set(purchaseOrders.map((order) => order.status))].map((status) => <option key={status}>{status}</option>)}</select><button className="btn btn-secondary btn-sm" onClick={fetchOperationalData}><Icon name="refresh-cw" size={14} /> Refresh</button></div></div>
            <table className="custom-table"><thead><tr><th>PO</th><th>Item</th><th>Supplier</th><th>Quantity</th><th>Received</th><th>Status</th></tr></thead><tbody>{filteredPurchaseOrders.map((order) => <tr key={order.id}><td className="form-input-mono">PO-{order.id}</td><td>{order.itemName}<div className="form-input-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{order.sku}</div></td><td>{order.supplierName}</td><td>{order.quantity}</td><td>{order.receivedQuantity} / {order.quantity}</td><td><span className={`badge ${order.status === 'RECEIVED' ? 'badge-success' : order.status === 'CANCELLED' ? 'badge-danger' : order.status === 'PARTIALLY_RECEIVED' ? 'badge-warning' : 'badge-primary'}`}>{order.status}</span></td></tr>)}</tbody></table>
            {filteredPurchaseOrders.length === 0 && <div className="empty-state"><Icon name="truck" size={28} /><strong>No purchase orders match this view</strong><span>Try another status filter.</span></div>}
          </div>
        </div>
      )}

      {/* TAB 4: MULTI-WAREHOUSE LOCATIONS */}
      {activeTab === 'warehouses' && (
        <div>
          <form className="card" onSubmit={saveNewWarehouse} style={{ marginBottom: '1.25rem' }}>
            <div className="card-header"><h3 className="card-title"><Icon name="plus" size={18} /> Add Warehouse</h3><button type="button" className="btn btn-secondary btn-sm" onClick={fetchWarehouses}><Icon name="refresh-cw" size={14} /> Refresh</button></div>
            <div className="grid-cols-4">
              {[
                ['id', 'Warehouse ID'], ['name', 'Name'], ['city', 'City'], ['supervisor', 'Supervisor'],
                ['binsCount', 'Bins'], ['activeSkus', 'Active SKUs'], ['capacityPct', 'Capacity %'],
              ].map(([field, label]) => <label className="form-label" key={field}>{label}<input className="form-input" required={['id', 'name', 'city'].includes(field)} type={['binsCount', 'activeSkus', 'capacityPct'].includes(field) ? 'number' : 'text'} value={newWarehouse[field]} onChange={(e) => setNewWarehouse({ ...newWarehouse, [field]: e.target.value })} /></label>)}
              <label className="form-label">Status<select className="form-select" value={newWarehouse.status} onChange={(e) => setNewWarehouse({ ...newWarehouse, status: e.target.value })}><option>STANDBY</option><option>OPERATIONAL</option></select></label>
            </div>
            <button className="btn btn-primary" type="submit"><Icon name="check" size={16} /> Save Warehouse</button>
          </form>
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
                <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', marginTop: '1rem' }} onClick={() => deleteWarehouse(wh)}><Icon name="trash" size={14} /> Delete Warehouse</button>
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

      {/* TAB 3: SECURITY AUDIT LOGS */}
      {activeTab === 'audit-logs' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">
                <Icon name="shield-check" size={18} /> Security & Operational Audit Log
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Application-recorded administrative, authentication, and inventory events. Database-level immutability is not enforced.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchAuditLogs}>
              <Icon name="refresh-cw" size={14} /> Refresh Logs
            </button>
          </div>

          <div className="admin-filter-bar">
            <input className="form-input" placeholder="Search actor, event, target, or detail..." value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} />
            <select className="form-select" value={auditStatus} onChange={(e) => setAuditStatus(e.target.value)}><option value="ALL">All outcomes</option><option value="SUCCESS">Success</option><option value="WARNING">Warning</option><option value="FAILURE">Failure</option></select>
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
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="form-input-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.id}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString(undefined, { timeZone: 'UTC' })}
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
                      <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : log.status === 'WARNING' ? 'badge-warning' : 'badge-danger'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredAuditLogs.length === 0 && <div className="empty-state"><Icon name="clipboard-list" size={28} /><strong>No audit events match this view</strong><span>Try a different search or outcome filter.</span></div>}
        </div>
      )}

      {/* TAB 4: SYSTEM POLICIES & SECURITY */}
      {activeTab === 'policies' && (
        <div>
          {company && <div className="card company-admin-card"><div className="card-header"><div><h3 className="card-title"><Icon name="building" size={18} /> Company profile</h3><p className="policy-help">This profile and its policies belong only to the current company.</p></div><button className="btn btn-primary btn-sm" disabled={companySaving} onClick={saveCompany}>{companySaving ? 'Saving…' : 'Save company'}</button></div><div className="policy-form-grid"><label className="form-label">Legal name<input className="form-input" value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} /></label><label className="form-label">Trading name<input className="form-input" value={company.tradingName} onChange={(e) => setCompany({ ...company, tradingName: e.target.value })} /></label><label className="form-label">Registration number<input className="form-input" value={company.registrationNumber || ''} onChange={(e) => setCompany({ ...company, registrationNumber: e.target.value })} /></label><label className="form-label">Tax number<input className="form-input" value={company.taxNumber || ''} onChange={(e) => setCompany({ ...company, taxNumber: e.target.value })} /></label><label className="form-label">Currency<input className="form-input" maxLength="3" value={company.currency} onChange={(e) => setCompany({ ...company, currency: e.target.value.toUpperCase() })} /></label><label className="form-label">Timezone<input className="form-input" value={company.timezone} onChange={(e) => setCompany({ ...company, timezone: e.target.value })} /></label></div></div>}
          {policy && <div className="policy-config card">
            <div className="policy-overview">
              <div><span className="badge badge-success">Version {policy.version}</span><h3>Security & operational controls</h3><p>Owner: {policy.owner} · Effective {policy.effectiveDate} · Review {policy.reviewDate}</p></div>
              <div className="policy-overview-meta"><span>History</span><strong>{policy.history.length} revisions</strong><span>TLS</span><strong>{policy.tlsStatus === 'CONFIGURED' ? 'Configured' : 'Deployment required'}</strong></div>
            </div>
            <div className="policy-grid">
              <div className="policy-editor-card">
                <div className="card-header"><h3 className="card-title"><Icon name="lock" size={18} /> Enforced controls</h3><button className="btn btn-primary btn-sm" disabled={policySaving} onClick={() => savePolicy({ owner: policy.owner, reviewDate: policy.reviewDate, sessionDurationHours: policy.sessionDurationHours, vatRate: policy.vatRate })}>{policySaving ? 'Saving…' : 'Save changes'}</button></div>
                <div className="policy-form-grid"><label className="form-label">VAT rate (%)<input className="form-input" type="number" min="0" max="100" step="0.1" value={policy.vatRate} onChange={(e) => setPolicy({ ...policy, vatRate: Number(e.target.value) })} /></label><label className="form-label">Session duration (hours)<input className="form-input" type="number" min="1" max="24" value={policy.sessionDurationHours} onChange={(e) => setPolicy({ ...policy, sessionDurationHours: Number(e.target.value) })} /></label><label className="form-label">Owner<input className="form-input" value={policy.owner} onChange={(e) => setPolicy({ ...policy, owner: e.target.value })} /></label><label className="form-label">Next review date<input className="form-input" type="date" value={policy.reviewDate} onChange={(e) => setPolicy({ ...policy, reviewDate: e.target.value })} /></label></div>
                <p className="policy-help">The administrator decides whether each control is enforced, recommended, deployment-dependent, or not required.</p><div className="policy-control-list">{policy.controls.map((control) => <div className="policy-control-row" key={control.id}><div><strong>{control.name}</strong><span>{control.description}</span></div><select className="form-input policy-status-select" value={control.status} onChange={(e) => setPolicy({ ...policy, controls: policy.controls.map((item) => item.id === control.id ? { ...item, status: e.target.value } : item), password: control.id === 'first-login-password' ? { ...policy.password, firstLoginChangeRequired: e.target.value === 'ENFORCED' } : policy.password })}><option value="ENFORCED">Enforced</option><option value="RECOMMENDED">Recommended</option><option value="REQUIRES_DEPLOYMENT">Requires deployment</option><option value="DISABLED">Not required</option></select></div>)}</div>
              </div>
              <div className="policy-side-card"><h3 className="card-title"><Icon name="key" size={18} /> Password requirements</h3><div className="policy-stat-grid"><span>Minimum length</span><strong>{policy.password.minimumLength} characters</strong><span>Uppercase</span><strong>{policy.password.requireUppercase ? 'Required' : 'Optional'}</strong><span>Lowercase</span><strong>{policy.password.requireLowercase ? 'Required' : 'Optional'}</strong><span>Number</span><strong>{policy.password.requireNumber ? 'Required' : 'Optional'}</strong><span>Special character</span><strong>{policy.password.requireSpecial ? 'Required' : 'Optional'}</strong><span>First-login change</span><strong>{policy.password.firstLoginChangeRequired ? 'Required' : 'Optional'}</strong></div><div className="policy-section-label">Deployment requirements</div><div className={`policy-deployment ${policy.tlsStatus === 'CONFIGURED' ? 'is-ready' : 'is-pending'}`}><Icon name={policy.tlsStatus === 'CONFIGURED' ? 'check-circle' : 'alert-triangle'} size={18} /><span><strong>TLS at trusted edge</strong><small>{policy.tlsStatus === 'CONFIGURED' ? 'HTTPS termination is configured.' : 'Configure HTTPS at the reverse proxy or load balancer.'}</small></span></div><div className="policy-section-label">Version history</div>{policy.history.slice(0, 4).map((entry) => <div className="policy-history-row" key={`${entry.version}-${entry.changedAt}`}><strong>v{entry.version}</strong><span>{entry.summary}</span><small>{entry.changedAt.slice(0, 10)}</small></div>)}</div>
            </div>
          </div>}
          {policy && <div className="card policy-admin-options"><div className="card-header"><h3 className="card-title"><Icon name="settings" size={18} /> Administrator choices</h3><button className="btn btn-primary btn-sm" disabled={policySaving} onClick={() => savePolicy({ owner: policy.owner, reviewDate: policy.reviewDate, sessionDurationHours: policy.sessionDurationHours, vatRate: policy.vatRate, tlsStatus: policy.tlsStatus, password: policy.password, controls: policy.controls })}>{policySaving ? 'Saving…' : 'Save all policy choices'}</button></div><p className="policy-help">Choose which password requirements apply to new accounts. Changes are versioned and take effect after saving.</p><div className="policy-option-grid"><label className="form-label">Minimum password length<input className="form-input" type="number" min="6" max="64" value={policy.password.minimumLength} onChange={(e) => setPolicy({ ...policy, password: { ...policy.password, minimumLength: Number(e.target.value) } })} /></label>{[['requireUppercase', 'Uppercase required'], ['requireLowercase', 'Lowercase required'], ['requireNumber', 'Number required'], ['requireSpecial', 'Special character required'], ['firstLoginChangeRequired', 'First-login change required']].map(([key, label]) => <label className="policy-option-row" key={key}><span>{label}</span><input type="checkbox" checked={policy.password[key]} onChange={(e) => setPolicy({ ...policy, password: { ...policy.password, [key]: e.target.checked } })} /></label>)}<label className="form-label">TLS deployment status<select className="form-input" value={policy.tlsStatus} onChange={(e) => setPolicy({ ...policy, tlsStatus: e.target.value })}><option value="CONFIGURED">Configured</option><option value="REQUIRES_DEPLOYMENT">Requires deployment</option></select></label></div></div>}
          <div className="policy-overview card">
            <div><span className="badge badge-success">Enforced baseline</span><h3>Security & operational controls</h3><p>Policy version 1.3 · Owner: System Administration · Review cycle: quarterly</p></div>
            <div className="policy-overview-meta"><span>Last reviewed</span><strong>11 Oct 2026</strong><span>Change history</span><strong>Available in Activity Log</strong></div>
          </div>
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
                <span><strong>Session Management:</strong> Stateless HS256 JWT tokens with an 8-hour expiration.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Transport Security:</strong> Configure TLS at a trusted reverse proxy; the API does not terminate TLS itself.</span>
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
                <span><strong>Negative Inventory Prevention:</strong> Application validation rejects sales exceeding available stock.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="check-circle" size={16} className="text-success" />
                <span><strong>Returns Policy:</strong> 2-step verification restores inventory and prevents ghost stock.</span>
              </li>
            </ul>
          </div>
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
                        else if (e.target.value === 'Procurement & Supply Chain') setRegRole('PROCUREMENT_STAFF');
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
