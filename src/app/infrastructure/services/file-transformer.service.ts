import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { IFileTransformer, TransformResult } from '@domain/ports/file-transformer.port';
import { MappingSchema } from '@domain/entities/mapping-schema.entity';

// Parsers
import { XmlParserService, ParsedRow } from '@infrastructure/services/parsers/xml-parser.service';
import { CsvParserService } from '@infrastructure/services/parsers/csv-parser.service';

// Formatters
import { JsonFormatterService } from '@infrastructure/services/formatters/json-formatter.service';
import { CsvFormatterService } from '@infrastructure/services/formatters/csv-formatter.service';
import { DatFormatterService } from '@infrastructure/services/formatters/dat-formatter.service';
import { ParquetFormatterService } from '@infrastructure/services/formatters/parquet-formatter.service';

const CONTENT_TYPES: Record<string, string> = {
    json: 'application/json',
    csv: 'text/csv',
    dat: 'application/octet-stream',
    parquet: 'application/vnd.apache.parquet',
};

@Injectable()
export class FileTransformerService extends IFileTransformer {
    private readonly xmlParser = new XmlParserService();
    private readonly csvParser = new CsvParserService();
    private readonly jsonFormatter = new JsonFormatterService();
    private readonly csvFormatter = new CsvFormatterService();
    private readonly datFormatter = new DatFormatterService();
    private readonly parquetFormatter = new ParquetFormatterService();

    constructor(@Inject(Logger) private readonly logger: Logger) {
        super();
    }

    async transform(data: Buffer, schema: MappingSchema): Promise<TransformResult> {
        this.logger.log(`Transforming file: ${schema.inputFormat} -> ${schema.outputFormat} (${data.length} bytes)`);

        // 1. Parse input
        const rows = this.parseInput(data, schema);

        if (rows.length === 0) {
            this.logger.warn({ msg: 'Parser returned 0 rows', entity: 'MappingSchema' });
            return {
                buffer: Buffer.alloc(0),
                contentType: CONTENT_TYPES[schema.outputFormat] ?? 'application/octet-stream',
                fileExtension: `.${schema.outputFormat}`,
            };
        }

        this.logger.log(`Parsed ${rows.length} rows, applying ${schema.fieldMappings.length} field mappings`);

        // 2. Format output
        const buffer = await this.formatOutput(rows, schema);

        return {
            buffer,
            contentType: CONTENT_TYPES[schema.outputFormat] ?? 'application/octet-stream',
            fileExtension: `.${schema.outputFormat}`,
        };
    }

    private parseInput(data: Buffer, schema: MappingSchema): ParsedRow[] {
        switch (schema.inputFormat) {
            case 'xml':
                return this.xmlParser.parse(data);
            case 'csv':
                return this.csvParser.parse(data, {
                    delimiter: schema.csvOptions?.delimiter,
                    encoding: schema.csvOptions?.encoding,
                    metadataRows: schema.csvOptions?.metadataRows,
                });
            default:
                throw new Error(`Unsupported input format: ${schema.inputFormat}`);
        }
    }

    private async formatOutput(rows: ParsedRow[], schema: MappingSchema): Promise<Buffer> {
        switch (schema.outputFormat) {
            case 'json':
                return this.jsonFormatter.format(rows, schema.fieldMappings);
            case 'csv':
                return this.csvFormatter.format(rows, schema.fieldMappings, schema.csvOptions);
            case 'dat':
                return this.datFormatter.format(rows, schema.fieldMappings);
            case 'parquet':
                return this.parquetFormatter.format(rows, schema.fieldMappings);
            default:
                throw new Error(`Unsupported output format: ${schema.outputFormat}`);
        }
    }
}
