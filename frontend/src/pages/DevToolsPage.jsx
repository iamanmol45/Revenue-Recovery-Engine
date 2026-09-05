import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  Terminal,
  Clock,
  Loader2,
  CheckSquare
} from 'lucide-react';
import { apiClient } from '../api/client';
import { paymentsApi } from '../api/payments';
import { recoveryApi } from '../api/recovery';
import {
  formatCurrencyCompact,
  formatCurrencyFull,
  formatPercent,
  getPriorityMeta
} from '../utils/formatters';

export default function DevToolsPage() {
  // System Telemetry State
  const [healthStatus, setHealthStatus] = useState('checking');
  const [lastApiTimestamp, setLastApiTimestamp] = useState(null);
  const [lastApiStatusCode, setLastApiStatusCode] = useState(null);

  const generateUniquePaymentId = () => `PAY_SIM_${Math.floor(10000 + Math.random() * 90000)}`;

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    payment_id: generateUniquePaymentId(),
    customer_id: 'CUST_TEST_001',
    amount: '50000',
    currency: 'INR',
    payment_method: 'UPI',
    status: 'failed',
    failure_reason: 'Insufficient funds'
  });
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentOpResult, setPaymentOpResult] = useState(null);

  // Recent Payments Table State
  const [recentPayments, setRecentPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState(null);

  // Recovery Agent Tester State
  const [agentInputId, setAgentInputId] = useState('ML_000001');
  const [analyzingAgent, setAnalyzingAgent] = useState(false);
  const [agentAnalysisResult, setAgentAnalysisResult] = useState(null);
  const [agentError, setAgentError] = useState(null);

  // Initial Health Check and Recent Payments Load
  useEffect(() => {
    checkHealth();
    fetchRecentPayments();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await apiClient.get('/health');
      setLastApiTimestamp(new Date().toLocaleTimeString());
      setLastApiStatusCode(res.status);
      if (res.data?.status === 'healthy') {
        setHealthStatus('connected');
      } else {
        setHealthStatus('degraded');
      }
    } catch (err) {
      setLastApiTimestamp(new Date().toLocaleTimeString());
      setLastApiStatusCode(err.response?.status || '500 Error');
      setHealthStatus('disconnected');
    }
  };

  const fetchRecentPayments = async () => {
    setLoadingPayments(true);
    setPaymentsError(null);
    try {
      const res = await paymentsApi.getPayments();
      setLastApiTimestamp(new Date().toLocaleTimeString());
      setLastApiStatusCode(200);
      setRecentPayments(res || []);
    } catch (err) {
      console.error('Fetch payments error:', err);
      setPaymentsError(err.message || 'Failed to fetch payments from GET /payments');
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleCreatePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentForm.payment_id || !paymentForm.customer_id || !paymentForm.amount) return;

    setCreatingPayment(true);
    setPaymentOpResult(null);

    const payload = {
      payment_id: paymentForm.payment_id,
      customer_id: paymentForm.customer_id,
      amount: parseFloat(paymentForm.amount) || 0,
      currency: paymentForm.currency,
      status: paymentForm.status,
      payment_method: paymentForm.payment_method,
      failure_reason: paymentForm.failure_reason
    };

    console.log('[DevTools] Sending POST /payments payload:', payload);

    try {
      const res = await paymentsApi.createPayment(payload);
      setLastApiTimestamp(new Date().toLocaleTimeString());
      setLastApiStatusCode(200);
      setPaymentOpResult({
        success: true,
        message: res.message || 'Payment recorded successfully',
        payment_id: res.payment_id || payload.payment_id,
        statusCode: '200 OK'
      });
      // Refresh recent payments list to reflect newly inserted database row
      fetchRecentPayments();
    } catch (err) {
      console.error('[DevTools] Create payment error:', err);
      const httpStatus = err.response?.status || 'Network Error';
      setLastApiTimestamp(new Date().toLocaleTimeString());
      setLastApiStatusCode(httpStatus);

      let detailMsg = 'Failed to post payment to backend API';
      if (err.response?.data) {
        if (typeof err.response.data.detail === 'string') {
          detailMsg = err.response.data.detail;
        } else if (err.response.data.detail) {
          detailMsg = JSON.stringify(err.response.data.detail);
        } else if (err.response.data.message) {
          detailMsg = err.response.data.message;
        }
      } else if (err.message) {
        detailMsg = err.message;
      }

      setPaymentOpResult({
        success: false,
        message: detailMsg,
        statusCode: typeof httpStatus === 'number' ? `HTTP ${httpStatus}` : httpStatus
      });
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleRunAgentAnalysis = async (e) => {
    e.preventDefault();
    if (!agentInputId) return;

    setAnalyzingAgent(true);
    setAgentError(null);
    setAgentAnalysisResult(null);

    try {
      const res = await recoveryApi.analyzePayment(agentInputId);
      setLastApiTimestamp(new Date().toLocaleTimeString());
      setLastApiStatusCode(200);
      setAgentAnalysisResult(res);
    } catch (err) {
      console.error('Agent analysis error:', err);
      setLastApiTimestamp(new Date().toLocaleTimeString());
      setLastApiStatusCode(err.response?.status || 500);
      setAgentError(
        err.response?.data?.detail || err.message || `Failed to run agent analysis for transaction ${agentInputId}`
      );
    } finally {
      setAnalyzingAgent(false);
    }
  };

  const prediction = agentAnalysisResult?.prediction;
  const decision = agentAnalysisResult?.agent_decision;
  const payment = agentAnalysisResult?.payment;
  const customerHistory = agentAnalysisResult?.customer_history;
  const priorityMeta = getPriorityMeta(decision?.priority || prediction?.recovery_priority || 'Low');

  return (
    <div className="page-container animate-fade-in">
      {/* Top Header Bar */}
      <div className="dashboard-top-bar">
        <div>
          <h1>Developer Tools & Recovery Simulator</h1>
          <p>Internal engineering console for testing end-to-end FastAPI & PostgreSQL flows</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={checkHealth}>
          <RefreshCw size={13} />
          <span>Ping API Health</span>
        </button>
      </div>

      {/* System Telemetry & Connection Status Bar */}
      <div className="summary-bar-container">
        <div className="summary-cell">
          <span className="summary-label">Backend API URL</span>
          <div className="summary-value text-slate-800 text-sm font-mono mt-1">http://127.0.0.1:8000</div>
        </div>

        <div className="summary-cell">
          <span className="summary-label">Backend Server</span>
          <div className="summary-value text-sm font-semibold flex items-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${healthStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            <span className={healthStatus === 'connected' ? 'text-emerald-700' : 'text-red-600'}>
              {healthStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="summary-cell">
          <span className="summary-label">PostgreSQL Database</span>
          <div className="summary-value text-sm font-semibold flex items-center gap-1.5 mt-1">
            <Database size={13} className="text-slate-500" />
            <span className={healthStatus === 'connected' ? 'text-emerald-700' : 'text-slate-500'}>
              {healthStatus === 'connected' ? 'Connected' : 'Unknown'}
            </span>
          </div>
        </div>

        <div className="summary-cell">
          <span className="summary-label">Last API Timestamp</span>
          <div className="summary-value text-slate-700 text-sm font-mono mt-1">
            {lastApiTimestamp || '—'}
          </div>
        </div>

        <div className="summary-cell">
          <span className="summary-label">Last HTTP Status</span>
          <div className="summary-value text-slate-900 text-sm font-mono mt-1">
            {lastApiStatusCode ? `${lastApiStatusCode}` : '—'}
          </div>
        </div>
      </div>

      {/* Two Column Section Grid */}
      <div className="charts-grid mt-2">
        {/* Section A: Payment Simulator */}
        <div className="panel-card">
          <div className="panel-header-row">
            <div>
              <h2>Payment Simulator</h2>
              <p className="panel-subtitle">Dispatches POST /payments request to FastAPI & SQLAlchemy engine</p>
            </div>
            <PlusCircle size={16} className="text-sky-600" />
          </div>

          <form onSubmit={handleCreatePaymentSubmit} className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Payment ID
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-500"
                  value={paymentForm.payment_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_id: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Customer ID
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-500"
                  value={paymentForm.customer_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customer_id: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Currency
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                  value={paymentForm.currency}
                  onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value })}
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Payment Method
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                >
                  <option value="UPI">UPI</option>
                  <option value="Netbanking">Netbanking</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Status
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                  value={paymentForm.status}
                  onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}
                >
                  <option value="failed">failed</option>
                  <option value="pending">pending</option>
                  <option value="captured">captured</option>
                  <option value="refunded">refunded</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Failure Reason
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500"
                  value={paymentForm.failure_reason}
                  onChange={(e) => setPaymentForm({ ...paymentForm, failure_reason: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-1">
              <button
                type="submit"
                disabled={creatingPayment}
                className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-2"
              >
                {creatingPayment ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Creating payment...</span>
                  </>
                ) : (
                  <>
                    <span>Create Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Operation Status Feedback Box */}
          {paymentOpResult && (
            <div className={`mt-3 p-3 rounded border text-xs ${paymentOpResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
              <div className="font-bold flex items-center gap-1.5">
                {paymentOpResult.success ? (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-700" />
                    <span>✓ {paymentOpResult.message}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} className="text-red-600" />
                    <span>✕ Unable to create payment</span>
                  </>
                )}
              </div>
              <div className="mt-1 flex gap-4 text-slate-700 font-mono">
                {paymentOpResult.payment_id && <span>Payment ID: {paymentOpResult.payment_id}</span>}
                <span>API Status: {paymentOpResult.statusCode}</span>
              </div>
              {!paymentOpResult.success && (
                <p className="mt-1 text-red-700 text-xs font-sans">{paymentOpResult.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Section B: Recovery Agent Tester */}
        <div className="panel-card">
          <div className="panel-header-row">
            <div>
              <h2>Recovery Agent Tester</h2>
              <p className="panel-subtitle">Executes GET /analytics/analyze/&#123;id&#125; and evaluates ML decision engine</p>
            </div>
            <Sparkles size={16} className="text-sky-600" />
          </div>

          <form onSubmit={handleRunAgentAnalysis} className="mt-3 flex gap-2">
            <input
              type="text"
              required
              placeholder="Enter Payment ID (e.g. ML_000001)..."
              className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-500"
              value={agentInputId}
              onChange={(e) => setAgentInputId(e.target.value)}
            />
            <button
              type="submit"
              disabled={analyzingAgent}
              className="btn-primary text-xs px-4 flex items-center gap-1.5"
            >
              {analyzingAgent ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Agent is analyzing payment...</span>
                </>
              ) : (
                <>
                  <span>Analyze Payment</span>
                </>
              )}
            </button>
          </form>

          {agentError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-300 rounded text-xs text-red-800">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-red-600" />
                <span>Agent Analysis Failed</span>
              </div>
              <p className="mt-1">{agentError}</p>
            </div>
          )}

          {/* Real Agent Response Output */}
          {agentAnalysisResult && (
            <div className="mt-3 flex flex-col gap-2">
              {/* Context Summary */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Payment Context</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-slate-500">Payment ID</span>
                    <p className="font-mono font-bold text-slate-900">{agentInputId}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Customer ID</span>
                    <p className="font-mono font-medium text-slate-800">{payment?.customer_id || prediction?.customer_id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Amount</span>
                    <p className="font-bold text-slate-900">{payment?.found ? formatCurrencyFull(payment.amount) : 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Status</span>
                    <p className="font-bold text-red-600 uppercase">{payment?.found ? payment.status : 'Prediction Only'}</p>
                  </div>
                </div>
              </div>

              {/* Risk Analysis Triplet */}
              <div className="metrics-triplet">
                <div className="triplet-item">
                  <span className="triplet-label">Failure Probability</span>
                  <span className="triplet-value text-red-600">{formatPercent(prediction?.failure_probability)}</span>
                </div>
                <div className="triplet-item">
                  <span className="triplet-label">Predicted Exposure</span>
                  <span className="triplet-value text-slate-900">{formatCurrencyCompact(prediction?.revenue_at_risk)}</span>
                </div>
                <div className="triplet-item">
                  <span className="triplet-label">Recovery Potential</span>
                  <span className="triplet-value text-emerald-700">{formatCurrencyCompact(prediction?.estimated_recoverable_revenue)}</span>
                </div>
              </div>

              {/* Agent Decision */}
              <div className="recommendation-box p-3 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sky-900 text-xs">Agent Recommendation</span>
                  <span className={`badge ${priorityMeta.badgeClass}`}>{priorityMeta.label} Priority</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Recommended Action:</span>
                  <span className="rec-action-badge">{decision?.recommended_action}</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-800 font-medium leading-relaxed">{decision?.reason}</p>
              </div>

              {/* Recovery Checklist */}
              {decision?.recovery_plan && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Recovery Plan Checklist</span>
                  <ul className="flex flex-col gap-1 text-slate-800">
                    {decision.recovery_plan.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckSquare size={13} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recovery Execution Endpoint Check Note */}
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                <span>Recovery execution endpoint not configured on backend. Execution operations remain in read-only analysis mode.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section C: Recent Payments Table (Live from GET /payments) */}
      <div className="panel-card mt-2">
        <div className="panel-header-row">
          <div>
            <h2>Recent Recorded Payments (Live GET /payments)</h2>
            <p className="panel-subtitle">Persisted transaction logs stored in PostgreSQL database</p>
          </div>
          <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={fetchRecentPayments} disabled={loadingPayments}>
            <RefreshCw size={12} className={loadingPayments ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Customer ID</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Payment Method</th>
                <th>Failure Reason</th>
              </tr>
            </thead>
            <tbody>
              {loadingPayments ? (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-slate-500">
                    Loading payments...
                  </td>
                </tr>
              ) : paymentsError ? (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-red-500">
                    {paymentsError}
                  </td>
                </tr>
              ) : recentPayments.length > 0 ? (
                recentPayments.map((p) => (
                  <tr key={p.payment_id} className="table-row-hover">
                    <td className="font-mono text-xs font-bold text-slate-900">{p.payment_id}</td>
                    <td className="font-mono text-xs text-slate-700">{p.customer_id}</td>
                    <td className="font-bold text-slate-900">{formatCurrencyFull(p.amount)}</td>
                    <td className="text-xs text-slate-600">{p.currency}</td>
                    <td>
                      <span className={`badge ${p.status === 'failed' ? 'badge-critical' : 'badge-low'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-700 font-medium">{p.payment_method || '—'}</td>
                    <td className="text-xs text-slate-600">{p.failure_reason || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-slate-500">
                    No payment records found in database. Use the Payment Simulator above to post test payments.
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
