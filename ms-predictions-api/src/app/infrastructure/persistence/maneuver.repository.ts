import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { IManeuverRepository } from '@domain/ports/maneuver-repository.port';
import { Maneuver } from '@domain/entities/maneuver.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class ManeuverRepository implements IManeuverRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(Maneuver)
        private readonly maneuverRepository: Repository<Maneuver>,
    ) {}

    async createMany(maneuvers: Maneuver[]): Promise<Maneuver[]> {
        try {
            const entities = this.maneuverRepository.create(maneuvers);
            return await this.maneuverRepository.save(entities);
        } catch (error) {
            this.logger.error({ msg: 'Error creating maneuvers', entity: 'Maneuvers', error: String(error) });
            throw new RepositoryError('Error creating maneuvers', error);
        }
    }

    async findBySimulationId(simulationId: string): Promise<Maneuver[]> {
        try {
            return await this.maneuverRepository.find({ where: { simulationId } });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding maneuvers by simulationId',
                entity: 'Maneuvers',
                error: String(error),
            });
            throw new RepositoryError('Error finding maneuvers by simulationId', error);
        }
    }
}
