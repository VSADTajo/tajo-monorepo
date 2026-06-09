import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IMeteoIngestRunRepository, datasetMapKey } from '@domain/ports/meteo-ingest-run-repository.port';
import { MeteoIngestRun } from '@domain/entities/meteo-ingest-run.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class MeteoIngestRunRepository extends IMeteoIngestRunRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(MeteoIngestRun) private readonly repo: Repository<MeteoIngestRun>,
    ) {
        super();
    }

    async create(run: MeteoIngestRun): Promise<MeteoIngestRun> {
        try {
            return await this.repo.save(run);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to create meteo_ingest_run',
                entity: 'MeteoSync',
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to create meteo ingest run', error as Error);
        }
    }

    async update(run: MeteoIngestRun): Promise<MeteoIngestRun> {
        try {
            return await this.repo.save(run);
        } catch (error) {
            this.logger.error({
                msg: `Failed to update meteo_ingest_run ${run.id}`,
                entity: 'MeteoSync',
                error: (error as Error).message,
            });
            throw new RepositoryError('Failed to update meteo ingest run', error as Error);
        }
    }

    async findLatestByDataset(provider: string, variable: string | null): Promise<MeteoIngestRun | null> {
        try {
            const qb = this.repo
                .createQueryBuilder('r')
                .where('r.provider = :provider', { provider })
                .orderBy('r.startedAt', 'DESC')
                .limit(1);

            if (variable === null) {
                qb.andWhere('r.variable IS NULL');
            } else {
                qb.andWhere('r.variable = :variable', { variable });
            }

            const found = await qb.getOne();
            return found ?? null;
        } catch (error) {
            throw new RepositoryError('Failed to find latest meteo ingest run', error as Error);
        }
    }

    async findLatestForAll(): Promise<Map<string, MeteoIngestRun>> {
        try {
            // Use a window function to pick the latest row per (provider, variable).
            // ROW_NUMBER() over PARTITION BY (provider, COALESCE(variable, '')) ORDER BY started_at DESC.
            const rows: MeteoIngestRun[] = await this.repo.query(`
                SELECT * FROM (
                    SELECT *,
                        ROW_NUMBER() OVER (
                            PARTITION BY "provider", COALESCE("variable", '')
                            ORDER BY "started_at" DESC
                        ) AS rn
                    FROM "meteo_ingest_run"
                ) latest
                WHERE rn = 1
            `);

            const map = new Map<string, MeteoIngestRun>();
            for (const r of rows) {
                // Raw query returns snake_case columns; remap minimal fields needed by callers.
                const entity = new MeteoIngestRun({
                    id: (r as any).id,
                    provider: (r as any).provider,
                    variable: (r as any).variable,
                    forecastRun: (r as any).forecast_run,
                    filesProcessed: Number((r as any).files_processed),
                    filesOk: Number((r as any).files_ok),
                    filesFailed: Number((r as any).files_failed),
                    status: (r as any).status,
                    triggeredBy: (r as any).triggered_by,
                    startedAt: (r as any).started_at,
                    finishedAt: (r as any).finished_at,
                    errorSummary: (r as any).error_summary,
                    createdAt: (r as any).createdAt,
                    updatedAt: (r as any).updatedAt,
                });
                map.set(datasetMapKey(entity.provider, entity.variable), entity);
            }
            return map;
        } catch (error) {
            throw new RepositoryError('Failed to load latest meteo ingest runs', error as Error);
        }
    }
}
