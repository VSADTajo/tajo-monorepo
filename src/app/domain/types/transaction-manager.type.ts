import { EntityManager } from 'typeorm';

export abstract class ITransactionManagerService {
    abstract execute<T>(operation: (entityManager: EntityManager) => Promise<T>): Promise<T>;
}
