import { useQuery } from '@tanstack/react-query';
import { FileDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExportParams } from '../../types/exports';
import { directDownloadExport, getPredictionTypes, postExportAsync } from './exports-api';

const PREDICTED_BY_OPTIONS = [
  { value: 'HEC_HMS_AUTO', label: 'HEC_HMS_AUTO' },
  { value: 'LISFLOOD_AUTO', label: 'LISFLOOD_AUTO' },
];

const PREDICTION_PROVIDER_OPTIONS = [
  { value: 'WRF', label: 'WRF' },
  { value: 'ECMWF', label: 'ECMWF' },
  { value: 'SMC', label: 'SMC' },
];

/** Format Date for datetime-local input (YYYY-MM-DDTHH:mm) */
function toDateTimeLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Default date range: start = 24h ago, end = now */
function getDefaultDateRange(): { start_date: string; end_date: string } {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return { start_date: toDateTimeLocal(start), end_date: toDateTimeLocal(now) };
}

/** Convert datetime-local value (YYYY-MM-DDTHH:mm) to YYYY-MM-DD HH:MM:SS */
function toApiDateTime(value: string): string {
  if (!value) return '';
  const s = value.trim();
  if (s.includes('T')) {
    const part = s.replace('T', ' ');
    return part.includes(':') && part.split(':').length >= 3 ? part : `${part}:00`;
  }
  return `${s} 00:00:00`;
}

const MAX_RANGE_MS = 48 * 60 * 60 * 1000; // 48 hours

/** Validate date range: required, end > start, and range ≤ 48 hours. */
function validateDateRange(startStr: string, endStr: string): { valid: true } | { valid: false; message: string } {
  const start = toApiDateTime(startStr);
  const end = toApiDateTime(endStr);
  if (!start || !end) {
    return { valid: false, message: 'Start date and End date are required.' };
  }
  const startDate = new Date(start.replace(' ', 'T'));
  const endDate = new Date(end.replace(' ', 'T'));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { valid: false, message: 'Invalid date format.' };
  }
  if (endDate.getTime() <= startDate.getTime()) {
    return { valid: false, message: 'End date must be after start date.' };
  }
  if (endDate.getTime() - startDate.getTime() > MAX_RANGE_MS) {
    return { valid: false, message: 'The date range cannot exceed 48 hours.' };
  }
  return { valid: true };
}

const defaultParams: ExportParams = {
  predicted_by: 'HEC_HMS_AUTO',
  prediction_type: 'Discharge',
  prediction_provider: 'WRF',
  start_date: '',
  end_date: '',
};

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function ExportCsvModal({ isOpen, onClose, onSuccess, onError }: ExportCsvModalProps) {
  const [params, setParams] = useState<ExportParams>(() => ({
    ...defaultParams,
    ...getDefaultDateRange(),
  }));
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: predictionTypes = [] } = useQuery({
    queryKey: ['exports-prediction-types'],
    queryFn: () => getPredictionTypes(100),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (isOpen && predictionTypes.length > 0 && !predictionTypes.some((t) => t.name === params.prediction_type)) {
      setParams((p) => ({ ...p, prediction_type: predictionTypes[0].name }));
    }
  }, [isOpen, predictionTypes, params.prediction_type]);

  if (!isOpen) return null;

  const handleDirectDownload = async () => {
    const validation = validateDateRange(params.start_date, params.end_date);
    if (!validation.valid) {
      onError(validation.message);
      return;
    }
    const start = toApiDateTime(params.start_date);
    const end = toApiDateTime(params.end_date);
    setDownloading(true);
    try {
      const payload: ExportParams = {
        ...params,
        start_date: start,
        end_date: end,
      };
      if (params.max_rows != null && params.max_rows >= 1 && params.max_rows <= 100000) {
        payload.max_rows = params.max_rows;
      }
      const blob = await directDownloadExport(payload);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      onSuccess('CSV downloaded.');
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const handleGenerateBackground = async () => {
    const validation = validateDateRange(params.start_date, params.end_date);
    if (!validation.valid) {
      onError(validation.message);
      return;
    }
    const start = toApiDateTime(params.start_date);
    const end = toApiDateTime(params.end_date);
    setGenerating(true);
    try {
      const res = await postExportAsync({
        ...params,
        start_date: start,
        end_date: end,
      });
      onSuccess(res.message || 'Export started. Download the file when ready from the list below.');
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setGenerating(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20';
  const labelClass = 'block text-xs text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="rounded-xl bg-slate-800 border border-slate-600 shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Generate CSV report</h3>
        <p className="text-sm text-slate-400 mb-4">
          Date range must be at most 48 hours. Format: YYYY-MM-DD HH:MM or use the pickers.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Predicted by</label>
            <select
              value={params.predicted_by}
              onChange={(e) => setParams((p) => ({ ...p, predicted_by: e.target.value }))}
              className={inputClass}
            >
              {PREDICTED_BY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Prediction type</label>
            <select
              value={params.prediction_type}
              onChange={(e) => setParams((p) => ({ ...p, prediction_type: e.target.value }))}
              className={inputClass}
            >
              {predictionTypes.length === 0 && (
                <option value={params.prediction_type}>{params.prediction_type}</option>
              )}
              {predictionTypes.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Prediction provider</label>
            <select
              value={params.prediction_provider}
              onChange={(e) => setParams((p) => ({ ...p, prediction_provider: e.target.value }))}
              className={inputClass}
            >
              {PREDICTION_PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Start date</label>
            <input
              type="datetime-local"
              value={params.start_date}
              onChange={(e) => setParams((p) => ({ ...p, start_date: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>End date</label>
            <input
              type="datetime-local"
              value={params.end_date}
              onChange={(e) => setParams((p) => ({ ...p, end_date: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Max rows (optional, for direct download only; leave empty for all)</label>
            <input
              type="text"
              inputMode="numeric"
              value={params.max_rows === undefined ? '' : String(params.max_rows)}
              onChange={(e) => {
                const raw = e.target.value.trim().toLowerCase();
                if (raw === '' || raw === 'all') {
                  setParams((p) => ({ ...p, max_rows: undefined }));
                  return;
                }
                const n = Number(raw);
                if (!Number.isNaN(n)) setParams((p) => ({ ...p, max_rows: Math.min(100000, Math.max(1, Math.floor(n))) }));
              }}
              className={inputClass}
              placeholder="All"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerateBackground}
            disabled={generating || downloading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-600 text-white hover:bg-slate-500 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Generate in background
          </button>
          <button
            type="button"
            onClick={handleDirectDownload}
            disabled={downloading || generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Download now (up to 100k rows)
          </button>
        </div>
      </div>
    </div>
  );
}
