import { Logger } from 'nestjs-pino';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ITransactionManagerService, TransactionContext } from '@domain/types/transaction-manager.type';

@Injectable()
export class TransactionManagerService implements ITransactionManagerService {
    constructor(
        private readonly dataSource: DataSource,
        @Inject(Logger) private readonly logger: Logger,
    ) {}

    async execute<T>(operation: (ctx: TransactionContext) => Promise<T>): Promise<T> {
        try {
            return await this.dataSource.transaction(async (entityManager: EntityManager) => {
                // EntityManager is passed as TransactionContext - callers in infrastructure
                // can cast it back to EntityManager when needed
                return operation(entityManager);
            });
        } catch (error) {
            this.logger.error(`Error executing transaction: ${error}`);
            throw error;
        }
    }
}
