import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getTotalLogsCount, getAllEntities, getLogStats } from "./api";
import type { LogLevel } from "../../types/log";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isUp: boolean };
  color: "blue" | "emerald" | "amber" | "rose" | "purple" | "slate";
  isClickable?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

const activeStyles: Partial<Record<StatCardProps["color"], { border: string; shadow: string; ring: string }>> = {
  emerald: {
    border: "border-emerald-400/60",
    shadow: "shadow-lg shadow-emerald-500/25",
    ring: "ring-1 ring-emerald-400/30",
  },
  amber: {
    border: "border-amber-400/60",
    shadow: "shadow-lg shadow-amber-500/25",
    ring: "ring-1 ring-amber-400/30",
  },
  rose: {
    border: "border-rose-400/60",
    shadow: "shadow-lg shadow-rose-500/25",
    ring: "ring-1 ring-rose-400/30",
  },
};

function StatCard({ title, value, subtitle, icon, trend, color, isClickable, isActive, onClick }: StatCardProps) {
  const colorClasses = {
    blue: {
      bg: "from-blue-500/10 to-blue-600/5",
      border: "border-blue-500/20",
      icon: "text-blue-400 bg-blue-500/20",
      value: "text-blue-400",
    },
    emerald: {
      bg: "from-emerald-500/10 to-emerald-600/5",
      border: "border-emerald-500/20",
      icon: "text-emerald-400 bg-emerald-500/20",
      value: "text-emerald-400",
    },
    amber: {
      bg: "from-amber-500/10 to-amber-600/5",
      border: "border-amber-500/20",
      icon: "text-amber-400 bg-amber-500/20",
      value: "text-amber-400",
    },
    rose: {
      bg: "from-rose-500/10 to-rose-600/5",
      border: "border-rose-500/20",
      icon: "text-rose-400 bg-rose-500/20",
      value: "text-rose-400",
    },
    purple: {
      bg: "from-purple-500/10 to-purple-600/5",
      border: "border-purple-500/20",
      icon: "text-purple-400 bg-purple-500/20",
      value: "text-purple-400",
    },
    slate: {
      bg: "from-slate-500/10 to-slate-600/5",
      border: "border-slate-500/20",
      icon: "text-slate-400 bg-slate-500/20",
      value: "text-slate-300",
    },
  };

  const classes = colorClasses[color];
  const active = isActive ? activeStyles[color] : null;

  return (
    <div
      className={`relative bg-gradient-to-br ${classes.bg} border ${
        active ? active.border : classes.border
      } rounded-xl p-5 transition-all duration-300 ${
        isClickable ? "cursor-pointer hover:scale-[1.02]" : "hover:scale-[1.02]"
      } ${
        active ? `${active.shadow} ${active.ring} scale-[1.02]` : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${classes.icon}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.isUp ? "text-emerald-400" : "text-rose-400"}`}>
            <svg
              className={`w-3 h-3 ${!trend.isUp && "rotate-180"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {trend.value}%
          </div>
        )}
      </div>
      <div className={`text-3xl font-bold ${classes.value} mb-1`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-sm text-slate-400">{title}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
      {active && (
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full mb-1.5 ${classes.value}`} style={{ backgroundColor: 'currentColor', opacity: 0.5 }} />
      )}
    </div>
  );
}

interface StatsOverviewProps {
  activeLevelFilter: LogLevel | null;
  onLevelFilterClick: (level: LogLevel) => void;
}

export default function StatsOverview({ activeLevelFilter, onLevelFilterClick }: StatsOverviewProps) {
  const dateRange = useMemo(() => {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 3600_000);
    return {
      dateFrom: sixHoursAgo.toISOString(),
      dateTo: now.toISOString(),
    };
  }, []);

  const { data: totalCount, isLoading: isLoadingTotal } = useQuery({
    queryKey: ["totalLogsCount"],
    queryFn: getTotalLogsCount,
    refetchInterval: 30000,
  });

  const { data: entities = [], isLoading: isLoadingEntities } = useQuery({
    queryKey: ["allEntities"],
    queryFn: getAllEntities,
    refetchInterval: 30000,
  });

  const { data: logStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["logStats", dateRange.dateFrom, dateRange.dateTo],
    queryFn: () => getLogStats(dateRange.dateFrom, dateRange.dateTo),
    refetchInterval: 30000,
  });

  const isLoading = isLoadingTotal || isLoadingEntities || isLoadingStats;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl h-32"></div>
        ))}
      </div>
    );
  }

  const stats = logStats || { info: 0, warning: 0, error: 0, total: 0 };
  const errorRate = stats.total > 0 ? ((stats.error / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard
        title="Total Logs"
        value={totalCount?.count || 0}
        subtitle="All time"
        color="slate"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />
      <StatCard
        title="Entities"
        value={entities.length}
        subtitle="Active services"
        color="purple"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
      />
      <StatCard
        title="Last 6h"
        value={stats.total}
        subtitle="Recent activity"
        color="blue"
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        title="Info Logs"
        value={stats.info}
        subtitle="Last 6 hours"
        color="emerald"
        isClickable
        isActive={activeLevelFilter === "info"}
        onClick={() => onLevelFilterClick("info")}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        title="Warnings"
        value={stats.warning}
        subtitle="Last 6 hours"
        color="amber"
        isClickable
        isActive={activeLevelFilter === "warning"}
        onClick={() => onLevelFilterClick("warning")}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
      />
      <StatCard
        title="Errors"
        value={stats.error}
        subtitle={`${errorRate}% error rate`}
        color="rose"
        isClickable
        isActive={activeLevelFilter === "error"}
        onClick={() => onLevelFilterClick("error")}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}
