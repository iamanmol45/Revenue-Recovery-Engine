import apiClient from './client';
import recoveryApi from './recovery';
import paymentsApi from './payments';
import customersApi from './customers';
import chatApi from './chat';

export { apiClient, recoveryApi, paymentsApi, customersApi, chatApi };

// Unified API facade
export const api = {
  getOverview: () => recoveryApi.getRecoveryMetrics(),
  getRecoveryMetrics: () => recoveryApi.getRecoveryMetrics(),
  getRecoveryQueue: (limit) => recoveryApi.getRecoveryQueue(limit),
  getPriorities: () => recoveryApi.getPriorities(),
  getTrend: () => recoveryApi.getTrend(),
  analyzePayment: (paymentId) => recoveryApi.analyzePayment(paymentId),
  initiateRecovery: (paymentId, action) => recoveryApi.initiateRecovery(paymentId, action),
  getRecoveryAttempts: (filters) => recoveryApi.getRecoveryAttempts(filters),
  getPaymentRecoveryAttempts: (paymentId) => recoveryApi.getPaymentRecoveryAttempts(paymentId),
  resolveRecoveryAttempt: (attemptId, payload) => recoveryApi.resolveRecoveryAttempt(attemptId, payload),
  getPayments: () => paymentsApi.getPayments(),
  createPayment: (data) => paymentsApi.createPayment(data),
  getCustomers: () => customersApi.getCustomers(),
  createCustomer: (data) => customersApi.createCustomer(data),
  sendMessage: (message) => chatApi.sendMessage(message),
};

export default api;
