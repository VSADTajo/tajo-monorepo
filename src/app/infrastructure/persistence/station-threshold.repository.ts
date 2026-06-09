import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IStationThresholdRepository } from '@domain/ports/station-threshold-repository.port';
import { StationThreshold } from '@domain/entities/station-threshold.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class StationThresholdRepository implements IStationThresholdRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(StationThreshold)
        private readonly thresholdRepository: Repository<StationThreshold>,
    ) {}

    async findByStationId(stationId: string): Promise<StationThreshold | null> {
        try {
            return await this.thresholdRepository.findOne({ where: { stationId } });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding station threshold by stationId',
                entity: 'StationThresholds',
                error: String(error),
            });
            throw new RepositoryError('Error finding station threshold by stationId', error);
        }
    }

    async upsert(data: StationThreshold): Promise<StationThreshold> {
        try {
            const existing = await this.thresholdRepository.findOne({
                where: { stationId: data.stationId },
            });

            if (existing) {
                Object.assign(existing, {
                    parametro: data.parametro,
                    senal: data.senal,
                    umbralNivel1: data.umbralNivel1,
                    umbralCaudal1: data.umbralCaudal1,
                    umbralNivel2: data.umbralNivel2,
                    umbralCaudal2: data.umbralCaudal2,
                    umbralNivel3: data.umbralNivel3,
                    umbralCaudal3: data.umbralCaudal3,
                    maxNivelMuro: data.maxNivelMuro,
                    maxNivelCaseta: data.maxNivelCaseta,
                    umbralVolumen1: data.umbralVolumen1,
                    umbralVolumen2: data.umbralVolumen2,
                    umbralVolumen3: data.umbralVolumen3,
                    caudalEntrada: data.caudalEntrada,
                    caudalSalida: data.caudalSalida,
                    capacidad: data.capacidad,
                });
                return await this.thresholdRepository.save(existing);
            }

            const threshold = this.thresholdRepository.create(data);
            return await this.thresholdRepository.save(threshold);
        } catch (error) {
            this.logger.error({
                msg: 'Error upserting station threshold',
                entity: 'StationThresholds',
                error: String(error),
            });
            throw new RepositoryError('Error upserting station threshold', error);
        }
    }

    async deleteByStationId(stationId: string): Promise<void> {
        try {
            await this.thresholdRepository.delete({ stationId });
        } catch (error) {
            this.logger.error({
                msg: 'Error deleting station threshold',
                entity: 'StationThresholds',
                error: String(error),
            });
            throw new RepositoryError('Error deleting station threshold', error);
        }
    }
}
