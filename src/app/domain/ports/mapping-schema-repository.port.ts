import { MappingSchema } from '@domain/entities/mapping-schema.entity';

export abstract class IMappingSchemaRepository {
    abstract create(schema: MappingSchema): Promise<MappingSchema>;
    abstract findById(id: string): Promise<MappingSchema | null>;
    abstract findByDirectoryPath(directoryPath: string): Promise<MappingSchema | null>;
    abstract findAll(): Promise<MappingSchema[]>;
    abstract update(schema: MappingSchema): Promise<MappingSchema>;
    abstract delete(id: string): Promise<void>;
}
