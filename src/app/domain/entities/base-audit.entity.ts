/**
 * Base audit entity for domain layer.
 * Contains audit fields without any framework-specific decorators.
 * Infrastructure layer extends this with TypeORM decorators.
 */
export abstract class BaseAuditEntity {
    createdAt?: Date;
    updatedAt?: Date;
}
