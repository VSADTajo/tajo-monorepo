export interface ServiceHealth {
  status: "up" | "down" | "degraded";
  responseTime?: number;
  details?: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    api: ServiceHealth;
    database: ServiceHealth;
  };
  system: {
    memory: {
      total: number;
      free: number;
      used: number;
      usagePercent: number;
    };
    cpu: {
      cores: number;
      loadAverage: number[];
    };
  };
}

export interface PredictionsApiHealth {
  status: "up" | "down";
  responseTime?: number;
  details?: string;
}
