export interface ReportFile {
    filename: string;
    size: number;
    modified_at: number;
    modified_at_iso: string;
}

export interface ReportsListQuery {
    provider?: string;
    simulation_date?: string;
    limit?: number;
    offset?: number;
}

export interface ReportsListResponse {
    files: ReportFile[];
    path: string;
    total_count: number;
}

