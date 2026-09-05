import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds (increased for LLM calls)
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
    console.log(`[API Request] ${config.method?.toUpperCase()} ${fullUrl}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    const fullUrl = `${response.config.baseURL || ''}${response.config.url || ''}`;
    console.log(`[API Response] ${response.status} ${fullUrl}`);
    return response;
  },
  (error) => {
    const fullUrl = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
    console.error(`[API Error] ${error.response?.status || 'Network Error'} ${fullUrl}:`, error.message);
    return Promise.reject(error);
  }
);

export default apiClient;

