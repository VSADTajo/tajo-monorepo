import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios, { AxiosRequestConfig } from 'axios';

import { IHttpService } from '@domain/types/http-service.type';

export type HttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE';

@Injectable()
export class HttpService implements IHttpService {
    constructor(
        @Inject('HTTP_BASE_URL') private readonly baseUrl: string,
        @Inject(Logger) private readonly logger: Logger,
    ) {}

    async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
        this.logger.debug(`Making get request to: ${path}`);
        const url = `${this.baseUrl}${path}`;
        const response = await axios.get<T>(url, config);
        return response.data;
    }

    async post<T, K = unknown>(path: string, data?: K, config?: AxiosRequestConfig): Promise<T> {
        this.logger.debug(`Making post request to: ${path}`);
        const url = `${this.baseUrl}${path}`;
        const response = await axios.post<T>(url, data, config);
        return response.data;
    }

    async put<T, K = unknown>(path: string, data?: K, config?: AxiosRequestConfig): Promise<T> {
        this.logger.debug(`Making put request to: ${path}`);
        const url = `${this.baseUrl}${path}`;
        const response = await axios.put<T>(url, data, config);
        return response.data;
    }

    async delete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
        this.logger.debug(`Making delete request to: ${path}`);
        const url = `${this.baseUrl}${path}`;
        const response = await axios.delete<T>(url, config);
        return response.data;
    }

    async request<T>(config: AxiosRequestConfig): Promise<T> {
        this.logger.debug(`Making request to: ${config.url}`);
        const response = await axios.request<T>(config);
        return response.data;
    }
}
