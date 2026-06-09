import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { LogLevel } from "../../types/log";
import { getAllEntities } from "./api";
import EntitySection from "./EntitySection";
// Secciones ocultas; solo se muestra la de Logs
// import HealthCards from "./HealthCards";
// import StatsOverview from "./StatsOverview";
import { LoadingSpinner } from "../ui";
import { TOKEN_KEY } from "../../api/auth";

export default function Dashboard() {
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [copyLabel, setCopyLabel] = useState<"Copy Token" | "Copied!">("Copy Token");
  const [globalLevelFilter, setGlobalLevelFilter] = useState<LogLevel | null>(null);
  const [globalCorrelationId, setGlobalCorrelationId] = useState<string>("");

  const handleGlobalLevelFilter = (level: LogLevel) => {
    setGlobalLevelFilter(prev => prev === level ? null : level);
  };

  const handleGlobalCorrelationId = (correlationId: string) => {
    setGlobalCorrelationId(correlationId);
  };

  const handleCopyToken = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const copy = () => {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = token;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return true;
      } catch {
        return false;
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(
        () => {
          setCopyLabel("Copied!");
          setTimeout(() => setCopyLabel("Copy Token"), 2000);
        },
        () => {
          if (copy()) {
            setCopyLabel("Copied!");
            setTimeout(() => setCopyLabel("Copy Token"), 2000);
          }
        }
      );
    } else if (copy()) {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy Token"), 2000);
    }
  };

  const { data: entities = [], isLoading: isLoadingEntities } = useQuery({
    queryKey: ["allEntities"],
    queryFn: getAllEntities,
    refetchInterval: 30000,
  });

  if (isLoadingEntities && entities.length === 0) {
    return <LoadingSpinner message="Loading dashboard..." size="lg" fullScreen />;
  }

  const handleEntityToggle = (entity: string) => {
    setSelectedEntities(prev =>
      prev.includes(entity)
        ? prev.filter(e => e !== entity)
        : [...prev, entity]
    );
  };

  const displayedEntities = selectedEntities.length > 0 ? selectedEntities : entities;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Observability Dashboard</h1>
                <p className="text-slate-400 text-sm">Real-time system monitoring and logs</p>
              </div>
            </div>

            {/* Live indicator + Copy token - same row, same height */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-sm text-slate-300">Live</span>
                <span className="text-xs text-slate-500">Auto-refresh: 30s</span>
              </div>
              <button
                type="button"
                onClick={handleCopyToken}
                disabled={!localStorage.getItem(TOKEN_KEY)}
                className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 hover:border-slate-600/50 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copyLabel}
              </button>
            </div>
          </header>

          {/* Health Status Section - oculto; solo se muestra Logs */}
          {/* <section>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h2 className="text-lg font-semibold text-slate-200">System Health</h2>
            </div>
            <HealthCards />
          </section> */}

          {/* Stats Overview - oculto; solo se muestra Logs */}
          {/* <section>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h2 className="text-lg font-semibold text-slate-200">Metrics Overview</h2>
            </div>
            <StatsOverview activeLevelFilter={globalLevelFilter} onLevelFilterClick={handleGlobalLevelFilter} />
          </section> */}

          {/* Global Filters: Level Buttons + Trace ID */}
          <section>
            <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Level Toggle Buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide mr-2">Level</span>
                  <button
                    onClick={() => handleGlobalLevelFilter("info")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                      globalLevelFilter === "info"
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-lg shadow-blue-500/10"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Info
                  </button>
                  <button
                    onClick={() => handleGlobalLevelFilter("warning")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                      globalLevelFilter === "warning"
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/10"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Warning
                  </button>
                  <button
                    onClick={() => handleGlobalLevelFilter("error")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                      globalLevelFilter === "error"
                        ? "bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-lg shadow-rose-500/10"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Error
                  </button>
                  {globalLevelFilter && (
                    <button
                      onClick={() => setGlobalLevelFilter(null)}
                      className="px-2 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Trace ID Filter */}
                <div className="flex-1 sm:max-w-sm relative ml-auto">
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
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg pl-10 pr-10 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors"
                    value={globalCorrelationId}
                    onChange={(e) => setGlobalCorrelationId(e.target.value)}
                  />
                  {globalCorrelationId && (
                    <button
                      onClick={() => setGlobalCorrelationId("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {globalCorrelationId && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-purple-300">Showing all logs with Trace ID: <code className="font-mono bg-purple-500/20 px-1 rounded">{globalCorrelationId}</code></span>
                </div>
              )}
            </div>
          </section>

          {/* Entity Filter */}
          <section>
            <div className="bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-slate-200">Filter by Entity</h2>
                </div>
                {selectedEntities.length > 0 && (
                  <button
                    onClick={() => setSelectedEntities([])}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Clear filters ({selectedEntities.length})
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {isLoadingEntities ? (
                  <div className="text-sm text-slate-500">Loading entities...</div>
                ) : (
                  entities.map((entity) => (
                    <button
                      key={entity}
                      onClick={() => handleEntityToggle(entity)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                        selectedEntities.includes(entity)
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-lg shadow-blue-500/10'
                          : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50'
                      }`}
                    >
                      {entity}
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Logs Sections */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-slate-200">Log Streams</h2>
              <span className="text-xs text-slate-500 ml-2">
                {displayedEntities.length} {displayedEntities.length === 1 ? 'entity' : 'entities'}
              </span>
            </div>
            <div className="space-y-6">
              {displayedEntities.map((entity) => (
                <EntitySection
                  key={entity}
                  entity={entity}
                  globalLevelFilter={globalLevelFilter}
                  globalCorrelationId={globalCorrelationId}
                  onGlobalLevelClick={handleGlobalLevelFilter}
                  onCorrelationIdClick={handleGlobalCorrelationId}
                />
              ))}
              {!isLoadingEntities && entities.length === 0 && (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
                  <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-slate-400 text-lg font-medium">No entities found</p>
                  <p className="text-slate-500 text-sm mt-1">Logs will appear here once they are generated</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
