import axios from "axios";
import {
    IOType,
    DownloadFormat,
    IOHistoryListResponse,
    IOHistoryMetadata,
    IOHistoryProviders,
} from "../types/io-history.types";

// Use VITE_SCHEDULER_API_URL (same as scheduler) since io-history endpoints are in the scheduler
const GATEWAY_URL = process.env.GATEWAY_URL || process.env.VITE_SCHEDULER_API_URL || "http://localhost:5000";

export class IOHistoryService {
    private static getBaseUrl(): string {
        return `${GATEWAY_URL}/api/v1/io-history`;
    }

    private static getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        // Forward API key if configured
        const apiKey = process.env.X_API_KEY;
        if (apiKey) {
            headers["x-api-key"] = apiKey;
        }
        return headers;
    }

    static async listInputFiles(params: {
        provider?: string;
        from_date?: string;
        to_date?: string;
        ensemble?: string;
        simulation_environment?: string;
        page?: number;
        page_size?: number;
    }): Promise<IOHistoryListResponse> {
        const response = await axios.get<IOHistoryListResponse>(
            `${this.getBaseUrl()}/input`,
            {
                params,
                headers: this.getHeaders(),
            }
        );
        return response.data;
    }

    static async listOutputFiles(params: {
        provider?: string;
        from_date?: string;
        to_date?: string;
        ensemble?: string;
        simulation_environment?: string;
        page?: number;
        page_size?: number;
    }): Promise<IOHistoryListResponse> {
        const response = await axios.get<IOHistoryListResponse>(
            `${this.getBaseUrl()}/output`,
            {
                params,
                headers: this.getHeaders(),
            }
        );
        return response.data;
    }

    static async downloadFile(
        ioType: IOType,
        provider: string,
        filename: string,
        format: DownloadFormat = DownloadFormat.ORIGINAL
    ): Promise<{ data: Buffer; contentType: string; filename: string }> {
        const response = await axios.get(
            `${this.getBaseUrl()}/${ioType}/${provider}/${filename}/download`,
            {
                params: { format },
                headers: this.getHeaders(),
                responseType: "arraybuffer",
            }
        );

        // Extract filename from Content-Disposition header
        const contentDisposition = response.headers["content-disposition"];
        let downloadFilename = filename;
        if (contentDisposition) {
            const match = contentDisposition.match(/filename=([^;]+)/);
            if (match) {
                downloadFilename = match[1].replace(/"/g, "");
            }
        }

        return {
            data: Buffer.from(response.data),
            contentType: response.headers["content-type"] || "application/octet-stream",
            filename: downloadFilename,
        };
    }

    static async getMetadata(): Promise<IOHistoryMetadata> {
        const response = await axios.get<IOHistoryMetadata>(
            `${this.getBaseUrl()}/metadata`,
            {
                headers: this.getHeaders(),
            }
        );
        return response.data;
    }

    static async getProviders(): Promise<IOHistoryProviders> {
        const response = await axios.get<IOHistoryProviders>(
            `${this.getBaseUrl()}/providers`,
            {
                headers: this.getHeaders(),
            }
        );
        return response.data;
    }

    static async getSimulationDates(
        ioType?: string,
        provider?: string
    ): Promise<{ simulation_dates: string[]; count: number }> {
        const response = await axios.get<{ simulation_dates: string[]; count: number }>(
            `${this.getBaseUrl()}/simulation-dates`,
            {
                params: { io_type: ioType, provider },
                headers: this.getHeaders(),
            }
        );
        return response.data;
    }
}
