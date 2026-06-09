import { BaseEntity, CreateDateColumn, UpdateDateColumn } from 'typeorm';

import { BaseAuditEntity as DomainBaseAuditEntity } from '@domain/entities/base-audit.entity';

/**
 * TypeORM-decorated base entity that extends the domain base.
 * Use this in entities that need persistence via TypeORM.
 */
export class BaseAuditEntity extends DomainBaseAuditEntity {
    @CreateDateColumn()
    declare createdAt?: Date;

    @UpdateDateColumn()
    declare updatedAt?: Date;
}

// Re-export BaseEntity for entities that need TypeORM's static methods
export { BaseEntity };
