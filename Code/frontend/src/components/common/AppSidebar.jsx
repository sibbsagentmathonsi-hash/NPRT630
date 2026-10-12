import React from 'react';
import { Icon } from './Icons';

const roleMenus = {
  MANAGER: {
    sections: [
      { label: 'Workspace', items: [['overview', 'Overview', 'trending-up'], ['catalog', 'Inventory', 'box'], ['forecasting', 'Forecasting', 'clipboard-list']] },
      { label: 'Operations', items: [['suppliers', 'Suppliers & POs', 'truck']] },
    ],
  },
  PROCUREMENT_STAFF: {
    sections: [{ label: 'Workspace', items: [['overview', 'Overview', 'trending-up'], ['forecasting', 'Forecasting', 'clipboard-list'], ['suppliers', 'Purchase orders', 'truck'], ['supplier-ratings', 'Supplier ratings', 'check-circle'], ['catalog', 'Inventory', 'box']] }],
  },
  WAREHOUSE_STAFF: {
    sections: [{ label: 'Warehouse', items: [['receiving', 'Receiving', 'truck'], ['cycle-count', 'Cycle counts', 'clipboard-list'], ['adjustments', 'Adjustments', 'box'], ['fulfillment', 'Fulfillment', 'shopping-cart']] }],
  },
  CASHIER: {
    sections: [{ label: 'Front of house', items: [['pos', 'Checkout', 'shopping-cart'], ['returns', 'Returns', 'arrow-left'], ['receipts', 'Receipts', 'printer']] }],
  },
  ADMIN: {
    sections: [
      { label: 'Workspace', items: [['employees', 'People & access', 'users'], ['warehouses', 'Warehouses', 'truck'], ['products', 'Product catalogue', 'box']] },
      { label: 'Governance', items: [['procurement', 'Procurement', 'clipboard-list'], ['audit-logs', 'Activity log', 'check-circle'], ['policies', 'Policies', 'shield-check']] },
    ],
  },
};

export const AppSidebar = ({ role, platformAdmin = false, activeItem, onNavigate, collapsed, onToggle }) => {
  const menu = roleMenus[role] || roleMenus.MANAGER;
  const sections = platformAdmin && role === 'ADMIN'
    ? [{ label: 'Platform', items: [['companies', 'Companies', 'layers']] }, ...menu.sections]
    : menu.sections;

  return (
    <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Primary navigation">
      <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
        <span>{collapsed ? '›' : '‹'}</span>
      </button>
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div className="sidebar-section" key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map(([id, label, icon]) => (
              <button
                type="button"
                className={`sidebar-item ${activeItem === id ? 'is-active' : ''}`}
                key={id}
                onClick={() => onNavigate(id)}
                title={collapsed ? label : undefined}
              >
                <Icon name={icon} size={17} />
                <span className="sidebar-item-label">{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-live-dot" />
        <span className="sidebar-item-label">Live network</span>
      </div>
    </aside>
  );
};
