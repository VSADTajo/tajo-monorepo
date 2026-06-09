/**
 * Transaction context abstraction.
 * Implementations can cast this to their specific type (e.g., EntityManager).
 */
export type TransactionContext = unknown;

/**
 * Port for transaction management.
 * Domain layer uses this without knowing the underlying implementation (TypeORM, etc.).
 */
export abstract class ITransactionManagerService {
    abstract execute<T>(operation: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
