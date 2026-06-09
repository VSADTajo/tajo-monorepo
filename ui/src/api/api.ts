import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { TOKEN_KEY, tryRefreshAndGetToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('VITE_API_URL is not defined. Please configure it in your .env file.');
}

const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: RetryConfig = error.config;
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }
    if (originalRequest._retried) {
      window.location.href = '/login';
      return Promise.reject(error);
    }
    originalRequest._retried = true;
    const newToken = await tryRefreshAndGetToken();
    if (!newToken) {
      window.location.href = '/login';
      return Promise.reject(error);
    }
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return apiClient.request(originalRequest);
  }
);

export default apiClient;
