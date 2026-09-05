import React from 'react';
import {
  LayoutDashboard,
  CreditCard,
  Zap,
  BarChart3,
  Users,
  FileText,
  History,
  Settings,
  Activity,
  ShieldAlert
} from 'lucide-react';
import { formatCurrencyCompact, formatNumber } from '../utils/formatters';

export default function Sidebar({ activePage, setActivePage, metrics }) {
  const criticalHighCount = (metrics?.priority_counts?.critical || 0) + (metrics?.priority_counts?.high || 0);

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">Razorpay</div>
        <div className="sidebar-subtitle">AI Revenue Recovery Engine</div>
      </div>

      <div className="sidebar-scroll-area">
        <div className="sidebar-section">
          <div className="sidebar-heading">REVENUE RECOVERY</div>
          <button
            className={`sidebar-nav-item ${activePage === 'overview' ? 'active' : ''}`}
            onClick={() => setActivePage('overview')}
          >
            <LayoutDashboard size={16} />
            <span>Overview</span>
          </button>
          <button
            className={`sidebar-nav-item ${activePage === 'transactions' ? 'active' : ''}`}
            onClick={() => setActivePage('transactions')}
          >
            <CreditCard size={16} />
            <span>Payments</span>
          </button>
          <button
            className={`sidebar-nav-item ${activePage === 'queue' ? 'active' : ''}`}
            onClick={() => setActivePage('queue')}
          >
            <Zap size={16} />
            <span>Recovery Queue</span>
            {criticalHighCount > 0 && (
              <span className="sidebar-badge badge-alert">{criticalHighCount}</span>
            )}
          </button>
          <button
            className={`sidebar-nav-item ${activePage === 'history' ? 'active' : ''}`}
            onClick={() => setActivePage('history')}
          >
            <History size={16} />
            <span>Recovery History</span>
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-heading">AI & ANALYTICS</div>
          <button
            className={`sidebar-nav-item ${activePage === 'insights' ? 'active' : ''}`}
            onClick={() => setActivePage('insights')}
          >
            <BarChart3 size={16} />
            <span>AI Insights</span>
          </button>
          <button
            className={`sidebar-nav-item ${activePage === 'analytics' ? 'active' : ''}`}
            onClick={() => setActivePage('reports')}
          >
            <Activity size={16} />
            <span>Recovery Analytics</span>
          </button>
          <button
            className={`sidebar-nav-item ${activePage === 'reports' ? 'active' : ''}`}
            onClick={() => setActivePage('reports')}
          >
            <FileText size={16} />
            <span>Reports</span>
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-heading">CUSTOMER OPERATIONS</div>
          <button
            className={`sidebar-nav-item ${activePage === 'customers' ? 'active' : ''}`}
            onClick={() => setActivePage('customers')}
          >
            <Users size={16} />
            <span>Customers</span>
          </button>
          <button
            className={`sidebar-nav-item ${activePage === 'risk' ? 'active' : ''}`}
            onClick={() => setActivePage('customers')}
          >
            <ShieldAlert size={16} />
            <span>Customer Risk</span>
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-heading">SYSTEM</div>
          <button
            className={`sidebar-nav-item ${activePage === 'settings' ? 'active' : ''}`}
            onClick={() => setActivePage('reports')}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>
      </div>

    </aside>
  );
}
