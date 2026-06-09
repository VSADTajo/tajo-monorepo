import axios from "axios";

const PREDICTIONS_API_URL =
    process.env.PREDICTIONS_SIMULATIONS_API_URL || "http://37.27.133.251:8000";
const PREDICTIONS_BASE = `${PREDICTIONS_API_URL}/api/v1`.replace(/\/+$/, "");
const EXPORTS_BASE = `${PREDICTIONS_BASE}/exports`;

function getHeaders(json = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) {
        headers["Content-Type"] = "application/json";
        headers["Accept"] = "application/json";
    }
    const bearerToken = process.env.PREDICTIONS_SIMULATIONS_BEARER_TOKEN;
    if (bearerToken) {
        headers["Authorization"] = `Bearer ${bearerToken}`;
    } else {
        const apiKey =
            process.env.PREDICTIONS_SIMULATIONS_X_API_KEY || process.env.X_API_KEY;
        if (apiKey) headers["x-api-key"] = apiKey;
    }
    return headers;
}

export interface ExportListResponse {
    files: Array<{ filename: string; size_bytes: number; modified_at: string }>;
}

export interface PostExportResponse {
    message: string;
    export_id: string;
    download_path: string;
}

export interface PredictionTypeItem {
    id: number;
    name: string;
    unit: string;
    created_at: string;
}

export class ExportsService {
    static async getPredictionTypes(limit = 100): Promise<PredictionTypeItem[]> {
        const { data } = await axios.get<PredictionTypeItem[]>(
            `${PREDICTIONS_BASE}/prediction-types/`,
            { params: { limit }, headers: getHeaders() }
        );
        return Array.isArray(data) ? data : [];
    }

    static async listFiles(): Promise<ExportListResponse> {
        const { data } = await axios.get<ExportListResponse>(`${EXPORTS_BASE}/files`, {
            headers: getHeaders(),
        });
        return data;
    }

    static async downloadFile(filename: string): Promise<{
        buffer: ArrayBuffer;
        contentType: string;
        contentDisposition: string | null;
    }> {
        const response = await axios.get<ArrayBuffer>(`${EXPORTS_BASE}/files/${encodeURIComponent(filename)}`, {
            responseType: "arraybuffer",
            headers: getHeaders(false),
            validateStatus: () => true,
        });
        if (response.status !== 200) {
            const text = typeof response.data === "string" ? response.data : new TextDecoder().decode(response.data);
            const err = new Error(text || `Download failed: ${response.status}`);
            (err as Error & { status?: number }).status = response.status;
            (err as Error & { data?: unknown }).data = response.data;
            throw err;
        }
        const contentType = response.headers["content-type"] ?? "application/octet-stream";
        const contentDisposition = response.headers["content-disposition"] ?? null;
        return {
            buffer: response.data as ArrayBuffer,
            contentType,
            contentDisposition,
        };
    }

    static async directDownload(params: {
        predicted_by: string;
        prediction_type: string;
        prediction_provider: string;
        start_date: string;
        end_date: string;
        max_rows?: number;
    }): Promise<{ buffer: ArrayBuffer; contentType: string; contentDisposition: string | null }> {
        const query: Record<string, string | number> = {
            predicted_by: params.predicted_by,
            prediction_type: params.prediction_type,
            prediction_provider: params.prediction_provider,
            start_date: params.start_date,
            end_date: params.end_date,
        };
        if (params.max_rows != null) query.max_rows = params.max_rows;

        const response = await axios.get<ArrayBuffer>(`${EXPORTS_BASE}/prediction-results/download`, {
            params: query,
            responseType: "arraybuffer",
            headers: getHeaders(false),
            validateStatus: () => true,
        });
        if (response.status !== 200) {
            const text = typeof response.data === "string" ? response.data : new TextDecoder().decode(response.data);
            const err = new Error(text || `Export failed: ${response.status}`);
            (err as Error & { status?: number }).status = response.status;
            throw err;
        }
        const contentType = response.headers["content-type"] ?? "application/octet-stream";
        const contentDisposition = response.headers["content-disposition"] ?? null;
        return {
            buffer: response.data as ArrayBuffer,
            contentType,
            contentDisposition,
        };
    }

    static async postExportAsync(params: {
        predicted_by: string;
        prediction_type: string;
        prediction_provider: string;
        start_date: string;
        end_date: string;
    }): Promise<PostExportResponse> {
        const response = await axios.post<PostExportResponse>(
            `${EXPORTS_BASE}/prediction-results`,
            null,
            {
                params: {
                    predicted_by: params.predicted_by,
                    prediction_type: params.prediction_type,
                    prediction_provider: params.prediction_provider,
                    start_date: params.start_date,
                    end_date: params.end_date,
                },
                headers: getHeaders(),
                validateStatus: (status) => status >= 200 && status < 300,
            }
        );
        return response.data;
    }
}
