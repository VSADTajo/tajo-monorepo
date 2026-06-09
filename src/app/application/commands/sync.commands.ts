import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IGeoserverRepository } from '@domain/ports/geoserver-repository.port';
import { IBasinRepository } from '@domain/ports/basin-repository.port';
import { ISubBasinRepository } from '@domain/ports/sub-basin-repository.port';
import { IStationRepository } from '@domain/ports/station-repository.port';
import { IStationThresholdRepository } from '@domain/ports/station-threshold-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { Basin } from '@domain/entities/basin.entity';
import { SubBasin } from '@domain/entities/sub-basin.entity';
import { Station } from '@domain/entities/station.entity';
import { StationThreshold } from '@domain/entities/station-threshold.entity';
import { SyncGeoserverResult } from '@domain/results/sync.results';
import { zonaToBasinCode, zonaToBasinName, tipoCodToStationType } from '@domain/types/geoserver-mappings';
import { BasinCacheKeys, SubBasinCacheKeys, StationCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// SyncGeoserver
// ─────────────────────────────────────────────────────────────

export class SyncGeoserverCommand {}

@CommandHandler(SyncGeoserverCommand)
export class SyncGeoserverHandler implements ICommandHandler<SyncGeoserverCommand, SyncGeoserverResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly geoserverRepository: IGeoserverRepository,
        private readonly basinRepository: IBasinRepository,
        private readonly subBasinRepository: ISubBasinRepository,
        private readonly stationRepository: IStationRepository,
        private readonly stationThresholdRepository: IStationThresholdRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(): Promise<SyncGeoserverResult> {
        const startTime = Date.now();
        this.logger.log('Starting GeoServer sync');
        const errors: string[] = [];

        let basinsCreated = 0;
        let basinsUpdated = 0;
        let subBasinsCreated = 0;
        let subBasinsUpdated = 0;
        let stationsCreated = 0;
        let stationsUpdated = 0;
        let thresholdsCreated = 0;
        let thresholdsUpdated = 0;

        // 1. Read all data from GeoServer
        const geoSubcuencas = await this.geoserverRepository.findAllSubcuencas();
        const geoStations = await this.geoserverRepository.findAllStationsWithSubcuenca();
        const zonaMappings = await this.geoserverRepository.findAllSubcuencaZonaMappings();

        this.logger.log({
            msg: 'GeoServer data loaded',
            stations: geoStations.length,
            subcuencas: geoSubcuencas.length,
            zonaMappings: zonaMappings.size,
        });

        // 2. Sync Basins from distinct zonas
        const distinctZonas = new Set<string>();
        for (const station of geoStations) {
            if (station.zona) distinctZonas.add(station.zona);
        }

        const basinCodeMap = new Map<string, Basin>();
        for (const zona of distinctZonas) {
            try {
                const code = zonaToBasinCode(zona);
                const name = zonaToBasinName(zona);
                const existing = await this.basinRepository.findByCode(code);

                if (existing) {
                    existing.name = name;
                    await this.basinRepository.update(existing);
                    basinCodeMap.set(code, existing);
                    basinsUpdated++;
                } else {
                    const basin = new Basin({ name, code, description: `Zona SAIH: ${zona}`, isActive: true });
                    basin.validate();
                    const created = await this.basinRepository.create(basin);
                    basinCodeMap.set(code, created);
                    basinsCreated++;
                }
            } catch (error) {
                const msg = `Error syncing basin for zona "${zona}": ${error}`;
                this.logger.error({
                    msg: `Error syncing basin for zona "${zona}"`,
                    error: String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                errors.push(msg);
            }
        }

        this.logger.log({ msg: 'Basins synced', basinsCreated, basinsUpdated });

        // 3. Sync SubBasins from subcuencas (skip those without a matching zona)
        const subBasinCodeMap = new Map<string, SubBasin>();
        for (const subcuenca of geoSubcuencas) {
            try {
                const zona = zonaMappings.get(subcuenca.code);
                if (!zona) {
                    this.logger.log(`Skipping sub-basin "${subcuenca.code}" — no stations, cannot determine zona`);
                    continue;
                }
                const basinCode = zonaToBasinCode(zona);
                const basin = basinCodeMap.get(basinCode);

                if (!basin) {
                    this.logger.warn(`Skipping sub-basin "${subcuenca.code}" — basin "${basinCode}" not found`);
                    continue;
                }

                const existing = await this.subBasinRepository.findByCode(subcuenca.code);

                if (existing) {
                    existing.name = subcuenca.name;
                    existing.basinId = basin.id;
                    existing.basinName = basin.name;
                    existing.area = subcuenca.area;
                    existing.perimetro = subcuenca.perimetro;
                    existing.centroidX = subcuenca.centroidX;
                    existing.centroidY = subcuenca.centroidY;
                    await this.subBasinRepository.update(existing);
                    subBasinCodeMap.set(subcuenca.code, existing);
                    subBasinsUpdated++;
                } else {
                    const subBasin = new SubBasin({
                        name: subcuenca.name,
                        code: subcuenca.code,
                        basinId: basin.id,
                        basinName: basin.name,
                        description: null,
                        area: subcuenca.area,
                        perimetro: subcuenca.perimetro,
                        centroidX: subcuenca.centroidX,
                        centroidY: subcuenca.centroidY,
                        isActive: true,
                    });
                    subBasin.validate();
                    const created = await this.subBasinRepository.create(subBasin);
                    subBasinCodeMap.set(subcuenca.code, created);
                    subBasinsCreated++;
                }
            } catch (error) {
                const msg = `Error syncing sub-basin "${subcuenca.code}": ${error}`;
                this.logger.error({
                    msg: `Error syncing sub-basin "${subcuenca.code}"`,
                    error: String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                errors.push(msg);
            }
        }

        this.logger.log({ msg: 'SubBasins synced', subBasinsCreated, subBasinsUpdated });

        // 4. Sync Stations
        for (const geoStation of geoStations) {
            try {
                const subBasin = geoStation.subcuencaCode ? subBasinCodeMap.get(geoStation.subcuencaCode) : null;

                if (!subBasin) {
                    const msg = `Station "${geoStation.codigo}" has no matching sub-basin (subcuenca: ${geoStation.subcuencaCode})`;
                    this.logger.warn(msg);
                    errors.push(msg);
                    continue;
                }

                const stationType = tipoCodToStationType(geoStation.tipoCod);
                const existing = await this.stationRepository.findByStationCode(geoStation.codigo);

                if (existing) {
                    existing.name = geoStation.nombre;
                    existing.subBasinName = geoStation.subcuencaName ?? subBasin.name;
                    existing.stationType = stationType;
                    existing.subBasinId = subBasin.id;
                    existing.latitude = geoStation.latitude;
                    existing.longitude = geoStation.longitude;
                    existing.municipio = geoStation.municipio;
                    existing.provincia = geoStation.provincia;
                    existing.ccaa = geoStation.ccaa;
                    existing.tipoCod = geoStation.tipoCod;
                    existing.zona = geoStation.zona;
                    existing.zonaExplOgcFid = geoStation.zonaExplOgcFid;
                    existing.zonaExplNombre = geoStation.zonaExplNombre;
                    existing.comarcaName = geoStation.comarcaName;
                    existing.sistemaName = geoStation.sistemaName;
                    await this.stationRepository.update(existing);
                    stationsUpdated++;
                } else {
                    const station = new Station({
                        name: geoStation.nombre,
                        subBasinName: geoStation.subcuencaName ?? subBasin.name,
                        stationCode: geoStation.codigo,
                        stationType,
                        subBasinId: subBasin.id,
                        latitude: geoStation.latitude,
                        longitude: geoStation.longitude,
                        altitude: null,
                        municipio: geoStation.municipio,
                        provincia: geoStation.provincia,
                        ccaa: geoStation.ccaa,
                        tipoCod: geoStation.tipoCod,
                        zona: geoStation.zona,
                        zonaExplOgcFid: geoStation.zonaExplOgcFid,
                        zonaExplNombre: geoStation.zonaExplNombre,
                        comarcaName: geoStation.comarcaName,
                        sistemaName: geoStation.sistemaName,
                        description: null,
                        isActive: true,
                    });
                    station.validate();
                    await this.stationRepository.create(station);
                    stationsCreated++;
                }
            } catch (error) {
                const msg = `Error syncing station "${geoStation.codigo}": ${error}`;
                this.logger.error({
                    msg: `Error syncing station "${geoStation.codigo}"`,
                    error: String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                errors.push(msg);
            }
        }

        this.logger.log({ msg: 'Stations synced', stationsCreated, stationsUpdated });

        // 5. Sync Thresholds from GeoServer
        const geoThresholds = await this.geoserverRepository.findAllThresholds();
        this.logger.log({ msg: 'GeoServer thresholds loaded', count: geoThresholds.length });

        for (const geoThreshold of geoThresholds) {
            try {
                const station = await this.stationRepository.findByStationCode(geoThreshold.codigo);
                if (!station) {
                    this.logger.warn(`Threshold for "${geoThreshold.codigo}" skipped — station not found`);
                    continue;
                }

                const existing = await this.stationThresholdRepository.findByStationId(station.id);
                const threshold = new StationThreshold({
                    ...(existing ? { id: existing.id } : {}),
                    stationId: station.id,
                    parametro: geoThreshold.parametro,
                    senal: geoThreshold.senal,
                    umbralNivel1: geoThreshold.umbralNivel1,
                    umbralCaudal1: geoThreshold.umbralCaudal1,
                    umbralNivel2: geoThreshold.umbralNivel2,
                    umbralCaudal2: geoThreshold.umbralCaudal2,
                    umbralNivel3: geoThreshold.umbralNivel3,
                    umbralCaudal3: geoThreshold.umbralCaudal3,
                    maxNivelMuro: geoThreshold.maxNivelMuro,
                    maxNivelCaseta: geoThreshold.maxNivelCaseta,
                    umbralVolumen1: geoThreshold.umbralVolumen1,
                    umbralVolumen2: geoThreshold.umbralVolumen2,
                    umbralVolumen3: geoThreshold.umbralVolumen3,
                    caudalEntrada: geoThreshold.caudalEntrada,
                    caudalSalida: geoThreshold.caudalSalida,
                    capacidad: geoThreshold.capacidad,
                });
                threshold.validate();
                await this.stationThresholdRepository.upsert(threshold);
                existing ? thresholdsUpdated++ : thresholdsCreated++;
            } catch (error) {
                const msg = `Error syncing threshold for "${geoThreshold.codigo}": ${error}`;
                this.logger.error({
                    msg: `Error syncing threshold for "${geoThreshold.codigo}"`,
                    error: String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                errors.push(msg);
            }
        }

        this.logger.log({ msg: 'Thresholds synced', thresholdsCreated, thresholdsUpdated });

        // 6. Invalidate all caches
        await this.cacheService.delByPattern(BasinCacheKeys.pattern());
        await this.cacheService.delByPattern(SubBasinCacheKeys.pattern());
        await this.cacheService.delByPattern(StationCacheKeys.pattern());

        this.logger.log({
            msg: 'GeoServer sync completed',
            basinsCreated,
            basinsUpdated,
            subBasinsCreated,
            subBasinsUpdated,
            stationsCreated,
            stationsUpdated,
            thresholdsCreated,
            thresholdsUpdated,
            errorCount: errors.length,
            durationMs: Date.now() - startTime,
        });

        return new SyncGeoserverResult({
            basinsCreated,
            basinsUpdated,
            subBasinsCreated,
            subBasinsUpdated,
            stationsCreated,
            stationsUpdated,
            thresholdsCreated,
            thresholdsUpdated,
            errors,
        });
    }
}
