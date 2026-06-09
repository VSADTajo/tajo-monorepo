import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';
import { IAemetClient, AemetGeoJsonFeature } from '@domain/ports/aemet-client.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { GetAvisosResult, GetAvisosResumenResult, GetAvisosTiposResult } from '@domain/results/avisos.results';
import { AEMET_EVENT_TYPES } from '@domain/types/aemet.constants';
import { TAJO_PROVINCE_CODES } from '@domain/types/aemet.constants';
import { AvisosCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// GetAvisos
// ─────────────────────────────────────────────────────────────

export interface IGetAvisosQuery {
    tipo?: string;
    provincia?: string;
}

export class GetAvisosQuery {
    constructor(private readonly parameters: IGetAvisosQuery) {}
    get tipo(): string | undefined {
        return this.parameters.tipo;
    }
    get provincia(): string | undefined {
        return this.parameters.provincia;
    }
}

@QueryHandler(GetAvisosQuery)
export class GetAvisosHandler implements IQueryHandler<GetAvisosQuery, GetAvisosResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly aemetClient: IAemetClient,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(query: GetAvisosQuery): Promise<GetAvisosResult> {
        this.logger.log({ msg: 'Getting AEMET avisos', tipo: query.tipo, provincia: query.provincia });

        // Always fetch full ESP (cached for 5 min), then filter in memory
        const cacheKey = AvisosCacheKeys.all();
        let cached = await this.cacheService.get<GetAvisosResult>(cacheKey);

        if (!cached) {
            const geojson = await this.aemetClient.fetchAvisos();
            cached = new GetAvisosResult({ geojson });
            await this.cacheService.set(cacheKey, cached, AvisosCacheKeys.TTL);
        }

        // Filter to Tajo basin provinces and exclude "verde" level
        const tajoSet = new Set<string>(TAJO_PROVINCE_CODES);
        let features: AemetGeoJsonFeature[] = cached.geojson.features.filter(
            (f) => tajoSet.has(f.properties.provinciaCode) && f.properties.level !== 'verde',
        );

        // Filter by tipo if provided
        if (query.tipo) {
            features = features.filter((f) => f.properties.eventTypeCode === query.tipo);
        }

        // Filter by provincia if provided
        if (query.provincia) {
            features = features.filter((f) => f.properties.provinciaCode === query.provincia);
        }

        this.logger.log({ msg: 'Avisos filtered', total: cached.geojson.features.length, filtered: features.length });

        return new GetAvisosResult({
            geojson: { type: 'FeatureCollection', features },
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetAvisosTipos
// ─────────────────────────────────────────────────────────────

export class GetAvisosTiposQuery {}

@QueryHandler(GetAvisosTiposQuery)
export class GetAvisosTiposHandler implements IQueryHandler<GetAvisosTiposQuery, GetAvisosTiposResult> {
    async execute(): Promise<GetAvisosTiposResult> {
        return new GetAvisosTiposResult({
            tipos: AEMET_EVENT_TYPES.map((t) => ({ code: t.code, name: t.name })),
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetAvisosResumen
// ─────────────────────────────────────────────────────────────

export class GetAvisosResumenQuery {}

@QueryHandler(GetAvisosResumenQuery)
export class GetAvisosResumenHandler implements IQueryHandler<GetAvisosResumenQuery, GetAvisosResumenResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly aemetClient: IAemetClient,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(): Promise<GetAvisosResumenResult> {
        this.logger.log({ msg: 'Getting AEMET avisos resumen' });

        // Reuse the same ESP cache as GetAvisos
        const cacheKey = AvisosCacheKeys.all();
        let cached = await this.cacheService.get<GetAvisosResult>(cacheKey);

        if (!cached) {
            const geojson = await this.aemetClient.fetchAvisos();
            cached = new GetAvisosResult({ geojson });
            await this.cacheService.set(cacheKey, cached, AvisosCacheKeys.TTL);
        }

        // Same filters: Tajo basin + exclude verde
        const tajoSet = new Set<string>(TAJO_PROVINCE_CODES);
        const now = new Date();
        const dayAfterTomorrow = new Date(now);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
        dayAfterTomorrow.setHours(23, 59, 59, 999);

        const activeFeatures = cached.geojson.features.filter((f) => {
            if (!tajoSet.has(f.properties.provinciaCode)) return false;
            if (f.properties.level === 'verde') return false;

            // Filter by vigencia: expires >= now AND onset <= end of day after tomorrow
            const expires = new Date(f.properties.expires);
            const onset = new Date(f.properties.onset);
            if (isNaN(expires.getTime()) || isNaN(onset.getTime())) return false;

            return expires >= now && onset <= dayAfterTomorrow;
        });

        // Group by eventTypeCode
        const countMap = new Map<string, number>();
        for (const f of activeFeatures) {
            const code = f.properties.eventTypeCode;
            countMap.set(code, (countMap.get(code) ?? 0) + 1);
        }

        const eventTypeMap = new Map<string, string>(AEMET_EVENT_TYPES.map((t) => [t.code, t.name]));
        const categoriasActivas = Array.from(countMap.entries()).map(([code, count]) => ({
            code,
            name: eventTypeMap.get(code) ?? code,
            count,
        }));

        this.logger.log({ msg: 'Avisos resumen', categorias: categoriasActivas.length, total: activeFeatures.length });

        return new GetAvisosResumenResult({
            categoriasActivas,
            totalAvisos: activeFeatures.length,
        });
    }
}
