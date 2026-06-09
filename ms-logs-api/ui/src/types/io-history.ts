export enum IOType {
    INPUT = "input",
    OUTPUT = "output",
}

export enum ProviderType {
    WRF = "WRF",
    ECMWF = "ECMWF",
    SMC = "SMC",
}

export enum DownloadFormat {
    ORIGINAL = "original",
    CSV = "csv",
    JSON = "json",
    PARQUET = "parquet",
}

export interface IOHistoryFile {
    file: string;
    job_id: number;
    simulation_date: string;
    ensemble?: string | null;
    file_type: string;
    original_size_bytes: number;
    parquet_size_bytes: number;
    checksum: string;
    created_at: string;
    provider: string;
    io_type: IOType;
    file_path: string;
    simulation_environment?: string | null;
    _original_filename?: string;
}

export interface IOHistoryPagination {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
}

export interface IOHistoryFilters {
    provider?: string | null;
    from_date?: string | null;
    to_date?: string | null;
    ensemble?: string | null;
}

export interface IOHistoryListResponse {
    io_type: IOType;
    files: IOHistoryFile[];
    pagination: IOHistoryPagination;
    filters: IOHistoryFilters;
}

export interface IOHistoryProviders {
    input: Record<string, { file_count: number; path: string }>;
    output: Record<string, { file_count: number; path: string }>;
}
