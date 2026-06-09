import { EntityError } from '@domain/errors/entity.error';

export interface IFieldMapping {
    sourceField: string;
    targetField: string;
    dataType?: 'string' | 'number' | 'date' | 'boolean';
    defaultValue?: string;
    transform?: string;
}

const VALID_DATA_TYPES = ['string', 'number', 'date', 'boolean'];

export class FieldMappingValueObject {
    public readonly sourceField: string;
    public readonly targetField: string;
    public readonly dataType: string;
    public readonly defaultValue?: string;
    public readonly transform?: string;

    constructor(params: IFieldMapping) {
        if (!params.sourceField || !params.sourceField.trim()) {
            throw new EntityError('Source field is required', 'sourceField');
        }

        if (!params.targetField || !params.targetField.trim()) {
            throw new EntityError('Target field is required', 'targetField');
        }

        if (params.dataType && !VALID_DATA_TYPES.includes(params.dataType)) {
            throw new EntityError(`Data type must be one of: ${VALID_DATA_TYPES.join(', ')}`, 'dataType');
        }

        this.sourceField = params.sourceField.trim();
        this.targetField = params.targetField.trim();
        this.dataType = params.dataType ?? 'string';
        this.defaultValue = params.defaultValue;
        this.transform = params.transform;
    }

    static validateArray(mappings: IFieldMapping[]): void {
        if (!Array.isArray(mappings) || mappings.length === 0) {
            throw new EntityError('At least one field mapping is required', 'fieldMappings');
        }

        for (const mapping of mappings) {
            new FieldMappingValueObject(mapping);
        }
    }
}
