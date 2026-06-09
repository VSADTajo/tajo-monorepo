import cron, { ScheduledTask } from 'node-cron';
import AlertExecution from '../collections/alert-execution.collection';
import AlertRule from '../collections/alert-rule.collection';
import { AlertService } from './alert.service';
import { QueryExecutorService } from './query-executor.service';
import { RabbitMQService } from './rabbitmq.service';
import { evaluateCondition, isCooldownElapsed } from '../utils/alert.utils';
import { EmailService } from './email.service';

// Valid cron intervals: values that map cleanly to */N expressions
const VALID_MINUTE_INTERVALS = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30];
const VALID_HOUR_INTERVALS = [60, 120, 180, 240, 360, 480, 720, 1440];
const VALID_INTERVALS = [...VALID_MINUTE_INTERVALS, ...VALID_HOUR_INTERVALS];

export function buildCronExpression(intervalMinutes: number): string {
    if (intervalMinutes >= 60) {
        const hours = Math.floor(intervalMinutes / 60);
        return `0 */${hours} * * *`;
    }
    return `*/${intervalMinutes} * * * *`;
}

export function isValidCronInterval(intervalMinutes: number): boolean {
    return VALID_INTERVALS.includes(intervalMinutes);
}

export function getValidIntervals(): number[] {
    return VALID_INTERVALS;
}

export class AlertEngineService {
    private static scheduledTasks: Map<string, ScheduledTask> = new Map();

    static async start(): Promise<void> {
        const rules = await AlertService.findAllEnabled();

        for (const rule of rules) {
            AlertEngineService.registerRule(rule);
        }

        console.log(`Alert Engine started: ${rules.length} rules registered`);
    }

    static registerRule(rule: { _id: { toString(): string }; intervalMinutes: number }): void {
        const ruleId = rule._id.toString();

        // Unregister if already exists (e.g., on update)
        AlertEngineService.unregisterRule(ruleId);

        const cronExpression = buildCronExpression(rule.intervalMinutes);

        const task = cron.schedule(cronExpression, async () => {
            // Always fetch fresh rule from DB to avoid stale closures
            await AlertEngineService.evaluateRuleById(ruleId);
        });

        AlertEngineService.scheduledTasks.set(ruleId, task);
    }

    static unregisterRule(ruleId: string): void {
        const task = AlertEngineService.scheduledTasks.get(ruleId);
        if (task) {
            task.stop();
            AlertEngineService.scheduledTasks.delete(ruleId);
        }
    }

    static async evaluateRuleById(ruleId: string): Promise<void> {
        // Fetch fresh rule from DB to avoid stale data
        const rule = await AlertRule.findById(ruleId);
        if (!rule || !rule.enabled) return;

        const now = new Date();
        let queryResult: number | null = null;
        let durationMs: number | null = null;
        let conditionMet = false;
        let notificationDispatched = false;
        let skippedReason: string | null = null;
        let error: string | null = null;

        try {
            const execResult = await QueryExecutorService.execute(rule.dataSource, rule.query);
            queryResult = execResult.result;
            durationMs = execResult.durationMs;

            conditionMet = evaluateCondition(queryResult, rule.condition.operator, rule.condition.value);

            if (conditionMet) {
                const cooldownElapsed = isCooldownElapsed(rule.lastTriggeredAt ?? null, rule.cooldownMinutes);

                if (cooldownElapsed) {
                    await AlertEngineService.dispatchNotification(rule, queryResult);
                    await AlertEngineService.sendAlertEmails(rule, queryResult, now);
                    notificationDispatched = true;

                    await AlertService.updateExecutionState(ruleId, {
                        lastCheckedAt: now,
                        lastResult: queryResult,
                        lastTriggeredAt: now,
                        consecutiveFailures: 0,
                        lastError: null,
                    });
                } else {
                    skippedReason = 'cooldown';
                    await AlertService.updateExecutionState(ruleId, {
                        lastCheckedAt: now,
                        lastResult: queryResult,
                        consecutiveFailures: 0,
                        lastError: null,
                    });
                }
            } else {
                await AlertService.updateExecutionState(ruleId, {
                    lastCheckedAt: now,
                    lastResult: queryResult,
                    consecutiveFailures: 0,
                    lastError: null,
                });
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            error = errorMessage;
            console.error(`Alert rule "${ruleId}" evaluation failed:`, errorMessage);

            // Use $inc to atomically increment consecutiveFailures
            await AlertRule.findByIdAndUpdate(ruleId, {
                $set: { lastCheckedAt: now, lastError: errorMessage },
                $inc: { consecutiveFailures: 1 },
            });
        }

        // Save execution history
        await AlertExecution.create({
            ruleId,
            ruleName: rule.name,
            executedAt: now,
            queryResult,
            conditionMet,
            notificationDispatched,
            skippedReason,
            error,
            durationMs,
        });
    }

    private static async dispatchNotification(rule: { _id: { toString(): string }; name: string; notification: { title: string; message: string; severity: string }; dataSource: string; condition: { operator: string; value: number } }, result: number): Promise<void> {
        const payload = {
            type: 'ALERT_TRIGGERED',
            source: 'ms-logs-api',
            title: rule.notification.title,
            message: `${rule.notification.message} | Result: ${result}`,
            metadata: {
                ruleId: rule._id.toString(),
                ruleName: rule.name,
                queryResult: result,
                dataSource: rule.dataSource,
                conditionOperator: rule.condition.operator,
                conditionValue: rule.condition.value,
            },
            severity: rule.notification.severity,
        };

        await RabbitMQService.publish(payload);
    }

    private static async sendAlertEmails(rule: { name: string; emails?: string[]; notification: { title: string; message: string; severity: string }; dataSource: string; condition: { operator: string; value: number } }, result: number, checkedAt: Date): Promise<void> {
        const emails = rule.emails ?? [];
        if (emails.length === 0) return;

        try {
            await EmailService.sendAlertEmail(emails, {
                ruleName: rule.name,
                severity: rule.notification.severity,
                title: rule.notification.title,
                message: `${rule.notification.message} | Resultado: ${result}`,
                queryResult: result,
                dataSource: rule.dataSource,
                conditionOperator: rule.condition.operator,
                conditionValue: rule.condition.value,
                checkedAt: checkedAt.toLocaleString('es-AR', { timeZone: 'Europe/Madrid' }),
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown email error';
            console.error(`Failed to send alert email for rule "${rule.name}":`, msg);
        }
    }

    static getRegisteredCount(): number {
        return AlertEngineService.scheduledTasks.size;
    }
}
