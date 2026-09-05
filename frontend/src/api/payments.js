import apiClient from './client';

export const paymentsApi = {
  /**
   * Fetch all recorded payments from /payments
   */
  async getPayments() {
    const response = await apiClient.get('/payments');
    return response.data;
  },

  /**
   * Post a new payment record to /payments
   */
  async createPayment(paymentData) {
    const response = await apiClient.post('/payments', paymentData);
    return response.data;
  },
};

export default paymentsApi;
