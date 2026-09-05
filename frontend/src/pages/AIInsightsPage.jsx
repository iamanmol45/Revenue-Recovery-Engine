import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ChevronRight } from 'lucide-react';
import {
  formatCurrencyCompact,
  formatCurrencyFull,
  formatPercent,
  formatNumber,
  getPriorityMeta
} from '../utils/formatters';

const ACTION_COLORS = ['#0284C7', '#10B981', '#D97706', '#64748B'];

export default function AIInsightsPage({ metrics, priorities, queue, loading, onAnalyze }) {
  const revAtRisk = metrics?.revenue_at_risk || 0;
  const estRecoverable = metrics?.estimated_recoverable_revenue || 0;

  const { actionData, totalActions } = React.useMemo(() => {
    if (!queue) return { actionData: [], totalActions: 0 };
    const counts = {};
    let total = 0;
    queue.forEach((item) => {
      const act = item.recovery_action || 'Other';
      counts[act] = (counts[act] || 0) + 1;
      total += 1;
    });
    
    const actionData = Object.keys(counts).map((key, idx) => ({
      name: key,
      value: counts[key],
      color: ACTION_COLORS[idx % ACTION_COLORS.length],
      percentage: total > 0 ? (counts[key] / total) * 100 : 0
    }));
    
    return { actionData, totalActions: total };
  }, [queue]);

  const topRiskItems = React.useMemo(() => {
    if (!queue) return [];
    return [...queue].sort((a, b) => b.revenue_at_risk - a.revenue_at_risk).slice(0, 5);
  }, [queue]);

  return (
    <div className="page-container animate-fade-in">
      <div className="dashboard-top-bar">
        <div className="top-bar-title">
          <h1>Insights & Analytics</h1>
          <p>Predicted exposure distributions, recovery action metrics, and tier analytics</p>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="summary-bar-container">
        <div className="summary-cell">
          <span className="summary-label">Total Predicted Exposure</span>
          <div className="summary-value text-slate-900">{formatCurrencyCompact(revAtRisk)}</div>
        </div>

        <div className="summary-cell metric-recovery">
          <span className="summary-label text-emerald-700">Total Recovery Potential</span>
          <div className="summary-value text-emerald-600">{formatCurrencyCompact(estRecoverable)}</div>
        </div>

        <div className="summary-cell metric-critical">
          <span className="summary-label text-red-700">Critical Tier Potential</span>
          <div className="summary-value text-red-600">
            {formatCurrencyCompact(
              priorities?.find((p) => p.priority === 'Critical')?.estimated_recoverable || 0
            )}
          </div>
        </div>

        <div className="summary-cell metric-high">
          <span className="summary-label text-amber-700">High Tier Potential</span>
          <div className="summary-value text-amber-600">
            {formatCurrencyCompact(
              priorities?.find((p) => p.priority === 'High')?.estimated_recoverable || 0
            )}
          </div>
        </div>
      </div>

      {/* Grid: Actions Breakdown + Priority Table */}
      <div className="charts-grid mt-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="panel-card">
          <div className="panel-header-row">
            <div>
              <h2>Recovery Action Distribution</h2>
              <p className="panel-subtitle">Recommended recovery action breakdown by volume</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
            <div style={{ width: '40%', position: 'relative' }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={actionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {actionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name, props) => [`${formatNumber(val)} (${props.payload.percentage.toFixed(1)}%)`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>Total</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatNumber(totalActions)}</span>
              </div>
            </div>

            <div style={{ width: '60%', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {actionData.map((item) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color }}></div>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', width: '30px', textAlign: 'right' }}>{formatNumber(item.value)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', width: '45px', textAlign: 'right' }}>{item.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="card-header">
            <h3>Priority Financial Summary</h3>
            <p className="card-subtitle">Aggregated prediction metrics by priority level</p>
          </div>
          <div className="table-responsive mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Count</th>
                  <th>Predicted Exposure</th>
                  <th>Recovery Potential</th>
                </tr>
              </thead>
              <tbody>
                {priorities?.map((p) => {
                  const meta = getPriorityMeta(p.priority);
                  return (
                    <tr key={p.priority} className="table-row-hover">
                      <td>
                        <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                      </td>
                      <td className="font-semibold text-slate-800">{formatNumber(p.transaction_count)}</td>
                      <td className="font-medium text-slate-900">{formatCurrencyCompact(p.revenue_at_risk)}</td>
                      <td className="font-semibold text-emerald-700">{formatCurrencyCompact(p.estimated_recoverable)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Highest Risk Transactions Table */}
      <div className="panel-card mt-2">
        <div className="panel-header-row">
          <div>
            <h2>Highest Exposure Transactions</h2>
            <p className="panel-subtitle">Top 5 transactions by predicted revenue exposure</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Failure Risk</th>
                <th>Predicted Exposure</th>
                <th>Priority</th>
                <th>Recovery Potential</th>
                <th>Recommended Action</th>
                <th className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {topRiskItems.map((item) => {
                const meta = getPriorityMeta(item.recovery_priority);
                return (
                  <tr key={item.payment_id} className="table-row-hover">
                    <td className="font-mono text-xs font-bold text-slate-900">{item.payment_id}</td>
                    <td className="font-semibold text-red-600">{formatPercent(item.failure_probability)}</td>
                    <td className="font-bold text-slate-900">{formatCurrencyCompact(item.revenue_at_risk)}</td>
                    <td>
                      <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                    </td>
                    <td className="font-semibold text-emerald-700">{formatCurrencyCompact(item.estimated_recoverable_revenue)}</td>
                    <td className="text-xs font-semibold text-slate-800">{item.recovery_action}</td>
                    <td className="text-right">
                      <button className="btn-details" onClick={() => onAnalyze(item.payment_id)}>
                        <span>Analyze</span>
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
