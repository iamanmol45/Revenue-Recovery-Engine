import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  ShieldAlert,
  Loader2,
  CreditCard,
  Activity,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrencyCompact,
  formatPercent,
  getPriorityMeta
} from '../utils/formatters';

const LoadingStepRotator = () => {
  const steps = [
    'Evaluating payment risk telemetry',
    'Assessing customer behavior',
    'Determining recovery action',
    'Calculating recovery potential'
  ];
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
      <Loader2 size={14} className="animate-spin text-accent-blue" />
      <span style={{ minWidth: '220px', textAlign: 'center' }}>{steps[stepIndex]}...</span>
    </div>
  );
};

export default function AnalysisDrawer({ paymentId, onClose, onInitiateSuccess }) {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initiating, setInitiating] = useState(false);
  const [initiateError, setInitiateError] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const fetchAnalysisAndHistory = async () => {
    if (!paymentId) return;
    try {
      const [data, history] = await Promise.all([
        api.analyzePayment(paymentId),
        api.getPaymentRecoveryAttempts(paymentId)
      ]);
      setAnalysisData(data);
      setPaymentHistory(history || []);
    } catch (err) {
      console.error('Error refreshing analysis and history:', err);
    }
  };

  useEffect(() => {
    if (!paymentId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);
    setInitiateError(null);

    Promise.all([
      api.analyzePayment(paymentId),
      api.getPaymentRecoveryAttempts(paymentId)
    ])
      .then(([data, history]) => {
        if (isMounted) {
          setAnalysisData(data);
          setPaymentHistory(history || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load AI Recovery Analysis');
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [paymentId]);

  if (!paymentId) return null;

  const handleActionClick = async () => {
    if (!analysisData || initiating) return;
    setInitiating(true);
    setInitiateError(null);
    const action = analysisData?.agent_decision?.recommended_action || 'Immediate Recovery';

    try {
      const res = await api.initiateRecovery(paymentId, action);
      if (res.success) {
        await fetchAnalysisAndHistory();
        if (onInitiateSuccess) {
          onInitiateSuccess(res.message || `Recovery attempt created`);
        }
      } else {
        setInitiateError(res.message || 'Failed to create recovery attempt');
      }
    } catch (e) {
      setInitiateError(e.message || 'Failed to post recovery attempt');
    } finally {
      setInitiating(false);
    }
  };

  const prediction = analysisData?.prediction;
  const decision = analysisData?.agent_decision;
  const payment = analysisData?.payment;
  
  const priorityMeta = getPriorityMeta(decision?.priority || prediction?.recovery_priority || 'Low');

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        {/* Header (Fixed) */}
        <div className="drawer-header">
          <div className="drawer-title-area">
            <div className="ai-badge-header">
              <Sparkles size={14} style={{ marginRight: '4px' }} />
              <span>AI Decision Console</span>
            </div>
            <h2 className="drawer-payment-id">Payment {paymentId.split('-')[0]}...</h2>
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="drawer-body">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px' }}>
              <div style={{ marginBottom: '24px', position: 'relative' }}>
                <Sparkles size={48} className="text-accent-blue" style={{ animation: 'pulse 2s infinite' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Analyzing transaction</h3>
              
              <LoadingStepRotator />
              
              <div style={{ width: '250px', height: '4px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden', marginTop: '16px' }}>
                <div style={{ 
                  height: '100%', 
                  backgroundColor: 'var(--accent-blue)', 
                  width: '50%',
                  animation: 'indeterminateProgress 1.5s infinite ease-in-out',
                  transformOrigin: '0% 50%'
                }}></div>
              </div>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px' }}>
              <ShieldAlert size={48} className="text-red-500 mb-4" />
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Unable to analyze transaction</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px' }}>
                We couldn't retrieve the risk assessment for this payment.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-secondary" onClick={onClose}>Close</button>
                <button className="btn-primary" onClick={fetchAnalysisAndHistory}>Try Again</button>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Summary */}
              <div className="drawer-section-card">
                <div className="drawer-section-header">
                  <div className="drawer-section-title">
                    <CreditCard size={16} />
                    <span>Transaction Details</span>
                  </div>
                  <span className="badge badge-neutral">
                    {payment?.status || 'Unknown'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Payment ID</span>
                    <p className="font-mono" style={{ fontSize: '12px', marginTop: '4px', wordBreak: 'break-all' }}>{paymentId}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer ID</span>
                    <p className="font-mono" style={{ fontSize: '12px', marginTop: '4px', wordBreak: 'break-all' }}>{payment?.customer_id}</p>
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="drawer-section-card">
                <div className="drawer-section-header">
                  <div className="drawer-section-title">
                    <Activity size={16} />
                    <span>ML Risk Assessment</span>
                  </div>
                  <span className={`badge ${priorityMeta.badgeClass}`}>
                    {priorityMeta.label}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Failure Probability</span>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--semantic-red)', wordBreak: 'break-all' }}>
                      {formatPercent(prediction?.failure_probability || 0)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Predicted Exposure</span>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                      {formatCurrencyCompact(prediction?.revenue_at_risk || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Recommendation */}
              <div className="drawer-section-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                <div className="drawer-section-header">
                  <div className="drawer-section-title">
                    <Sparkles size={16} color="var(--accent-blue)" />
                    <span>AI Recommendation</span>
                  </div>
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                    {decision?.recommended_action || 'No Action Recommended'}
                  </span>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                    {decision?.reason || 'The model did not provide a specific reason.'}
                  </p>
                </div>

                {initiateError && (
                  <div style={{ background: 'var(--semantic-red-bg)', color: '#B91C1C', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} />
                    {initiateError}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer (Fixed) */}
        {!loading && !error && (
          <div className="drawer-footer">
            <button className="btn-secondary" onClick={onClose} disabled={initiating}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleActionClick} disabled={initiating}>
              {initiating ? (
                <>
                  <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                  Processing...
                </>
              ) : (
                'Initiate Recovery'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
