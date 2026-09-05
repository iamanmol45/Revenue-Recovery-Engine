import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, ChevronRight as ArrowIcon } from 'lucide-react';
import {
  formatCurrencyCompact,
  formatPercent,
  getPriorityMeta
} from '../utils/formatters';

export default function TransactionsPage({ queue, loading, error, onAnalyze, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const actionOptions = useMemo(() => {
    if (!queue) return [];
    const set = new Set(queue.map((q) => q.recovery_action).filter(Boolean));
    return Array.from(set);
  }, [queue]);

  const filteredQueue = useMemo(() => {
    if (!queue) return [];
    return queue.filter((item) => {
      const matchSearch =
        !searchTerm ||
        (item.payment_id && item.payment_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.customer_id && item.customer_id.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchPriority =
        selectedPriority === 'ALL' ||
        (item.recovery_priority && item.recovery_priority.toUpperCase() === selectedPriority.toUpperCase());

      const matchAction =
        selectedAction === 'ALL' ||
        (item.recovery_action && item.recovery_action === selectedAction);

      return matchSearch && matchPriority && matchAction;
    });
  }, [queue, searchTerm, selectedPriority, selectedAction]);

  const totalPages = Math.ceil(filteredQueue.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQueue.slice(start, start + pageSize);
  }, [filteredQueue, currentPage, pageSize]);

  if (error) {
    return (
      <div className="error-banner">
        <div className="error-content">
          <h4>Unable to load transaction records</h4>
          <p>{error}</p>
        </div>
        {onRefresh && (
          <button className="btn-secondary" onClick={onRefresh}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="dashboard-top-bar">
        <div>
          <h1>Payment Events</h1>
          <p>Transaction records with failure risk scoring and recovery predictions</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={onRefresh}>
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-controls-card">
        <div className="filter-selectors">
          <div className="select-wrapper">
            <span className="select-label">Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="select-wrapper">
            <span className="select-label">Action:</span>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Actions</option>
              {actionOptions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="search-input-wrapper">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search Payment ID or Customer..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="panel-card mt-2">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Failure Risk</th>
                <th className="text-right">Predicted Exposure</th>
                <th>Priority</th>
                <th>Est. Recovery Rate</th>
                <th className="text-right">Recovery Potential</th>
                <th>Recommended Action</th>
                <th className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-6 text-slate-500">
                    Loading payment events...
                  </td>
                </tr>
              ) : paginatedData.length > 0 ? (
                paginatedData.map((row) => {
                  const meta = getPriorityMeta(row.recovery_priority);
                  return (
                    <tr key={row.payment_id} className="table-row-hover">
                      <td className="font-mono text-xs font-bold text-slate-900">
                        {row.payment_id}
                      </td>
                      <td className="font-semibold text-red-600">
                        {formatPercent(row.failure_probability)}
                      </td>
                      <td className="font-semibold text-slate-900 text-right">
                        {formatCurrencyCompact(row.revenue_at_risk)}
                      </td>
                      <td>
                        <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                      </td>
                      <td className="text-slate-700 font-medium">
                        {formatPercent(row.estimated_recovery_rate)}
                      </td>
                      <td className="font-semibold text-emerald-700 text-right">
                        {formatCurrencyCompact(row.estimated_recoverable_revenue)}
                      </td>
                      <td className="text-xs font-semibold text-slate-800">
                        {row.recovery_action}
                      </td>
                      <td className="text-right">
                        <button
                          className="btn-details"
                          onClick={() => onAnalyze(row.payment_id)}
                        >
                          <span>Analyze</span>
                          <ArrowIcon size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-6 text-slate-500">
                    No payment events found matching filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="table-pagination-footer">
          <span className="pagination-info">
            Showing {filteredQueue.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, filteredQueue.length)} of {filteredQueue.length} records
          </span>

          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <span className="current-page-text">
              {currentPage} / {totalPages}
            </span>

            <button
              className="pagination-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
