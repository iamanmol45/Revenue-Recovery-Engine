import apiClient from './client';

export const chatApi = {
  sendMessage: async (message) => {
    const response = await apiClient.post('/chat', { message });
    return response.data;
  }
};

export default chatApi;
