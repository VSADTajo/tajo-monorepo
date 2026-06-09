import { AxiosRequestConfig } from 'axios';

export abstract class IHttpService {
    abstract get<T>(path: string, config?: AxiosRequestConfig): Promise<T>;
    abstract post<T, K = unknown>(path: string, data?: K, config?: AxiosRequestConfig): Promise<T>;
    abstract put<T, K = unknown>(path: string, data?: K, config?: AxiosRequestConfig): Promise<T>;
    abstract delete<T>(path: string, config?: AxiosRequestConfig): Promise<T>;
    abstract request<T>(config: AxiosRequestConfig): Promise<T>;
}
