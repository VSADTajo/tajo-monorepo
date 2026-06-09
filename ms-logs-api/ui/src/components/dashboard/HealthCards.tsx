import { useQuery } from "@tanstack/react-query";
import { getHealthStatus, getPredictionsApiHealth } from "./api";
import type { ServiceHealth, PredictionsApiHealth } from "../../types/health";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function StatusIndicator({ status }: { status: "up" | "down" | "degraded" }) {
  const colors = {
    up: "bg-emerald-500",
    down: "bg-red-500",
    degraded: "bg-amber-500",
  };

  return (
    <span className="relative flex h-3 w-3">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75`}></span>
      <span className={`relative inline-flex rounded-full h-3 w-3 ${colors[status]}`}></span>
    </span>
  );
}

function ServiceCard({
  name,
  service,
  icon
}: {
  name: string;
  service: ServiceHealth | PredictionsApiHealth;
  icon: React.ReactNode;
}) {
  const statusText = service.status === "up" ? "UP" : service.status === "down" ? "DOWN" : "DEGRADED";
  const statusColor = service.status === "up" ? "text-emerald-400" :
                      service.status === "down" ? "text-red-400" : "text-amber-400";

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/70 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-700/50 rounded-lg text-slate-300">
            {icon}
          </div>
          <span className="text-sm font-medium text-slate-200">{name}</span>
        </div>
        <StatusIndicator status={service.status === "degraded" ? "degraded" : service.status} />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Status</span>
          <span className={`font-medium ${statusColor}`}>
            {statusText}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Response</span>
          <span className="text-slate-200">
            {service.responseTime !== undefined ? `${service.responseTime}ms` : '-'}
          </span>
        </div>
        {service.details && (
          <div className="text-xs text-red-400 mt-2 truncate" title={service.details}>
            {service.details}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemMetricCard({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: "blue" | "purple" | "emerald" | "amber";
}) {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    emerald: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    amber: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-slate-400">{icon}</div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
}

export default function HealthCards() {
  const { data: health, isLoading, isError } = useQuery({
    queryKey: ["healthStatus"],
    queryFn: getHealthStatus,
    refetchInterval: 15000,
  });

  const { data: predictionsHealth, isLoading: isPredictionsLoading } = useQuery({
    queryKey: ["predictionsApiHealth"],
    queryFn: getPredictionsApiHealth,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl h-24"></div>
        ))}
      </div>
    );
  }

  if (isError || !health) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
        <span className="text-red-400 text-sm">Unable to fetch health status</span>
      </div>
    );
  }

  // Calculate overall status including predictions API
  const allServicesUp = health.services.api.status === "up" &&
                        health.services.database.status === "up" &&
                        (predictionsHealth?.status === "up" || isPredictionsLoading);

  const overallStatus = health.status === "healthy" && allServicesUp ? "healthy" :
                        health.status === "unhealthy" ? "unhealthy" : "degraded";

  const statusMessage = overallStatus === "healthy"
    ? "All services operational"
    : overallStatus === "degraded"
    ? "Some services degraded"
    : "System unhealthy";

  return (
    <div className="space-y-4">
      {/* Main Status Banner */}
      <div className={`rounded-xl p-4 border ${
        overallStatus === "healthy"
          ? "bg-emerald-500/10 border-emerald-500/30"
          : overallStatus === "degraded"
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-red-500/10 border-red-500/30"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIndicator status={overallStatus === "healthy" ? "up" : overallStatus === "degraded" ? "degraded" : "down"} />
            <div>
              <h3 className={`font-semibold ${
                overallStatus === "healthy" ? "text-emerald-400" :
                overallStatus === "degraded" ? "text-amber-400" : "text-red-400"
              }`}>
                System {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
              </h3>
              <p className="text-xs text-slate-400">
                {statusMessage} • v{health.version}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-slate-200">Uptime</div>
            <div className="text-lg font-bold text-white">{formatUptime(health.uptime)}</div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ServiceCard
          name="API Server"
          service={health.services.api}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          }
        />
        <ServiceCard
          name="MongoDB"
          service={health.services.database}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          }
        />
        <ServiceCard
          name="Predictions API"
          service={predictionsHealth || { status: "down", details: "Loading..." }}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SystemMetricCard
          title="Memory Usage"
          value={`${health.system.memory.usagePercent}%`}
          subtitle={`${health.system.memory.used}MB / ${health.system.memory.total}MB`}
          color={health.system.memory.usagePercent > 80 ? "amber" : "blue"}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
        />
        <SystemMetricCard
          title="CPU Cores"
          value={health.system.cpu.cores}
          subtitle="Available cores"
          color="purple"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
        />
        <SystemMetricCard
          title="Load Average"
          value={health.system.cpu.loadAverage[0]?.toFixed(2) || "0.00"}
          subtitle="1 min avg"
          color="emerald"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <SystemMetricCard
          title="API Response"
          value={health.services.api.responseTime !== undefined ? `${health.services.api.responseTime}ms` : '-'}
          subtitle="Current latency"
          color="blue"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
