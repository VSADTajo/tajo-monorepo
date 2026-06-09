export interface TraceModuleOptions {
  serviceName: string;
  logsApiUrl: string;
  apiKey?: string;
  logRequests?: boolean;
}

export const X_TRACE_ID_HEADER = 'x-trace-id';
export const X_USER_ID_HEADER = 'x-user-id';
export const TRACE_MODULE_OPTIONS = 'TRACE_MODULE_OPTIONS';
