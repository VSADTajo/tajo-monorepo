export type StrategyType = 'smc' | 'ecmwf' | 'wrf';
export type JobType = 'forecast' | 'historical';

export interface ForecastEvent {
  date: string;
  time: string;
  value: number;
  flag?: string;
}

export interface ForecastEntry {
  _id: string;
  basin: string;
  strategy: StrategyType;
  model?: string;
  jobType: JobType;
  parameterId?: string;
  units?: string;
  events: ForecastEvent[];
  startDate?: string;
  endDate?: string;
  jobId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastsFilterParams {
  basin?: string;
  strategy?: StrategyType;
  jobType?: JobType;
  jobId?: string;
  dateFrom?: string;
  dateTo?: string;
  simulationHour?: string;
  ensemble?: string;
}
