import { ParquetSchema, ParquetWriter } from '@dsnp/parquetjs';
import type { ParquetType, SchemaDefinition } from '@dsnp/parquetjs/dist/lib/declare';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import type { ParsedRow } from '../parsers/xml-parser.service';
import type { IFieldMapping } from '@domain/value-objects/field-mapping.value-object';

export class ParquetFormatterService {
    async format(rows: ParsedRow[], fieldMappings: IFieldMapping[]): Promise<Buffer> {
        if (rows.length === 0) {
            return Buffer.alloc(0);
        }

        const schemaFields: SchemaDefinition = {};
        for (const mapping of fieldMappings) {
            schemaFields[mapping.targetField] = {
                type: this.toParquetType(mapping.dataType),
                optional: true,
            };
        }

        const parquetSchema = new ParquetSchema(schemaFields);

        // Write to a temp file then read back as buffer
        const tmpFile = path.join(os.tmpdir(), `parquet-${crypto.randomUUID()}.parquet`);

        try {
            const writer = await ParquetWriter.openFile(parquetSchema, tmpFile);

            for (const row of rows) {
                const record: Record<string, unknown> = {};
                for (const mapping of fieldMappings) {
                    const rawValue = row[mapping.sourceField];
                    record[mapping.targetField] =
                        rawValue !== undefined && rawValue !== null
                            ? this.castValue(String(rawValue), mapping)
                            : (mapping.defaultValue ?? null);
                }
                await writer.appendRow(record);
            }

            await writer.close();

            return fs.readFileSync(tmpFile);
        } finally {
            if (fs.existsSync(tmpFile)) {
                fs.unlinkSync(tmpFile);
            }
        }
    }

    private toParquetType(dataType?: string): ParquetType {
        switch (dataType) {
            case 'number':
                return 'DOUBLE';
            case 'boolean':
                return 'BOOLEAN';
            case 'date':
                return 'UTF8';
            default:
                return 'UTF8';
        }
    }

    private castValue(value: string, mapping: IFieldMapping): unknown {
        const transformed = this.applyTransform(value, mapping.transform);
        const dataType = mapping.dataType ?? 'string';

        switch (dataType) {
            case 'number': {
                const num = Number(transformed);
                return isNaN(num) ? null : num;
            }
            case 'boolean':
                return transformed.toLowerCase() === 'true' || transformed === '1';
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
