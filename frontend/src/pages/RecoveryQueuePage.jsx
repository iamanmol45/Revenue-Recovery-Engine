import React, { useState, useMemo } from 'react';
import { ChevronRight, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import {
  formatCurrencyCompact,
  formatPercent,
  formatNumber,
  getPriorityMeta
} from '../utils/formatters';

export default function RecoveryQueuePage({ queue, metrics, loading, error, onAnalyze, onRefresh }) {
  const [activePriorityTab, setActivePriorityTab] = useState('Critical');

  const prioritySummary = useMemo(() => {
    if (!queue) return {};
    const summary = {
      Critical: { count: 0, revenueAtRisk: 0, recoverable: 0, items: [] },
      High: { count: 0, revenueAtRisk: 0, recoverable: 0, items: [] },
      Medium: { count: 0, revenueAtRisk: 0, recoverable: 0, items: [] },
      Low: { count: 0, revenueAtRisk: 0, recoverable: 0, items: [] },
    };

    queue.forEach((item) => {
      const p = item.recovery_priority || 'Low';
      if (summary[p]) {
        summary[p].count += 1;
        summary[p].revenueAtRisk += item.revenue_at_risk || 0;
        summary[p].recoverable += item.estimated_recoverable_revenue || 0;
        summary[p].items.push(item);
      }
    });

    return summary;
  }, [queue]);

  const activeGroup = prioritySummary[activePriorityTab] || { count: 0, items: [] };

  return (
    <div className="page-container animate-fade-in">
      <div className="dashboard-top-bar">
        <div className="top-bar-title">
          <h1>Recovery Queue</h1>
          <p>Prioritized payment events requiring recovery intervention</p>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      <div className="queue-tier-grid">
        {['Critical', 'High', 'Medium', 'Low'].map((tier) => {
          const summary = prioritySummary[tier] || { count: 0, recoverable: 0 };
          const meta = getPriorityMeta(tier);
          const isActive = activePriorityTab === tier;

          return (
            <div
              key={tier}
              className={`queue-tier-card ${isActive ? 'active-tier' : ''}`}
              onClick={() => setActivePriorityTab(tier)}
            >
              <div className="tier-card-header">
                <span className={`badge ${meta.badgeClass}`}>{tier}</span>
                <span className="tier-count">{formatNumber(summary.count)}</span>
              </div>
              <div className="tier-card-body">
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Recovery Potential</span>
                <h4 className="tier-recoverable-val">{formatCurrencyCompact(summary.recoverable)}</h4>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel-card">
        <div className="panel-header-row">
          <div>
            <h2>{activePriorityTab} Recovery Opportunities ({formatNumber(activeGroup.items.length)})</h2>
            <p className="panel-subtitle">
              Estimated Recovery Potential: <strong style={{ color: 'var(--semantic-green)' }}>{formatCurrencyCompact(activeGroup.recoverable)}</strong>
            </p>
          </div>
        </div>

        <div className="table-responsive" style={{ maxHeight: '65vh' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Payment ID</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Priority</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10 }} className="text-right">Failure Risk</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10 }} className="text-right">Predicted Exposure</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10 }} className="text-right">Est. Recovery Rate</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10 }} className="text-right">Recovery Potential</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Recommended Action</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10 }} className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && !error ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td></tr>
              ) : error ? (
                <tr>
                  <td colSpan="8" style={{ padding: 0 }}>
                    <div style={{ textAlign: 'center', padding: '48px', background: 'var(--semantic-red-bg)' }}>
                      <AlertCircle size={28} color="var(--semantic-red)" style={{ margin: '0 auto 8px' }} />
                      <h4 style={{ fontWeight: 'bold', color: '#7f1d1d' }}>Unable to load recovery data</h4>
                      <p style={{ fontSize: '13px', color: '#7f1d1d' }}>{error}</p>
                    </div>
                  </td>
                </tr>
              ) : activeGroup.items.length > 0 ? (
                activeGroup.items.map((row) => {
                  const priorityMeta = getPriorityMeta(row.recovery_priority || 'Low');
                  return (
                    <tr key={row.payment_id} className="table-row-hover">
                      <td className="font-mono font-bold text-slate-900">
                        {row.payment_id}
                      </td>
                      <td>
                        <span className={`badge ${priorityMeta.badgeClass}`}>
                          {row.recovery_priority || 'Low'}
                        </span>
                      </td>
                      <td className="text-right font-bold" style={{ color: row.failure_probability > 0.5 ? 'var(--semantic-red)' : 'var(--semantic-amber)' }}>
                        {formatPercent(row.failure_probability)}
                      </td>
                      <td className="text-right font-bold text-slate-900">
                        {formatCurrencyCompact(row.revenue_at_risk)}
                      </td>
                      <td className="text-right font-medium">
                        {formatPercent(row.estimated_recovery_rate)}
                      </td>
                      <td className="text-right font-bold text-emerald-700" style={{ color: 'var(--semantic-green)' }}>
                        {formatCurrencyCompact(row.estimated_recoverable_revenue)}
                      </td>
                      <td style={{ fontSize: '12px', fontWeight: 600 }}>
                        {row.recovery_action}
                      </td>
                      <td className="text-right">
                        <button
                          className="btn-primary"
                          onClick={() => onAnalyze(row.payment_id)}
                          style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>Analyze</span>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ padding: 0 }}>
                    <div style={{ textAlign: 'center', padding: '48px' }}>
                      <Inbox size={32} style={{ margin: '0 auto 12px', color: 'var(--border-color)' }} />
                      <h4 style={{ fontWeight: 'bold' }}>No recovery opportunities</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        There are currently no transactions matching the {activePriorityTab} priority tier.
                      </p>
                    </div>
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
