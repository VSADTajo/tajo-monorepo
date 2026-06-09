import { MappingSchema } from '@domain/entities/mapping-schema.entity';

export interface TransformResult {
    buffer: Buffer;
    contentType: string;
    fileExtension: string;
}

export abstract class IFileTransformer {
    abstract transform(data: Buffer, schema: MappingSchema): Promise<TransformResult>;
}
