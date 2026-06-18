import { Logger } from 'nestjs-pino';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ITransactionManagerService } from '@domain/types/transaction-manager.type';

@Injectable()
export class TransactionManagerService implements ITransactionManagerService {
    constructor(
        private readonly dataSource: DataSource,
        @Inject(Logger) private readonly logger: Logger,
    ) {}

    async execute<T>(operation: (entityManager: EntityManager) => Promise<T>): Promise<T> {
        try {
            return await this.dataSource.transaction(async (entityManager) => {
                return operation(entityManager);
            });
        } catch (error) {
            this.logger.error({ msg: 'Transaction execution failed', entity: 'Transaction', error: String(error) });
            throw error;
        }
    }
}
