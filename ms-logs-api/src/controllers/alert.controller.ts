import { Request, Response } from 'express';
import { AlertService } from '../services/alert.service';
import { AlertEngineService, isValidCronInterval, getValidIntervals } from '../services/alert-engine.service';
import { QueryExecutorService } from '../services/query-executor.service';
import { checkDataSourceStatus, getAllDataSources } from '../config/datasources';
import { ALERT_TEMPLATES } from '../templates/alert-templates';
import { DataSource } from '../types/alert.types';
import { evaluateCondition, isCooldownElapsed } from '../utils/alert.utils';

function param(value: string | string[] | undefined): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value[0] ?? '';
    return '';
}

const VALID_DATASOURCES = Object.values(DataSource) as string[];

export class AlertController {
    static async create(req: Request, res: Response) {
        try {
            const { dataSource, intervalMinutes } = req.body;

            if (dataSource && !VALID_DATASOURCES.includes(dataSource)) {
                res.status(400).json({ success: false, error: `Invalid dataSource. Valid values: ${VALID_DATASOURCES.join(', ')}` });
                return;
            }

            if (intervalMinutes && !isValidCronInterval(intervalMinutes)) {
                res.status(400).json({ success: false, error: `Invalid interval. Valid values: ${getValidIntervals().join(', ')}` });
                return;
            }

            const rule = await AlertService.create(req.body);
            if (rule.enabled) {
                AlertEngineService.registerRule(rule);
            }
            res.status(201).json({ success: true, data: rule });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            const status = message.includes('duplicate key') ? 409 : 400;
            res.status(status).json({ success: false, error: message });
        }
    }

    static async findAll(_req: Request, res: Response) {
        try {
            const rules = await AlertService.findAll();
            res.json({ success: true, data: rules });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async findById(req: Request, res: Response) {
        try {
            const id = param(req.params.id);
            const rule = await AlertService.findById(id);
            if (!rule) {
                res.status(404).json({ success: false, error: 'Alert rule not found' });
                return;
            }
            res.json({ success: true, data: rule });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const id = param(req.params.id);
            const { dataSource, intervalMinutes } = req.body;

            if (dataSource && !VALID_DATASOURCES.includes(dataSource)) {
                res.status(400).json({ success: false, error: `Invalid dataSource. Valid values: ${VALID_DATASOURCES.join(', ')}` });
                return;
            }

            if (intervalMinutes && !isValidCronInterval(intervalMinutes)) {
                res.status(400).json({ success: false, error: `Invalid interval. Valid values: ${getValidIntervals().join(', ')}` });
                return;
            }

            const rule = await AlertService.update(id, req.body);
            if (!rule) {
                res.status(404).json({ success: false, error: 'Alert rule not found' });
                return;
            }

            if (rule.enabled) {
                AlertEngineService.registerRule(rule);
            } else {
                AlertEngineService.unregisterRule(rule._id.toString());
            }

            res.json({ success: true, data: rule });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(400).json({ success: false, error: message });
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const id = param(req.params.id);
            const rule = await AlertService.findById(id);
            if (!rule) {
                res.status(404).json({ success: false, error: 'Alert rule not found' });
                return;
            }

            AlertEngineService.unregisterRule(id);
            await AlertService.delete(id);
            res.json({ success: true, data: { deleted: true } });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async toggle(req: Request, res: Response) {
        try {
            const { enabled } = req.body;
            if (typeof enabled !== 'boolean') {
                res.status(400).json({ success: false, error: 'Field "enabled" must be a boolean' });
                return;
            }

            const id = param(req.params.id);
            const rule = await AlertService.toggle(id, enabled);
            if (!rule) {
                res.status(404).json({ success: false, error: 'Alert rule not found' });
                return;
            }

            if (enabled) {
                AlertEngineService.registerRule(rule);
            } else {
                AlertEngineService.unregisterRule(rule._id.toString());
            }

            res.json({ success: true, data: rule });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async testRule(req: Request, res: Response) {
        try {
            const id = param(req.params.id);
            const rule = await AlertService.findById(id);
            if (!rule) {
                res.status(404).json({ success: false, error: 'Alert rule not found' });
                return;
            }

            const { result, durationMs } = await QueryExecutorService.execute(rule.dataSource as DataSource, rule.query);
            const conditionMet = evaluateCondition(result, rule.condition.operator, rule.condition.value);
            const cooldownActive = !isCooldownElapsed(rule.lastTriggeredAt ?? null, rule.cooldownMinutes);

            res.json({
                success: true,
                data: {
                    queryResult: result,
                    conditionMet,
                    durationMs,
                    wouldNotify: conditionMet && !cooldownActive,
                    cooldownActive,
                },
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(400).json({ success: false, error: `Query execution failed: ${message}` });
        }
    }

    static async testQuery(req: Request, res: Response) {
        try {
            const { dataSource, query } = req.body;
            if (!dataSource || !query) {
                res.status(400).json({ success: false, error: 'Fields "dataSource" and "query" are required' });
                return;
            }

            if (!VALID_DATASOURCES.includes(dataSource)) {
                res.status(400).json({ success: false, error: `Invalid dataSource. Valid values: ${VALID_DATASOURCES.join(', ')}` });
                return;
            }

            const { result, durationMs } = await QueryExecutorService.execute(dataSource, query);
            res.json({ success: true, data: { result, durationMs } });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(400).json({ success: false, error: `Query execution failed: ${message}` });
        }
    }

    static async getHistory(req: Request, res: Response) {
        try {
            const id = param(req.params.id);
            const limitParam = typeof req.query.limit === 'string' ? req.query.limit : '50';
            const offsetParam = typeof req.query.offset === 'string' ? req.query.offset : '0';
            const limit = Math.min(parseInt(limitParam, 10) || 50, 100);
            const offset = parseInt(offsetParam, 10) || 0;
            const { executions, total } = await AlertService.getHistory(id, limit, offset);
            res.json({ success: true, data: { executions, total } });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async getTemplates(_req: Request, res: Response) {
        res.json({ success: true, data: ALERT_TEMPLATES });
    }

    static async getDataSources(_req: Request, res: Response) {
        try {
            const sources = getAllDataSources();
            const results = await Promise.all(
                sources.map(async (source) => ({
                    id: source.id,
                    name: source.name,
                    status: await checkDataSourceStatus(source.id),
                }))
            );
            res.json({ success: true, data: results });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }
}
