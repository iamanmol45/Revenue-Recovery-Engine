import React, { useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { formatPercent, formatNumber } from '../utils/formatters';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCustomers = () => {
    setLoading(true);
    setError(null);
    api.getCustomers()
      .then((data) => {
        setCustomers(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching customers:', err);
        setError(err.message || 'Failed to load customer directory');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      (c.customer_id && String(c.customer_id).toLowerCase().includes(q)) ||
      (c.name && String(c.name).toLowerCase().includes(q)) ||
      (c.email && String(c.email).toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="dashboard-top-bar">
        <div className="top-bar-title">
          <h1>Customers & Risk</h1>
          <p>Customer directory and payment risk metrics</p>
        </div>
        <button className="btn-secondary" onClick={loadCustomers} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="filter-controls-card" style={{ padding: '16px' }}>
        <div className="search-input-wrapper" style={{ height: '44px', borderRadius: '10px', backgroundColor: 'var(--bg-main)' }}>
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search Customer ID, name, or identifier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: '14px' }}
          />
        </div>
      </div>

      <div className="panel-card mt-2">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Transactions Analyzed</th>
                <th>Success</th>
                <th>Failed</th>
                <th>Failure Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>
                    Loading customer profiles...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--semantic-red)' }}>
                    {error}
                  </td>
                </tr>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((cust) => {
                  const total = cust.total_transactions || 1;
                  const failed = cust.failed_transactions || 0;
                  const success = cust.successful_transactions || total - failed;
                  const rate = cust.failure_rate !== undefined ? cust.failure_rate : failed / total;

                  return (
                    <tr key={cust.customer_id} className="table-row-hover">
                      <td className="font-mono text-xs font-bold text-slate-900">{cust.customer_id}</td>
                      <td className="font-medium text-slate-900">{cust.name || '—'}</td>
                      <td className="text-xs text-slate-600">{cust.email || '—'}</td>
                      <td className="font-semibold text-slate-800">{formatNumber(total)}</td>
                      <td className="font-semibold" style={{ color: 'var(--semantic-green)' }}>{formatNumber(success)}</td>
                      <td className="font-semibold" style={{ color: 'var(--semantic-red)' }}>{formatNumber(failed)}</td>
                      <td>
                        <span className={`badge ${rate > 0.3 ? 'badge-critical' : 'badge-low'}`}>
                          {formatPercent(rate)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No customer profiles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
