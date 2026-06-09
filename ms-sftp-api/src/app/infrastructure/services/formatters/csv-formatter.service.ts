import type { ParsedRow } from '../parsers/xml-parser.service';
import type { IFieldMapping } from '@domain/value-objects/field-mapping.value-object';
import type { ICsvOptions } from '@domain/entities/mapping-schema.entity';

export class CsvFormatterService {
    format(rows: ParsedRow[], fieldMappings: IFieldMapping[], csvOptions?: ICsvOptions | null): Buffer {
        const delimiter = csvOptions?.outputDelimiter ?? ',';
        const includeHeader = csvOptions?.includeHeader ?? true;

        const lines: string[] = [];

        if (includeHeader) {
            lines.push(fieldMappings.map((m) => this.escapeField(m.targetField, delimiter)).join(delimiter));
        }

        for (const row of rows) {
            const values = fieldMappings.map((mapping) => {
                const rawValue = row[mapping.sourceField];
                const value =
                    rawValue !== undefined && rawValue !== null
                        ? this.castAndTransform(String(rawValue), mapping)
                        : (mapping.defaultValue ?? '');
                return this.escapeField(value, delimiter);
            });
            lines.push(values.join(delimiter));
        }

        return Buffer.from(lines.join('\n'), 'utf-8');
    }

    private castAndTransform(value: string, mapping: IFieldMapping): string {
        let result = value;
        if (mapping.transform) {
            switch (mapping.transform.toLowerCase()) {
                case 'lowercase':
                    result = result.toLowerCase();
                    break;
                case 'uppercase':
                    result = result.toUpperCase();
                    break;
                case 'trim':
                    result = result.trim();
                    break;
            }
        }
        return result;
    }

    private escapeField(value: string, delimiter: string): string {
        if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
