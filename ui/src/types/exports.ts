/** CSV export file from GET /api/v1/exports/files */
export interface ExportFile {
  filename: string;
  size_bytes: number;
  modified_at: string;
}

export interface ExportListResponse {
  files: ExportFile[];
}

/** Params for direct download (GET) and async export (POST). Dates: YYYY-MM-DD HH:MM:SS */
export interface ExportParams {
  predicted_by: string;
  prediction_type: string;
  prediction_provider: string;
  start_date: string;
  end_date: string;
  max_rows?: number; // 1–100000, only for direct download
}

/** Response from POST /api/v1/exports/prediction-results */
export interface PostExportResponse {
  message: string;
  export_id: string;
  download_path: string;
}

/** Item from GET /api/v1/prediction-types/ */
export interface PredictionTypeItem {
  id: number;
  name: string;
  unit: string;
  created_at: string;
}
