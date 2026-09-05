import apiClient from './client';

export const customersApi = {
  /**
   * Fetch customer profiles list from /customers
   */
  async getCustomers() {
    const response = await apiClient.get('/customers');
    return response.data;
  },

  /**
   * Create a new customer profile via /customers
   */
  async createCustomer(customerData) {
    const response = await apiClient.post('/customers', customerData);
    return response.data;
  },
};

export default customersApi;
