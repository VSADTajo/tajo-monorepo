import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IMeteoalertaZoneRepository } from '@domain/ports/meteoalerta-zone-repository.port';
import { MeteoalertaZoneThresholdResult } from '@domain/results/meteoalerta-zone-threshold.result';
import { RepositoryError } from '@domain/errors/repository.error';

interface MeteoalertaZoneRow {
    zonaCode: string;
    zonaNombre: string;
    provincia: string | null;
    ccaa: string | null;
    umbral1Precip1h: number | null;
    umbral2Precip1h: number | null;
    umbral3Precip1h: number | null;
    umbral1Precip12h: number | null;
    umbral2Precip12h: number | null;
    umbral3Precip12h: number | null;
}

@Injectable()
export class MeteoalertaZoneRepository implements IMeteoalertaZoneRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectDataSource('geoserver') private readonly dataSource: DataSource,
    ) {}

    async findThresholdsByPoint(latitude: number, longitude: number): Promise<MeteoalertaZoneThresholdResult | null> {
        try {
            // zonas_meteoalerta is stored in EPSG:4326 with a GiST index on wkb_geometry, so the
            // point-in-polygon lookup is index-driven. ST_Intersects (not ST_Contains) so a point on a
            // shared border still resolves; ORDER BY cod_z keeps that case deterministic.
            const rows: MeteoalertaZoneRow[] = await this.dataSource.query(
                `
                SELECT
                    z.cod_z    AS "zonaCode",
                    z.nom_z    AS "zonaNombre",
                    z.nom_prov AS "provincia",
                    z.nom_ccaa AS "ccaa",
                    z.umbral1_precip1h::double precision  AS "umbral1Precip1h",
                    z.umbral2_precip1h::double precision  AS "umbral2Precip1h",
                    z.umbral3_precip1h::double precision  AS "umbral3Precip1h",
                    z.umbral1_precip12h::double precision AS "umbral1Precip12h",
                    z.umbral2_precip12h::double precision AS "umbral2Precip12h",
                    z.umbral3_precip12h::double precision AS "umbral3Precip12h"
                FROM zonas_meteoalerta z
                WHERE ST_Intersects(z.wkb_geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
                ORDER BY z.cod_z
                LIMIT 1
                `,
                [longitude, latitude],
            );

            return rows.length ? new MeteoalertaZoneThresholdResult(rows[0]) : null;
        } catch (error) {
            this.logger.error({
                msg: 'Error looking up meteoalerta zone by point',
                entity: 'MeteoalertaZone',
                latitude,
                longitude,
                error: String(error),
            });
            throw new RepositoryError('Failed to look up meteoalerta zone', error as Error);
        }
    }
}
