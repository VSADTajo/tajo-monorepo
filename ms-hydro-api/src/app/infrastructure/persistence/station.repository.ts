import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IStationRepository } from '@domain/ports/station-repository.port';
import { Station } from '@domain/entities/station.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class StationRepository implements IStationRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(Station)
        private readonly stationRepository: Repository<Station>,
    ) {}

    async create(data: Station): Promise<Station> {
        try {
            const station = this.stationRepository.create(data);
            return await this.stationRepository.save(station);
        } catch (error) {
            this.logger.error({ msg: 'Error creating station', entity: 'Stations', error: String(error) });
            throw new RepositoryError('Error creating station', error);
        }
    }

    async findById(id: string): Promise<Station> {
        try {
            return await this.stationRepository.findOneOrFail({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Error finding station by id', entity: 'Stations', error: String(error) });
            throw new RepositoryError('Station not found', error);
        }
    }

    async findBySubBasinName(subBasinName: string): Promise<Station | null> {
        return this.stationRepository.findOne({ where: { subBasinName } });
    }

    async findByStationCode(stationCode: string): Promise<Station | null> {
        return this.stationRepository.findOne({ where: { stationCode } });
    }

    async findAll(options: {
        page?: number;
        limit?: number;
        subBasinId?: string;
        stationType?: string;
        isActive?: boolean;
        zona?: string;
        zonaExplOgcFid?: number;
        zonaExplNombre?: string;
        subBasinName?: string;
        comarcaName?: string;
        sistemaName?: string;
        stationCode?: string;
    }): Promise<{ items: Station[]; total: number }> {
        try {
            const qb = this.stationRepository
                .createQueryBuilder('station')
                .leftJoinAndSelect('station.threshold', 'threshold')
                .orderBy('station.createdAt', 'DESC');

            if (options.subBasinId !== undefined) {
                qb.andWhere('station.subBasinId = :subBasinId', { subBasinId: options.subBasinId });
            }
            if (options.stationType !== undefined) {
                qb.andWhere('station.stationType = :stationType', { stationType: options.stationType });
            }
            if (options.isActive !== undefined) {
                qb.andWhere('station.isActive = :isActive', { isActive: options.isActive });
            }
            if (options.zona !== undefined) {
                qb.andWhere('station.zona = :zona', { zona: options.zona });
            }
            if (options.zonaExplOgcFid !== undefined) {
                qb.andWhere('station.zonaExplOgcFid = :zonaExplOgcFid', { zonaExplOgcFid: options.zonaExplOgcFid });
            }
            if (options.zonaExplNombre !== undefined) {
                qb.andWhere('station.zonaExplNombre = :zonaExplNombre', { zonaExplNombre: options.zonaExplNombre });
            }
            if (options.subBasinName !== undefined) {
                qb.andWhere('station.subBasinName ILIKE :subBasinName', { subBasinName: `%${options.subBasinName}%` });
            }
            if (options.comarcaName !== undefined) {
                qb.andWhere('station.comarcaName ILIKE :comarcaName', { comarcaName: `%${options.comarcaName}%` });
            }
            if (options.sistemaName !== undefined) {
                qb.andWhere('station.sistemaName ILIKE :sistemaName', { sistemaName: `%${options.sistemaName}%` });
            }
            if (options.stationCode !== undefined) {
                qb.andWhere('station.stationCode ILIKE :stationCode', { stationCode: `%${options.stationCode}%` });
            }

            if (options.page !== undefined && options.limit !== undefined) {
                qb.skip((options.page - 1) * options.limit).take(options.limit);
            }

            const [items, total] = await qb.getManyAndCount();

            return { items, total };
        } catch (error) {
            this.logger.error({ msg: 'Error listing stations', entity: 'Stations', error: String(error) });
            throw new RepositoryError('Error listing stations', error);
        }
    }

    async update(data: Station): Promise<Station> {
        try {
            return await this.stationRepository.save(data);
        } catch (error) {
            this.logger.error({ msg: 'Error updating station', entity: 'Stations', error: String(error) });
            throw new RepositoryError('Error updating station', error);
        }
    }
}
