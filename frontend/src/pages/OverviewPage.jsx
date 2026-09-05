import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { ChevronRight } from 'lucide-react';
import MetricCards from '../components/MetricCards';
import {
  formatCurrencyCompact,
  formatCurrencyFull,
  formatAxisCompact,
  formatPercent,
  formatNumber,
  getPriorityMeta
} from '../utils/formatters';

const PRIORITY_COLORS = {
  Critical: '#DC2626',
  High: '#EA580C',
  Medium: '#D97706',
  Low: '#10B981',
};

export default function OverviewPage({
  metrics,
  queue,
  priorities,
  trend,
  loading,
  error,
  onAnalyze,
  onRefresh
}) {
  const totalTx = metrics?.total_transactions || 0;
  const priorityCounts = metrics?.priority_counts || { critical: 0, high: 0, medium: 0, low: 0 };

  // Bar chart data from priorities API
  const barData = (priorities || []).map((p) => ({
    priority: p.priority,
    'Predicted Exposure': p.revenue_at_risk,
    'Recovery Potential': p.estimated_recoverable,
  }));

  if (error) {
    return (
      <div className="error-banner">
        <div className="error-content">
          <h4>Unable to load recovery data</h4>
          <p>{error}</p>
        </div>
        <button className="btn-secondary" onClick={onRefresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Page Top Header */}
      <div className="dashboard-top-bar">
        <div className="top-bar-title">
          <h1>Revenue Recovery</h1>
          <p>Payment failure risk analysis and recovery operations</p>
        </div>
        <div className="top-bar-controls">
          <div className="filter-dropdown">
            <span>Last 90 days</span>
          </div>
        </div>
      </div>

      {/* Recovery Overview Summary Bar */}
      <MetricCards metrics={metrics} loading={loading} />

      {/* Recovery Status Table & Charts Section */}
      <div className="charts-grid">
        {/* Recovery Status Table */}
        <div className="panel-card">
          <div className="card-header">
            <h3>Recovery Status</h3>
            <p className="card-subtitle">Predicted exposure and recovery potential by priority tier</p>
          </div>
          <div className="table-responsive mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Transactions</th>
                  <th className="text-right">Predicted Exposure</th>
                  <th className="text-right">Recovery Potential</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4 text-slate-500">Loading...</td>
                  </tr>
                ) : priorities && priorities.length > 0 ? (
                  priorities.map((p) => {
                    const meta = getPriorityMeta(p.priority);
                    return (
                      <tr key={p.priority} className="table-row-hover">
                        <td>
                          <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                        </td>
                        <td className="font-semibold text-slate-800">{formatNumber(p.transaction_count)}</td>
                        <td className="font-medium text-slate-900 text-right">{formatCurrencyCompact(p.revenue_at_risk)}</td>
                        <td className="font-semibold text-emerald-700 text-right">
                          {p.estimated_recoverable > 0 ? formatCurrencyCompact(p.estimated_recoverable) : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-4 text-slate-500">No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recovery Risk Trend Chart */}
        <div className="chart-card">
          <div className="card-header">
            <h3>Recovery Risk Trend</h3>
            <p className="card-subtitle">Daily revenue exposure and recovery potential</p>
          </div>
          <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '260px' }}>
            {loading ? (
              <div className="skeleton-chart" style={{ height: '220px', width: '100%', borderRadius: '8px' }}></div>
            ) : !trend || trend.length === 0 ? (
              <div className="flex items-center justify-center text-slate-500" style={{ height: '220px', fontSize: '14px' }}>
                No recovery trend data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRecover" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => {
                      if (!val) return '';
                      const d = new Date(val);
                      return isNaN(d.getTime()) ? val : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    dy={10}
                    minTickGap={20}
                  />
                  <YAxis 
                    tickFormatter={(val) => formatAxisCompact(val)}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip
                    labelFormatter={(val) => {
                      if (!val) return '';
                      const d = new Date(val);
                      return isNaN(d.getTime()) ? val : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }}
                    formatter={(value, name) => [
                      formatCurrencyFull(value),
                      name === 'revenue_at_risk' ? 'Revenue at Risk' : 'Est. Recoverable'
                    ]}
                    contentStyle={{ borderRadius: '6px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '13px' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span style={{ color: '#475569', fontSize: '13px', fontWeight: 500 }}>{value === 'revenue_at_risk' ? 'Revenue at Risk' : 'Recovery Potential'}</span>}
                  />
                  <Area type="monotone" dataKey="revenue_at_risk" stroke="#DC2626" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" activeDot={{ r: 4, strokeWidth: 0, fill: '#DC2626' }} />
                  <Area type="monotone" dataKey="estimated_recoverable_revenue" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorRecover)" activeDot={{ r: 4, strokeWidth: 0, fill: '#10B981' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recovery Queue Operational Table */}
      <div className="panel-card mt-2">
        <div className="panel-header-row">
          <div>
            <h2>Recovery Opportunities</h2>
            <p className="panel-subtitle">Transactions sorted by priority and predicted exposure</p>
          </div>
        </div>

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
                    Loading recovery opportunities...
                  </td>
                </tr>
              ) : queue && queue.length > 0 ? (
                queue.slice(0, 15).map((row) => {
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
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-6 text-slate-500">
                    No recovery opportunities found.
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
