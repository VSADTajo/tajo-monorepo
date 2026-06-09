import { Injectable } from '@nestjs/common';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { TraceContext } from './trace-context';
import { X_TRACE_ID_HEADER, X_USER_ID_HEADER } from './types';

@Injectable()
export class TracedHttpClient {
  constructor(private readonly traceContext: TraceContext) {}

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return axios.get<T>(url, this.mergeHeaders(config));
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return axios.post<T>(url, data, this.mergeHeaders(config));
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return axios.put<T>(url, data, this.mergeHeaders(config));
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return axios.patch<T>(url, data, this.mergeHeaders(config));
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return axios.delete<T>(url, this.mergeHeaders(config));
  }

  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return axios.request<T>(this.mergeHeaders(config));
  }

  private mergeHeaders(config?: AxiosRequestConfig): AxiosRequestConfig {
    const traceHeaders: Record<string, string> = {};

    try {
      const traceId = this.traceContext.traceId;
      if (traceId) {
        traceHeaders[X_TRACE_ID_HEADER] = traceId;
      }
      const userId = this.traceContext.userId;
      if (userId) {
        traceHeaders[X_USER_ID_HEADER] = userId;
      }
    } catch {
      // Outside of request scope (no CLS context) — skip header injection
    }

    return {
      ...config,
      headers: {
        ...traceHeaders,
        ...config?.headers,
      },
    };
  }
}
