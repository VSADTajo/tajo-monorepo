import axios from "axios";
import type { ReportsListQuery, ReportsListResponse } from "../types/reports.types";

const REPORTS_BASE_URL =
    process.env.GATEWAY_URL || process.env.VITE_SCHEDULER_API_URL || "http://localhost:5000";

export class ReportsService {
    private static getBaseUrl(): string {
        return `${REPORTS_BASE_URL}/api/v1/reports`;
    }

    private static getTasksBaseUrl(): string {
        return `${REPORTS_BASE_URL}/api/v1/tasks`;
    }

    private static getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};

        const bearerToken = process.env.SCHEDULER_BEARER_TOKEN;
        if (bearerToken) {
            headers["Authorization"] = `Bearer ${bearerToken}`;
        }

        const apiKey = process.env.X_API_KEY;
        if (apiKey) {
            headers["x-api-key"] = apiKey;
        }

        return headers;
    }

    static async listReports(query: ReportsListQuery): Promise<ReportsListResponse> {
        const params: Record<string, string | number> = {};
        if (query.provider != null) params.provider = query.provider;
        if (query.simulation_date != null) {
            const sd = query.simulation_date;
            params.simulation_date = sd.length >= 10 ? sd.slice(0, 10) : sd;
        }
        if (query.limit != null) params.limit = query.limit;
        if (query.offset != null) params.offset = query.offset;
        const response = await axios.get<ReportsListResponse>(this.getBaseUrl(), {
            params,
            headers: this.getHeaders(),
        });
        return response.data;
    }

    static async downloadReport(
        filename: string
    ): Promise<{ data: Buffer; contentType: string; filename: string }> {
        const response = await axios.get(this.getBaseUrl() + `/${encodeURIComponent(filename)}`, {
            headers: this.getHeaders(),
            responseType: "arraybuffer",
        });

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
            contentType: response.headers["content-type"] || "text/plain",
            filename: downloadFilename,
        };
    }

    static async deleteReport(filename: string): Promise<void> {
        await axios.delete(this.getBaseUrl() + `/${encodeURIComponent(filename)}`, {
            headers: this.getHeaders(),
        });
    }

    static async generatePrevCabReport(force: boolean = false): Promise<unknown> {
        const response = await axios.post(
            `${this.getTasksBaseUrl()}/execute`,
            {
                task_name: "prev_cab_report",
                force,
            },
            { headers: { ...this.getHeaders(), "Content-Type": "application/json" } }
        );
        return response.data;
    }
}

