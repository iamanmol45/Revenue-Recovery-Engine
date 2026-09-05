import React from 'react';
import { Download, Printer } from 'lucide-react';
import { formatCurrencyCompact, formatCurrencyFull, formatNumber, formatPercent, getPriorityMeta } from '../utils/formatters';

export default function ReportsPage({ metrics, priorities, queue }) {
  // Sort queue by revenue_at_risk DESC and take top 3
  const topOpportunities = (queue || [])
    .slice()
    .sort((a, b) => (b.revenue_at_risk || 0) - (a.revenue_at_risk || 0))
    .slice(0, 3);

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // If the value contains comma, newline, or double quote, we must escape it
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      // Escape double quotes by replacing " with ""
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const handleExportCSV = () => {
    if (!topOpportunities || topOpportunities.length === 0) return;
    
    const headers = [
      'Report Type',
      'Payment ID',
      'Customer ID',
      'Failure Risk',
      'Predicted Exposure',
      'Priority',
      'Estimated Recovery Rate',
      'Estimated Recovery Potential',
      'Recommended Action'
    ];
    
    const rows = topOpportunities.map((op) => [
      'Top Recovery Opportunity',
      op.payment_id,
      op.customer_id || 'N/A',
      formatPercent(op.failure_probability),
      formatCurrencyFull(op.revenue_at_risk),
      getPriorityMeta(op.recovery_priority).label,
      formatPercent(op.estimated_recovery_rate),
      formatCurrencyFull(op.estimated_recoverable_revenue),
      op.recovery_action
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `top_recovery_opportunities_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentDateTime = new Date().toLocaleString();
  const revAtRisk = metrics?.revenue_at_risk || 0;
  const estRecoverable = metrics?.estimated_recoverable_revenue || 0;
  const totalTx = metrics?.total_transactions || 0;
  const criticalCount = metrics?.priority_counts?.critical || 0;
  const highCount = metrics?.priority_counts?.high || 0;
  const recoveryRate = revAtRisk > 0 ? ((estRecoverable / revAtRisk) * 100).toFixed(1) : 0;

  // "Why these 3" dynamic calculations
  const topTotalExposure = topOpportunities.reduce((sum, op) => sum + (op.revenue_at_risk || 0), 0);
  const topTotalPotential = topOpportunities.reduce((sum, op) => sum + (op.estimated_recoverable_revenue || 0), 0);
  
  return (
    <>
      <div className="page-container animate-fade-in">
        <div className="dashboard-top-bar">
          <div className="top-bar-title">
            <h1>Reports</h1>
            <p>Revenue recovery performance, risk exposure, and recovery opportunities</p>
          </div>
        </div>

        {/* Reporting Controls Bar */}
        <div className="filter-controls-card" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <div className="flex items-center" style={{ gap: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Reporting Period:</span>
            <div className="filter-dropdown" style={{ backgroundColor: '#F8FAFC', cursor: 'default' }}>
              <span>Lifetime (All Available Data)</span>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: '12px' }}>
            <button className="btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
              <Printer size={16} />
              <span>Print Report</span>
            </button>
            <button className="btn-primary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Executive Summary Bar */}
        <div className="panel-card" style={{ padding: '0', border: 'none', background: 'transparent', boxShadow: 'none' }}>
           <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#0F172A' }}>Executive Summary</h3>
           <div className="summary-bar-container">
            <div className="summary-cell metric-exposure">
              <span className="summary-label">Predicted Revenue Exposure</span>
              <div className="summary-value">{formatCurrencyFull(revAtRisk)}</div>
            </div>

            <div className="summary-cell metric-recovery">
              <span className="summary-label text-emerald-700">Estimated Recovery Potential</span>
              <div className="summary-value text-emerald-600">{formatCurrencyFull(estRecoverable)}</div>
            </div>

            <div className="summary-cell metric-critical">
              <span className="summary-label">Critical Opportunities</span>
              <div className="summary-value text-red-600">{formatNumber(criticalCount)}</div>
            </div>

            <div className="summary-cell metric-high">
              <span className="summary-label">High Priority Opportunities</span>
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
        </div>

        {/* Recovery Performance Table */}
        <div className="panel-card mt-2">
          <div className="panel-header-row">
            <div>
              <h2>Recovery Performance</h2>
              <p className="panel-subtitle">Risk distribution and recovery potential by priority</p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Volume</th>
                  <th>Share</th>
                  <th className="text-right">Predicted Exposure</th>
                  <th className="text-right">Recovery Potential</th>
                  <th>Recovery Yield</th>
                </tr>
              </thead>
              <tbody>
                {priorities?.map((row) => {
                  const meta = getPriorityMeta(row.priority);
                  const share = metrics?.total_transactions ? ((row.transaction_count / metrics.total_transactions) * 100).toFixed(1) : 0;
                  const yieldPct = row.revenue_at_risk ? ((row.estimated_recoverable / row.revenue_at_risk) * 100).toFixed(1) : 0;

                  return (
                    <tr key={row.priority} className="table-row-hover">
                      <td>
                        <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                      </td>
                      <td className="font-semibold text-slate-800">{formatNumber(row.transaction_count)}</td>
                      <td className="text-slate-600">{share}%</td>
                      <td className="font-medium text-slate-900 text-right">{formatCurrencyFull(row.revenue_at_risk)}</td>
                      <td className="font-semibold text-emerald-700 text-right">{formatCurrencyFull(row.estimated_recoverable)}</td>
                      <td className="font-semibold text-blue-700">{yieldPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Recovery Opportunities Table */}
        <div className="panel-card mt-2">
          <div className="panel-header-row">
            <div>
              <h2>Top Recovery Opportunities</h2>
              <p className="panel-subtitle">The highest-value individual targets for revenue recovery</p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Customer ID</th>
                  <th>Failure Risk</th>
                  <th className="text-right">Predicted Exposure</th>
                  <th>Priority</th>
                  <th>Est. Recovery Rate</th>
                  <th className="text-right">Recovery Potential</th>
                  <th>Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {topOpportunities.length > 0 ? topOpportunities.map((row) => {
                  const meta = getPriorityMeta(row.recovery_priority);
                  return (
                    <tr key={row.payment_id} className="table-row-hover">
                      <td className="font-mono text-xs font-bold text-slate-900">{row.payment_id}</td>
                      <td className="font-mono text-xs text-slate-600">{row.customer_id || 'N/A'}</td>
                      <td className="font-semibold text-red-600">{formatPercent(row.failure_probability)}</td>
                      <td className="font-semibold text-slate-900 text-right">{formatCurrencyFull(row.revenue_at_risk)}</td>
                      <td>
                        <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                      </td>
                      <td className="text-slate-700 font-medium">{formatPercent(row.estimated_recovery_rate)}</td>
                      <td className="font-semibold text-emerald-700 text-right">{formatCurrencyFull(row.estimated_recoverable_revenue)}</td>
                      <td className="text-xs font-semibold text-slate-800">{row.recovery_action}</td>
                    </tr>
                  );
                }) : (
                   <tr>
                     <td colSpan="8" className="text-center py-6 text-slate-500">No opportunities available.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Why These 3 Insight */}
          {topOpportunities.length > 0 && (
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', borderLeft: '4px solid #2563EB' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>Why these {topOpportunities.length}?</h4>
              <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                These opportunities represent the highest predicted revenue exposure currently identified by the recovery engine. 
                Combined, they account for <strong>{formatCurrencyFull(topTotalExposure)}</strong> in at-risk revenue and offer an estimated recovery potential of <strong>{formatCurrencyFull(topTotalPotential)}</strong>. 
                Focusing on these specific transactions provides the most immediate financial impact.
              </p>
            </div>
          )}
        </div>

        {/* Recovery Insights */}
        <div className="panel-card mt-2">
           <div className="panel-header-row">
            <div>
              <h2>Recovery Insights</h2>
              <p className="panel-subtitle">Key takeaways based on current performance data</p>
            </div>
          </div>
          <ul style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', paddingLeft: '20px' }}>
             <li>
               Critical opportunities constitute <strong>{criticalCount}</strong> of the <strong>{totalTx}</strong> analyzed transactions, requiring the most immediate attention.
             </li>
             {priorities && priorities.length > 0 && (
               <li>
                 The <strong>{priorities[0].priority}</strong> tier accounts for the largest share of predicted exposure.
               </li>
             )}
             <li>
               Overall, the model estimates a potential recovery of <strong>{formatCurrencyFull(estRecoverable)}</strong> across all priority levels.
             </li>
             {topOpportunities.length > 0 && (
                <li>
                  The top recommended action among the highest-value opportunities is <strong>{topOpportunities[0].recovery_action}</strong>.
                </li>
             )}
          </ul>
        </div>
      </div>

      {/* DEDICATED PRINT VIEW (Following the requested hierarchy) */}
      <div className="print-report-container">
        <div className="print-header">
          <h1>AI REVENUE RECOVERY ENGINE</h1>
          <h2 style={{ fontSize: '18px', margin: '0 0 12px 0', color: '#334155' }}>REVENUE RECOVERY REPORT</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
            <span><strong>Reporting Period:</strong> Lifetime (All Available Data)</span>
            <span><strong>Generated:</strong> {currentDateTime}</span>
          </div>
        </div>

        {/* EXECUTIVE SUMMARY */}
        <div className="print-section">
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase' }}>Executive Summary</h3>
          <table className="data-table" style={{ marginBottom: '16px' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', width: '50%' }}>Predicted Revenue Exposure</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>{formatCurrencyFull(revAtRisk)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>Estimated Recovery Potential</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#059669', fontSize: '16px' }}>{formatCurrencyFull(estRecoverable)}</td>
              </tr>
            </tbody>
          </table>
          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', width: '50%' }}>Critical Opportunities</td>
                <td style={{ textAlign: 'right' }}>{formatNumber(criticalCount)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>High Priority Opportunities</td>
                <td style={{ textAlign: 'right' }}>{formatNumber(highCount)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>Transactions Analyzed</td>
                <td style={{ textAlign: 'right' }}>{formatNumber(totalTx)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }}>Recovery Success Rate</td>
                <td style={{ textAlign: 'right' }}>{recoveryRate}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* RISK & RECOVERY PERFORMANCE */}
        <div className="print-section">
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase' }}>Risk & Recovery Performance</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Priority</th>
                <th style={{ textAlign: 'center' }}>Transactions</th>
                <th style={{ textAlign: 'right' }}>Predicted Exposure</th>
                <th style={{ textAlign: 'right' }}>Recovery Potential</th>
              </tr>
            </thead>
            <tbody>
              {priorities?.map(row => (
                <tr key={row.priority}>
                  <td style={{ fontWeight: 'bold' }}>{row.priority}</td>
                  <td style={{ textAlign: 'center' }}>{formatNumber(row.transaction_count)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrencyFull(row.revenue_at_risk)}</td>
                  <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrencyFull(row.estimated_recoverable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TOP 3 RECOVERY OPPORTUNITIES */}
        <div className="print-section">
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase' }}>Top {topOpportunities.length} Recovery Opportunities</h3>
          <table className="data-table" style={{ fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Payment ID</th>
                <th style={{ textAlign: 'left' }}>Customer ID</th>
                <th style={{ textAlign: 'right' }}>Risk</th>
                <th style={{ textAlign: 'right' }}>Exposure</th>
                <th style={{ textAlign: 'left' }}>Priority</th>
                <th style={{ textAlign: 'right' }}>Rec. Rate</th>
                <th style={{ textAlign: 'right' }}>Rec. Potential</th>
                <th style={{ textAlign: 'left' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {topOpportunities.length > 0 ? topOpportunities.map((row) => {
                 return (
                  <tr key={row.payment_id}>
                    <td style={{ fontFamily: 'monospace' }}>{row.payment_id}</td>
                    <td style={{ fontFamily: 'monospace' }}>{row.customer_id || 'N/A'}</td>
                    <td style={{ textAlign: 'right' }}>{formatPercent(row.failure_probability)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrencyFull(row.revenue_at_risk)}</td>
                    <td>{row.recovery_priority}</td>
                    <td style={{ textAlign: 'right' }}>{formatPercent(row.estimated_recovery_rate)}</td>
                    <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrencyFull(row.estimated_recoverable_revenue)}</td>
                    <td>{row.recovery_action}</td>
                  </tr>
                );
              }) : (
                 <tr>
                   <td colSpan="8" style={{ textAlign: 'center', padding: '12px' }}>No opportunities available.</td>
                 </tr>
              )}
            </tbody>
          </table>
          
          {/* WHY THESE 3? */}
          {topOpportunities.length > 0 && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderLeft: '3px solid #2563eb' }}>
              <strong>WHY THESE {topOpportunities.length}?</strong><br />
              These opportunities represent the highest predicted revenue exposure currently identified by the recovery engine. 
              Combined, they account for <strong>{formatCurrencyFull(topTotalExposure)}</strong> in at-risk revenue and offer an estimated recovery potential of <strong>{formatCurrencyFull(topTotalPotential)}</strong>.
            </div>
          )}
        </div>

        {/* REPORT NOTES */}
        <div className="print-section" style={{ marginTop: '40px', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
          <strong>REPORT NOTES:</strong>
          <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
            <li><strong>Predicted Revenue Exposure:</strong> The total amount of revenue mathematically at risk of permanent failure across the analyzed dataset.</li>
            <li><strong>Estimated Recovery Potential:</strong> The sum of model-predicted recoverable revenue if recommended AI interventions are successful.</li>
            <li><strong>Recovery Success Rate:</strong> The ratio of estimated recoverable revenue to the total predicted revenue exposure.</li>
            <li>All monetary values and classifications are derived from ML model estimates and historical heuristics.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
