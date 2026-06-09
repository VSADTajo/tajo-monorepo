import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';
import { StationResguardo } from '@domain/entities/station-resguardo.entity';
import { IStationResguardoRepository } from '@domain/ports/station-resguardo-repository.port';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class StationResguardoRepository implements IStationResguardoRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(StationResguardo)
        private readonly resguardoRepo: Repository<StationResguardo>,
    ) {}

    async bulkUpsert(items: StationResguardo[]): Promise<number> {
        try {
            if (items.length === 0) return 0;

            const BATCH_SIZE = 500;
            let totalAffected = 0;

            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                const batch = items.slice(i, i + BATCH_SIZE);
                const result = await this.resguardoRepo
                    .createQueryBuilder()
                    .insert()
                    .into(StationResguardo)
                    .values(batch)
                    .orUpdate(
                        ['organismo', 'originalReserveVolume', 'originalReserveLevel', 'originalMinimumVolume'],
                        ['stationId', 'date'],
                    )
                    .execute();

                totalAffected += result.identifiers.length;
            }

            return totalAffected;
        } catch (error) {
            this.logger.error({
                msg: 'Error bulk upserting resguardos',
                entity: 'StationResguardo',
                error: String(error),
            });
            throw new RepositoryError('Error bulk upserting resguardos', error);
        }
    }

    async findByStationId(options: {
        stationId: string;
        year?: number;
        from?: string;
        to?: string;
    }): Promise<StationResguardo[]> {
        try {
            const qb = this.resguardoRepo
                .createQueryBuilder('r')
                .where('r."stationId" = :stationId', { stationId: options.stationId })
                .orderBy('r.date', 'ASC');

            if (options.year !== undefined) {
                qb.andWhere('EXTRACT(YEAR FROM r.date) = :year', { year: options.year });
            }
            if (options.from) {
                qb.andWhere('r.date >= :from', { from: options.from });
            }
            if (options.to) {
                qb.andWhere('r.date <= :to', { to: options.to });
            }

            return await qb.getMany();
        } catch (error) {
            this.logger.error({
                msg: 'Error finding resguardos by station',
                entity: 'StationResguardo',
                error: String(error),
            });
            throw new RepositoryError('Error finding resguardos by station', error);
        }
    }

    async findByStationIdAndDate(stationId: string, date: string): Promise<StationResguardo | null> {
        try {
            return await this.resguardoRepo.findOne({
                where: { stationId, date },
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding resguardo by station and date',
                entity: 'StationResguardo',
                error: String(error),
            });
            throw new RepositoryError('Error finding resguardo by station and date', error);
        }
    }

    async update(item: StationResguardo): Promise<StationResguardo> {
        try {
            return await this.resguardoRepo.save(item);
        } catch (error) {
            this.logger.error({
                msg: 'Error updating resguardo',
                entity: 'StationResguardo',
                error: String(error),
            });
            throw new RepositoryError('Error updating resguardo', error);
        }
    }
}
