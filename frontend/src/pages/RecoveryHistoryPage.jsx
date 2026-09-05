import React, { useState, useEffect } from 'react';
import {
  History,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  ArrowRight,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrencyCompact,
  formatCurrencyFull
} from '../utils/formatters';

export default function RecoveryHistoryPage({ onSelectPayment }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [paymentIdSearch, setPaymentIdSearch] = useState('');

  // Outcome Resolution Modal State
  const [resolvingAttempt, setResolvingAttempt] = useState(null);
  const [resolveStatus, setResolveStatus] = useState('Successful');
  const [resolveAmount, setResolveAmount] = useState('');
  const [submittingResolve, setSubmittingResolve] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  const fetchAttempts = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (actionFilter) filters.action = actionFilter;
      if (paymentIdSearch.trim()) filters.payment_id = paymentIdSearch.trim();

      const data = await api.getRecoveryAttempts(filters);
      setAttempts(data || []);
    } catch (err) {
      console.error('Fetch recovery actions error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch recovery actions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, [statusFilter, actionFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAttempts();
  };

  const handleOpenResolveModal = (attempt) => {
    setResolvingAttempt(attempt);
    setResolveStatus('Successful');
    setResolveAmount(attempt.amount_at_risk ? String(attempt.amount_at_risk) : '0');
    setResolveError(null);
  };

  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!resolvingAttempt) return;

    setSubmittingResolve(true);
    setResolveError(null);

    const payload = {
      status: resolveStatus,
      amount_recovered: resolveStatus === 'Successful' ? parseFloat(resolveAmount) || 0 : 0
    };

    try {
      const res = await api.resolveRecoveryAttempt(resolvingAttempt.id, payload);
      if (res.success) {
        setResolvingAttempt(null);
        fetchAttempts();
      } else {
        setResolveError(res.message || 'Failed to resolve recovery action');
      }
    } catch (err) {
      console.error('Resolve action error:', err);
      setResolveError(err.response?.data?.detail || err.message || 'Failed to update recovery outcome');
    } finally {
      setSubmittingResolve(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Successful':
        return (
          <span className="badge badge-low">
            <CheckCircle2 size={12} style={{marginRight: '4px'}} />
            <span>Successful</span>
          </span>
        );
      case 'Failed':
        return (
          <span className="badge badge-critical">
            <XCircle size={12} style={{marginRight: '4px'}} />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="badge badge-high">
            <Clock size={12} style={{marginRight: '4px'}} />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="dashboard-top-bar">
        <div className="top-bar-title">
          <h1>Recovery History</h1>
          <p>Audit log of all recovery actions, automated workflows, and outcome resolutions</p>
        </div>
        <button onClick={fetchAttempts} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {!loading && !error && (
        <div className="summary-bar-container">
          <div className="summary-cell">
            <span className="summary-label">Total Attempts</span>
            <div className="summary-value text-slate-900">{attempts.length}</div>
          </div>
          <div className="summary-cell metric-high">
            <span className="summary-label text-amber-700">Pending</span>
            <div className="summary-value text-amber-600">{attempts.filter(a => a.status === 'Pending').length}</div>
          </div>
          <div className="summary-cell metric-recovery">
            <span className="summary-label text-emerald-700">Successful</span>
            <div className="summary-value text-emerald-600">{attempts.filter(a => a.status === 'Successful').length}</div>
          </div>
          <div className="summary-cell metric-critical">
            <span className="summary-label text-red-700">Failed</span>
            <div className="summary-value text-red-600">{attempts.filter(a => a.status === 'Failed').length}</div>
          </div>
          <div className="summary-cell metric-success" style={{ gridColumn: 'span 2' }}>
            <span className="summary-label text-emerald-700">Revenue Recovered</span>
            <div className="summary-value primary-metric text-emerald-700">
              {formatCurrencyCompact(attempts.filter(a => a.status === 'Successful').reduce((acc, curr) => acc + (curr.amount_recovered || 0), 0))}
            </div>
          </div>
        </div>
      )}

      <div className="filter-controls-card">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1 }}>
          <div className="search-input-wrapper">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search by Payment ID (e.g. ML_000001)..."
              value={paymentIdSearch}
              onChange={(e) => setPaymentIdSearch(e.target.value)}
              className="font-mono"
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>

        <div className="filter-selectors">
          <div className="select-wrapper">
            <Filter size={13} className="text-slate-400" />
            <span className="select-label">Status:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Successful">Successful</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div className="select-wrapper">
            <span className="select-label">Action:</span>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">All Actions</option>
              <option value="Immediate Recovery">Immediate Recovery</option>
              <option value="Retry Payment">Retry Payment</option>
              <option value="Customer Outreach">Customer Outreach</option>
              <option value="Manual Review">Manual Review</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <Loader2 size={24} className="animate-spin text-sky-600" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading recovery actions...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '48px', textAlign: 'center', background: 'var(--semantic-red-bg)' }}>
            <AlertCircle size={28} className="text-red-500" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: '#7f1d1d', fontWeight: 'bold' }}>{error}</p>
            <button onClick={fetchAttempts} className="btn-primary" style={{ marginTop: '12px' }}>Retry</button>
          </div>
        ) : attempts.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <Database size={32} style={{ color: 'var(--border-color)', margin: '0 auto 8px' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>No Recovery Actions Found</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '4px auto 0' }}>
              No recovery actions match the selected filter criteria.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Payment ID</th>
                  <th>Action taken</th>
                  <th className="text-right">Amt at Risk</th>
                  <th className="text-right">Amt Recovered</th>
                  <th>Created</th>
                  <th>Completed</th>
                  <th className="text-right">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((att) => (
                  <tr key={att.id} className="table-row-hover">
                    <td>{getStatusBadge(att.status)}</td>
                    <td className="font-mono text-xs font-bold text-slate-900">
                      <button onClick={() => onSelectPayment && onSelectPayment(att.payment_id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        {att.payment_id}
                      </button>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{att.action}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Attempt #{att.attempt_number || att.id}</div>
                    </td>
                    <td className="text-right font-mono" style={{ fontWeight: 600 }}>{formatCurrencyFull(att.amount_at_risk)}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 600, color: att.status === 'Successful' ? 'var(--semantic-green)' : 'var(--text-muted)' }}>
                      {att.status === 'Pending' ? '—' : formatCurrencyFull(att.amount_recovered || 0)}
                    </td>
                    <td style={{ fontSize: '12px' }}>{att.created_at ? new Date(att.created_at).toLocaleString() : '—'}</td>
                    <td style={{ fontSize: '12px' }}>{att.completed_at ? new Date(att.completed_at).toLocaleString() : '—'}</td>
                    <td className="text-right">
                      {att.status === 'Pending' && (
                        <button className="btn-secondary" onClick={() => handleOpenResolveModal(att)}>
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Outcome Resolution Modal */}
      {resolvingAttempt && (
        <div className="drawer-overlay">
          <div className="panel-card" style={{ maxWidth: '400px', margin: 'auto', background: 'white' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="var(--semantic-green)" />
                <h3 style={{ margin: 0 }}>Resolve Outcome</h3>
              </div>
              <button onClick={() => setResolvingAttempt(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
              <div><strong>Attempt:</strong> #{resolvingAttempt.attempt_number}</div>
              <div className="font-mono"><strong>Payment:</strong> {resolvingAttempt.payment_id}</div>
              <div><strong>Exposure:</strong> {formatCurrencyFull(resolvingAttempt.amount_at_risk)}</div>
            </div>

            <form onSubmit={handleConfirmResolve} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Outcome</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className={resolveStatus === 'Successful' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, backgroundColor: resolveStatus === 'Successful' ? 'var(--semantic-green)' : '' }} onClick={() => setResolveStatus('Successful')}>Successful</button>
                  <button type="button" className={resolveStatus === 'Failed' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, backgroundColor: resolveStatus === 'Failed' ? 'var(--semantic-red)' : '' }} onClick={() => setResolveStatus('Failed')}>Failed</button>
                </div>
              </div>

              {resolveStatus === 'Successful' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Recovered Amount</label>
                  <div className="search-input-wrapper" style={{ maxWidth: '100%' }}>
                    <input type="number" step="0.01" min="0" required value={resolveAmount} onChange={(e) => setResolveAmount(e.target.value)} className="font-mono" />
                  </div>
                </div>
              )}

              {resolveError && <div style={{ color: 'var(--semantic-red)', fontSize: '12px' }}>{resolveError}</div>}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setResolvingAttempt(null)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={submittingResolve}>
                  {submittingResolve ? 'Resolving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
