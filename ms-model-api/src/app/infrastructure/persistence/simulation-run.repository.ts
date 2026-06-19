import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import { ISimulationRunRepository } from '@domain/ports/simulation-run-repository.port';
import { SimulationRun } from '@domain/entities/simulation-run.entity';
import { SimulationRunStatus } from '@domain/types/simulation-run-status.enum';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class SimulationRunRepository implements ISimulationRunRepository {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        @InjectRepository(SimulationRun)
        private readonly simulationRunRepository: Repository<SimulationRun>,
    ) {}

    async create(run: SimulationRun): Promise<SimulationRun> {
        try {
            const entity = this.simulationRunRepository.create(run);
            return await this.simulationRunRepository.save(entity);
        } catch (error) {
            this.logger.error({ msg: 'Error creating simulation run', entity: 'SimulationRun', error: String(error) });
            throw new RepositoryError('Error creating simulation run', error);
        }
    }

    async findBySimulationId(simulationId: string): Promise<SimulationRun | null> {
        try {
            return await this.simulationRunRepository.findOne({ where: { simulationId } });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding simulation run by simulationId',
                entity: 'SimulationRun',
                error: String(error),
            });
            throw new RepositoryError('Error finding simulation run by simulationId', error);
        }
    }

    async findWaitingResult(): Promise<SimulationRun[]> {
        try {
            return await this.simulationRunRepository.find({
                where: { status: SimulationRunStatus.WAITING_RESULT },
                order: { startedAt: 'ASC' },
            });
        } catch (error) {
            this.logger.error({
                msg: 'Error finding waiting simulation runs',
                entity: 'SimulationRun',
                error: String(error),
            });
            throw new RepositoryError('Error finding waiting simulation runs', error);
        }
    }

    async update(run: SimulationRun): Promise<SimulationRun> {
        try {
            return await this.simulationRunRepository.save(run);
        } catch (error) {
            this.logger.error({ msg: 'Error updating simulation run', entity: 'SimulationRun', error: String(error) });
            throw new RepositoryError('Error updating simulation run', error);
        }
    }
}
