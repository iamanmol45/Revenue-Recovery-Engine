import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AnalysisDrawer from './components/AnalysisDrawer';
import Toast from './components/Toast';
import Chatbot from './components/Chatbot';
import OverviewPage from './pages/OverviewPage';
import TransactionsPage from './pages/TransactionsPage';
import RecoveryQueuePage from './pages/RecoveryQueuePage';
import AIInsightsPage from './pages/AIInsightsPage';
import CustomersPage from './pages/CustomersPage';
import ReportsPage from './pages/ReportsPage';
import DevToolsPage from './pages/DevToolsPage';
import RecoveryHistoryPage from './pages/RecoveryHistoryPage';
import { api } from './services/api';
import './App.css';

const VALID_PAGES = ['overview', 'transactions', 'queue', 'insights', 'customers', 'reports', 'devtools', 'history'];

const getPageFromHash = () => {
  if (typeof window !== 'undefined' && window.location.hash) {
    const raw = window.location.hash.replace('#', '').toLowerCase().trim();
    if (VALID_PAGES.includes(raw)) {
      return raw;
    }
  }
  return 'overview';
};

export default function App() {
  const [activePage, setActivePageState] = useState(getPageFromHash);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const [metrics, setMetrics] = useState(null);
  const [queue, setQueue] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const setActivePage = useCallback((page) => {
    setActivePageState(page);
    if (typeof window !== 'undefined') {
      window.location.hash = page;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const page = getPageFromHash();
      setActivePageState(page);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, queueRes, prioritiesRes, trendRes] = await Promise.all([
        api.getOverview(),
        api.getRecoveryQueue(150),
        api.getPriorities(),
        api.getTrend().catch(e => {
          console.error("Failed to load trend data:", e);
          return { trend: [] };
        })
      ]);

      setMetrics(overviewRes);
      setQueue(queueRes || []);
      setPriorities(prioritiesRes || []);
      setTrend(trendRes?.trend || []);
    } catch (err) {
      console.error('Error fetching dashboard telemetry:', err);
      setError(
        err.message || 'Failed to connect to backend API server at http://127.0.0.1:8000'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleOpenAnalysis = (paymentId) => {
    setSelectedPaymentId(paymentId);
  };

  const handleCloseAnalysis = () => {
    setSelectedPaymentId(null);
  };

  const handleInitiateSuccess = (msg) => {
    setToastMessage(msg || 'Recovery action recorded successfully');
    loadDashboardData();
  };

  return (
    <div className="app-root">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        metrics={metrics}
      />

      <div className="main-wrapper">
        {/* Top Navbar */}
        <Navbar
          activePage={activePage}
          setActivePage={setActivePage}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          metrics={metrics}
        />

        {/* Main Content Viewport */}
        <main className="main-content-viewport">
          {activePage === 'overview' && (
            <OverviewPage
              metrics={metrics}
              queue={queue}
              priorities={priorities}
              trend={trend}
              loading={loading}
              error={error}
              onAnalyze={handleOpenAnalysis}
              onRefresh={loadDashboardData}
            />
          )}

          {activePage === 'transactions' && (
            <TransactionsPage
              queue={queue}
              loading={loading}
              error={error}
              onAnalyze={handleOpenAnalysis}
              onRefresh={loadDashboardData}
            />
          )}

          {activePage === 'queue' && (
            <RecoveryQueuePage
              queue={queue}
              metrics={metrics}
              loading={loading}
              error={error}
              onAnalyze={handleOpenAnalysis}
              onRefresh={loadDashboardData}
            />
          )}

          {activePage === 'insights' && (
            <AIInsightsPage
              metrics={metrics}
              priorities={priorities}
              queue={queue}
              loading={loading}
              onAnalyze={handleOpenAnalysis}
            />
          )}

          {activePage === 'history' && (
            <RecoveryHistoryPage onSelectPayment={handleOpenAnalysis} />
          )}

          {activePage === 'customers' && <CustomersPage />}

          {activePage === 'reports' && (
            <ReportsPage metrics={metrics} priorities={priorities} queue={queue} />
          )}

          {activePage === 'devtools' && <DevToolsPage />}
        </main>
      </div>

      {/* AI Analysis Slide-over Drawer */}
      {selectedPaymentId && (
        <AnalysisDrawer
          paymentId={selectedPaymentId}
          onClose={handleCloseAnalysis}
          onInitiateSuccess={handleInitiateSuccess}
        />
      )}

      {/* Toast Feedback Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* AI Revenue Assistant Chatbot */}
      <Chatbot />
    </div>
  );
}