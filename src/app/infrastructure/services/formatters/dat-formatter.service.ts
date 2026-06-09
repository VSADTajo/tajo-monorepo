import type { ParsedRow } from '../parsers/xml-parser.service';
import type { IFieldMapping } from '@domain/value-objects/field-mapping.value-object';

/**
 * DAT formatter: tab-delimited text output without header row.
 */
export class DatFormatterService {
    format(rows: ParsedRow[], fieldMappings: IFieldMapping[]): Buffer {
        const delimiter = '\t';
        const lines: string[] = [];

        for (const row of rows) {
            const values = fieldMappings.map((mapping) => {
                const rawValue = row[mapping.sourceField];
                const value =
                    rawValue !== undefined && rawValue !== null
                        ? this.castAndTransform(String(rawValue), mapping)
                        : (mapping.defaultValue ?? '');
                return value;
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
}
