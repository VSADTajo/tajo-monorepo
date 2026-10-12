import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { CsvFileProviderService } from './csv-file-provider.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { ProviderConfig } from '@domain/entities/provider-config.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

function csvBlock(stationNumber: string, timeSeriesName: string): string {
    return [
        'Station Site: Tajo',
        `Station Name: ${stationNumber} name`,
        `Station Number: ${stationNumber}`,
        'LocalX: 0',
        'LocalY: 0',
        'Datum: 0',
        'Parameter Name: Caudal',
        'Parameter Type: Q',
        'Parameter Type Name: Caudal',
        `Time series Name: ${timeSeriesName}`,
        'Time series Unit: m³/s',
        'GlobalX: 0',
        'GlobalY: 0',
        'Longitude: 0',
        'Latitude: 0',
        '12/10/2026;14:00:00;2.93',
        '12/10/2026;14:15:00;2.95',
    ].join('\n');
}

describe('CsvFileProviderService', () => {
    const service = new CsvFileProviderService(mockLogger, { baseUrl: 'http://sftp' } as SftpApiConfigService);
    const config = { settings: { filePath: '/in', filePrefix: 'Tagus' } } as unknown as ProviderConfig;

    function givenCsv(content: string): void {
        mockedAxios.get.mockImplementation(async (url: string) => {
            if (url.endsWith('/files')) {
                return {
                    data: {
                        files: [{ name: 'Tagus_FlowCast.csv', path: '/in/Tagus_FlowCast.csv', isDirectory: false }],
                    },
                };
            }
            return { data: new TextEncoder().encode(content) };
        });
        mockedAxios.post.mockResolvedValue({ data: {} });
    }

    afterEach(() => jest.clearAllMocks());

    it('stores every inflow variant of a reservoir under FICT99.historical', async () => {
        givenCsv(
            [
                csvBlock('E_03', 'FICT99.Validado'),
                csvBlock('E_18', 'FICT99_Calculado'),
                csvBlock('E_02', 'FICT99_Calculado_1h'),
                csvBlock('E_36', 'FICT99_Calculado-2'),
                csvBlock('E_01', 'FICT99_Calculado_2h_opcon_v3'),
            ].join('\n'),
        );

        const results = await service.fetch(config);

        expect(results.map((r) => [r.locationId, r.parameterId])).toEqual([
            ['E_03', 'FICT99.historical'],
            ['E_18', 'FICT99.historical'],
            ['E_02', 'FICT99.historical'],
            ['E_36', 'FICT99.historical'],
            ['E_01', 'FICT99.historical'],
        ]);
    });

    it('keeps the existing keys for the other signals', async () => {
        givenCsv([csvBlock('E_03', 'FICT95.Validado'), csvBlock('A005', 'WI__01.Total.Horario')].join('\n'));

        const results = await service.fetch(config);

        expect(results.map((r) => r.parameterId)).toEqual(['FICT95.historical', 'WI__01.historical']);
    });
});
