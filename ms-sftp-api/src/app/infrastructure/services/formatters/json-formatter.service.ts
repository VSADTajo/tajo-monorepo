import type { ParsedRow } from '../parsers/xml-parser.service';
import type { IFieldMapping } from '@domain/value-objects/field-mapping.value-object';

export class JsonFormatterService {
    format(rows: ParsedRow[], fieldMappings: IFieldMapping[]): Buffer {
        const mapped = rows.map((row) => this.applyMappings(row, fieldMappings));
        return Buffer.from(JSON.stringify(mapped, null, 2), 'utf-8');
    }

    private applyMappings(row: ParsedRow, mappings: IFieldMapping[]): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const mapping of mappings) {
            const rawValue = row[mapping.sourceField];
            const value =
                rawValue !== undefined && rawValue !== null
                    ? this.castValue(String(rawValue), mapping)
                    : (mapping.defaultValue ?? null);
            result[mapping.targetField] = value;
        }
        return result;
    }

    private castValue(value: string, mapping: IFieldMapping): unknown {
        const transformed = this.applyTransform(value, mapping.transform);
        const dataType = mapping.dataType ?? 'string';

        switch (dataType) {
            case 'number': {
                const num = Number(transformed);
                return isNaN(num) ? (mapping.defaultValue ?? null) : num;
            }
            case 'boolean':
                return transformed.toLowerCase() === 'true' || transformed === '1';
            case 'date':
                return transformed;
            default:
                return transformed;
        }
    }

    private applyTransform(value: string, transform?: string): string {
        if (!transform) return value;
        switch (transform.toLowerCase()) {
            case 'lowercase':
                return value.toLowerCase();
            case 'uppercase':
                return value.toUpperCase();
            case 'trim':
                return value.trim();
            default:
                return value;
        }
    }
}
