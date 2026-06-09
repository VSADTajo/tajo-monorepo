import { parse } from 'csv-parse/sync';
import type { ParsedRow } from './xml-parser.service';

export interface CsvParseOptions {
    delimiter?: string;
    encoding?: string;
    metadataRows?: number;
}

/**
 * Parses CSV files with configurable delimiter, encoding, and metadata row skipping.
 * For files like Historico_Caudales: semicolon-delimited, 15 metadata header lines,
 * then data rows with date;time;value format.
 */
export class CsvParserService {
    parse(data: Buffer, options: CsvParseOptions = {}): ParsedRow[] {
        const delimiter = options.delimiter ?? ',';
        const metadataRows = options.metadataRows ?? 0;

        let content = data.toString((options.encoding as BufferEncoding) ?? 'utf-8');

        // Skip metadata rows
        if (metadataRows > 0) {
            const lines = content.split('\n');
            content = lines.slice(metadataRows).join('\n');
        }

        // Detect if first row is a header (contains non-numeric values)
        const firstLine = content.split('\n').find((l) => l.trim().length > 0);
        const hasHeader = firstLine ? this.looksLikeHeader(firstLine, delimiter) : false;

        if (hasHeader) {
            const records = parse(content, {
                delimiter,
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true,
            }) as Record<string, string>[];

            return records.map((record) => {
                const row: ParsedRow = {};
                for (const [key, value] of Object.entries(record)) {
                    row[key] = value;
                }
                return row;
            });
        }

        // No header: auto-generate column names (col_0, col_1, ...)
        const records = parse(content, {
            delimiter,
            columns: false,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
        }) as string[][];

        return records.map((cols) => {
            const row: ParsedRow = {};
            cols.forEach((val, i) => {
                row[`col_${i}`] = val;
            });
            return row;
        });
    }

    private looksLikeHeader(line: string, delimiter: string): boolean {
        const fields = line.split(delimiter);
        // If most fields are non-numeric, likely a header
        const nonNumeric = fields.filter((f) => isNaN(Number(f.trim())) && f.trim().length > 0);
        return nonNumeric.length > fields.length / 2;
    }
}
