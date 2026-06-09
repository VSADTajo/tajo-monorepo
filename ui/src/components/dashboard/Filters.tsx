import { useEffect, useState } from "react";
import type { LogLevel } from "../../types/log";

type DateRange = "1h" | "6h" | "24h" | "7d";

interface FiltersProps {
  onChange: (filters: { level: LogLevel | "ALL"; range: DateRange; search: string; correlationId: string }) => void;
  externalLevel?: LogLevel | null;
  externalCorrelationId?: string;
  onLevelClick?: (level: LogLevel) => void;
  onCorrelationIdClick?: (correlationId: string) => void;
}

export default function Filters({ onChange, externalLevel, externalCorrelationId, onLevelClick, onCorrelationIdClick }: FiltersProps) {
  const [search, setSearch] = useState<string>("");
  const [level, setLevel] = useState<LogLevel | "ALL">("ALL");
  const [range, setRange] = useState<DateRange>("6h");
  const [correlationId, setCorrelationId] = useState<string>("");

  const levels: { value: LogLevel; label: string; bgActive: string; bgInactive: string; textActive: string }[] = [
    { value: "info", label: "Info", bgActive: "bg-blue-500/20 border-blue-500/50", bgInactive: "bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50", textActive: "text-blue-300" },
    { value: "warning", label: "Warning", bgActive: "bg-amber-500/20 border-amber-500/50", bgInactive: "bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50", textActive: "text-amber-300" },
    { value: "error", label: "Error", bgActive: "bg-rose-500/20 border-rose-500/50", bgInactive: "bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50", textActive: "text-rose-300" },
  ];

  const ranges: { value: DateRange; label: string }[] = [
    { value: "1h", label: "1h" },
    { value: "6h", label: "6h" },
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
  ];

  useEffect(() => {
    if (externalLevel !== undefined) {
      setLevel(externalLevel ?? "ALL");
    }
  }, [externalLevel]);

  useEffect(() => {
    if (externalCorrelationId !== undefined) {
      setCorrelationId(externalCorrelationId);
    }
  }, [externalCorrelationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ level, range, search, correlationId: correlationId.trim() });
    }, 500);

    return () => clearTimeout(timer);
  }, [search, level, range, correlationId, onChange]);

  const handleLevelToggle = (clickedLevel: LogLevel) => {
    const newLevel = level === clickedLevel ? "ALL" : clickedLevel;
    setLevel(newLevel);
    if (newLevel !== "ALL") onLevelClick?.(newLevel);
  };

  return (
    <div className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-xl p-4 space-y-3">
      {/* Row 1: Level buttons + Time range */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Level Toggle Buttons */}
        <div className="flex items-center gap-2">
          {levels.map((l) => (
            <button
              key={l.value}
              onClick={() => handleLevelToggle(l.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                level === l.value
                  ? `${l.bgActive} ${l.textActive} shadow-lg`
                  : `${l.bgInactive} text-slate-400`
              }`}
            >
              {l.label}
            </button>
          ))}
          {level !== "ALL" && (
            <button
              onClick={() => setLevel("ALL")}
              className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Time Range */}
        <div className="flex items-center gap-1 ml-auto">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all ${
                range === r.value
                  ? "bg-slate-700/50 border-slate-600/50 text-slate-200"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Search + Correlation ID */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search messages, metadata..."
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Correlation ID / Trace ID */}
        <div className="sm:w-64 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <input
            type="text"
            placeholder="Filter by Trace ID..."
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors"
            value={correlationId}
            onChange={(e) => {
              setCorrelationId(e.target.value);
              onCorrelationIdClick?.(e.target.value);
            }}
          />
          {correlationId && (
            <button
              onClick={() => {
                setCorrelationId("");
                onCorrelationIdClick?.("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
