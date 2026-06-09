export type RabbitmqConfig = {
    enabled: boolean;
    host: string;
    port: number;
    user: string;
    password: string;
    vhost: string;
    prefetch: number;
    retryAttempts: number;
    retryDelay: number;
};
