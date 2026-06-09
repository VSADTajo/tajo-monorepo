export enum CleanupFrequency {
    EVERY_5_MIN = 'EVERY_5_MIN',
    EVERY_15_MIN = 'EVERY_15_MIN',
    EVERY_30_MIN = 'EVERY_30_MIN',
    EVERY_HOUR = 'EVERY_HOUR',
    EVERY_6_HOURS = 'EVERY_6_HOURS',
    EVERY_12_HOURS = 'EVERY_12_HOURS',
    EVERY_DAY = 'EVERY_DAY',
    EVERY_WEEK = 'EVERY_WEEK',
}

export const FREQUENCY_CRON_MAP: Record<CleanupFrequency, string> = {
    EVERY_5_MIN: '*/5 * * * *',
    EVERY_15_MIN: '*/15 * * * *',
    EVERY_30_MIN: '*/30 * * * *',
    EVERY_HOUR: '0 * * * *',
    EVERY_6_HOURS: '0 */6 * * *',
    EVERY_12_HOURS: '0 */12 * * *',
    EVERY_DAY: '0 0 * * *',
    EVERY_WEEK: '0 0 * * 0',
};

export const FREQUENCY_LABEL_MAP: Record<CleanupFrequency, string> = {
    EVERY_5_MIN: 'Every 5 minutes',
    EVERY_15_MIN: 'Every 15 minutes',
    EVERY_30_MIN: 'Every 30 minutes',
    EVERY_HOUR: 'Every hour',
    EVERY_6_HOURS: 'Every 6 hours',
    EVERY_12_HOURS: 'Every 12 hours',
    EVERY_DAY: 'Every day',
    EVERY_WEEK: 'Every week',
};
