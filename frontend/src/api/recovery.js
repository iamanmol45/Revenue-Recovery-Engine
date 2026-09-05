import apiClient from './client';

export const recoveryApi = {
  /**
   * Fetch overall recovery metrics from /analytics/overview
   */
  async getRecoveryMetrics() {
    const response = await apiClient.get('/analytics/overview');
    return response.data;
  },

  /**
   * Fetch prioritized recovery predictions queue from /analytics/recovery-queue
   */
  async getRecoveryQueue(limit = 150) {
    const response = await apiClient.get(`/analytics/recovery-queue?limit=${limit}`);
    return response.data;
  },

  /**
   * Fetch priority level breakdown from /analytics/priorities
   */
  async getPriorities() {
    const response = await apiClient.get('/analytics/priorities');
    return response.data;
  },

  /**
   * Fetch recovery risk trend data from /analytics/trend
   */
  async getTrend() {
    const response = await apiClient.get('/analytics/trend');
    return response.data;
  },

  /**
   * Run AI Agent analysis for a transaction ID from /analytics/analyze/{payment_id}
   */
  async analyzePayment(paymentId) {
    const response = await apiClient.get(`/analytics/analyze/${paymentId}`);
    return response.data;
  },

  /**
   * Dispatch recovery action (invokes POST /analytics/recover/{payment_id} to persist attempt to PostgreSQL)
   */
  async initiateRecovery(paymentId, action) {
    const response = await apiClient.post(`/analytics/recover/${paymentId}`);
    return response.data;
  },

  /**
   * Fetch all recovery attempts with optional status/action/payment_id filters
   */
  async getRecoveryAttempts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.action) params.append('action', filters.action);
    if (filters.payment_id) params.append('payment_id', filters.payment_id);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get(`/analytics/recovery-attempts${queryString}`);
    return response.data;
  },

  /**
   * Fetch payment-specific recovery history log
   */
  async getPaymentRecoveryAttempts(paymentId) {
    const response = await apiClient.get(`/analytics/recovery-attempts/${paymentId}`);
    return response.data;
  },

  /**
   * Resolve outcome status (Successful/Failed) for a pending recovery attempt
   */
  async resolveRecoveryAttempt(attemptId, payload) {
    const response = await apiClient.patch(`/analytics/recovery-attempts/${attemptId}`, payload);
    return response.data;
  },
};

export default recoveryApi;
