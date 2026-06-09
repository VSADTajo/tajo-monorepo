import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { TraceContext } from './trace-context';
export declare class TracedHttpClient {
    private readonly traceContext;
    constructor(traceContext: TraceContext);
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    private mergeHeaders;
}
//# sourceMappingURL=traced-http-client.d.ts.map