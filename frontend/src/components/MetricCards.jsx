import React from 'react';
import { formatCurrencyCompact, formatNumber } from '../utils/formatters';

export default function MetricCards({ metrics, loading }) {
  const revAtRisk = metrics?.revenue_at_risk || 0;
  const estRecoverable = metrics?.estimated_recoverable_revenue || 0;
  const criticalCount = metrics?.priority_counts?.critical || 0;
  const highCount = metrics?.priority_counts?.high || 0;
  const totalTx = metrics?.total_transactions || 0;
  const recoveryRate = revAtRisk > 0 ? ((estRecoverable / revAtRisk) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="summary-bar-container skeleton-card">
        <div className="summary-cell metric-exposure"><div className="skeleton-line short"></div></div>
      </div>
    );
  }

  return (
    <div className="summary-bar-container">
      <div className="summary-cell metric-exposure">
        <span className="summary-label">Predicted Revenue Exposure</span>
        <div className="summary-value">{formatCurrencyCompact(revAtRisk)}</div>
        <span className="summary-sublabel">Across analyzed payment events</span>
      </div>

      <div className="summary-cell metric-recovery">
        <span className="summary-label">Estimated Recovery Potential</span>
        <div className="summary-value text-emerald-700">{formatCurrencyCompact(estRecoverable)}</div>
        <span className="summary-sublabel">Model-estimated recoverable value</span>
      </div>

      <div className="summary-cell metric-critical">
        <span className="summary-label">Critical</span>
        <div className="summary-value text-red-600">{formatNumber(criticalCount)}</div>
      </div>

      <div className="summary-cell metric-high">
        <span className="summary-label">High</span>
        <div className="summary-value text-amber-700">{formatNumber(highCount)}</div>
      </div>

      <div className="summary-cell metric-blue">
        <span className="summary-label">Transactions Analyzed</span>
        <div className="summary-value text-slate-800">{formatNumber(totalTx)}</div>
      </div>

      <div className="summary-cell metric-success">
        <span className="summary-label">Recovery Success Rate</span>
        <div className="summary-value text-emerald-700">{recoveryRate}%</div>
      </div>
    </div>
  );
}
