import { IFieldMapping } from '../../src/app/domain/value-objects/field-mapping.value-object';
import { ICsvOptions } from '../../src/app/domain/entities/mapping-schema.entity';

export interface CreateMappingSchemaDto {
    directoryPath: string;
    name: string;
    inputFormat: string;
    outputFormat: string;
    fieldMappings: IFieldMapping[];
    csvOptions?: ICsvOptions | null;
}

let counter = 0;

export function buildCreateMappingSchemaDto(overrides?: Partial<CreateMappingSchemaDto>): CreateMappingSchemaDto {
    counter++;
    return {
        directoryPath: `/data/incoming/test-${counter}`,
        name: `Test Schema ${counter}`,
        inputFormat: 'xml',
        outputFormat: 'json',
        fieldMappings: [
            { sourceField: 'locationId', targetField: 'station_id', dataType: 'string' },
            { sourceField: 'value', targetField: 'measurement', dataType: 'number' },
        ],
        csvOptions: null,
        ...overrides,
    };
}

export function buildCsvMappingSchemaDto(overrides?: Partial<CreateMappingSchemaDto>): CreateMappingSchemaDto {
    counter++;
    return {
        directoryPath: `/data/incoming/csv-${counter}`,
        name: `CSV Schema ${counter}`,
        inputFormat: 'csv',
        outputFormat: 'json',
        fieldMappings: [
            { sourceField: 'col_0', targetField: 'id', dataType: 'string' },
            { sourceField: 'col_1', targetField: 'value', dataType: 'number' },
        ],
        csvOptions: {
            delimiter: ',',
            encoding: 'utf-8',
            metadataRows: 0,
        },
        ...overrides,
    };
}

export function buildXmlContent(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<TimeSeries xmlns="http://www.wldelft.nl/fews/PI" version="1.34">
    <timeZone>0.0</timeZone>
    <series>
        <header>
            <type>instantaneous</type>
            <locationId>ST01</locationId>
            <parameterId>Q.obs</parameterId>
            <timeStep unit="second" multiplier="900"/>
            <startDate date="2026-01-01" time="00:00:00"/>
            <endDate date="2026-01-01" time="01:00:00"/>
            <missVal>-999.0</missVal>
            <stationName>Station One</stationName>
            <units>m3/s</units>
        </header>
        <event date="2026-01-01" time="00:00:00" value="10.5" flag="0"/>
        <event date="2026-01-01" time="00:15:00" value="11.2" flag="0"/>
        <event date="2026-01-01" time="00:30:00" value="12.8" flag="0"/>
    </series>
</TimeSeries>`;
}
