import { MeteoDiscoveryService } from '../../../src/app/application/services/meteo-discovery.service';
import { MeteoConfigService } from '../../../src/configuration/meteo/meteo-config.service';
import { Logger as PinoLogger } from 'nestjs-pino';
import { InMemorySftpFileClient, buildSftpTree } from '../../helpers/sftp-api.mock';
import { buildInfoJsonRaw, buildRasterFilenames } from '../../factories/meteo-info-json.factory';

/**
 * US4: Auto-discovery of new variable folders.
 *
 * Most of the behavior is implemented in MeteoDiscoveryService — this test
 * exercises the discovery service directly because the higher-level e2e
 * tests already prove the wiring (sync-meteo-variable, get-meteo-info).
 */
describe('Discovery — auto-discovery of new variables (e2e)', () => {
    const config = { meteoBasePath: 'tajo/METEO', geoserverWorkspace: 'tajo' } as MeteoConfigService;
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as PinoLogger;

    let sftp: InMemorySftpFileClient;
    let discovery: MeteoDiscoveryService;

    beforeEach(() => {
        sftp = new InMemorySftpFileClient(
            buildSftpTree('tajo/METEO', {
                'HARMONIE/Temperatura/info.json': buildInfoJsonRaw({ nombre: 'Temperatura' }),
                ...Object.fromEntries(buildRasterFilenames('harm_temp').map((n) => [`HARMONIE/Temperatura/${n}`, 'x'])),
            }),
        );
        discovery = new MeteoDiscoveryService(logger, sftp, config);
    });

    it('discovers a new variable folder added between cycles without any code change', async () => {
        const before = await discovery.discover();
        expect(before).toHaveLength(1);
        expect(before[0].layerName.toString()).toBe('tajo:harmonie_temperatura');

        // Add a new variable folder mid-test.
        sftp.setRoot(
            buildSftpTree('tajo/METEO', {
                'HARMONIE/Temperatura/info.json': buildInfoJsonRaw({ nombre: 'Temperatura' }),
                ...Object.fromEntries(buildRasterFilenames('harm_temp').map((n) => [`HARMONIE/Temperatura/${n}`, 'x'])),
                'HARMONIE/Viento/info.json': buildInfoJsonRaw({ nombre: 'Viento' }),
                ...Object.fromEntries(buildRasterFilenames('harm_wind').map((n) => [`HARMONIE/Viento/${n}`, 'x'])),
            }),
        );

        const after = await discovery.discover();
        const layers = after.map((d) => d.layerName.toString()).sort();
        expect(layers).toEqual(['tajo:harmonie_temperatura', 'tajo:harmonie_viento']);
    });

    it('skips a folder without info.json without aborting the walk', async () => {
        sftp.setRoot(
            buildSftpTree('tajo/METEO', {
                // valid one
                'HARMONIE/Temperatura/info.json': buildInfoJsonRaw({ nombre: 'Temperatura' }),
                ...Object.fromEntries(buildRasterFilenames('harm_temp').map((n) => [`HARMONIE/Temperatura/${n}`, 'x'])),
                // garbage folder, no info.json
                'HARMONIE/Garbage/foo.txt': 'whatever',
            }),
        );

        const result = await discovery.discover();
        expect(result.map((d) => d.layerName.toString())).toEqual(['tajo:harmonie_temperatura']);
    });

    it('skips a folder with malformed info.json without aborting the walk', async () => {
        sftp.setRoot(
            buildSftpTree('tajo/METEO', {
                'HARMONIE/Temperatura/info.json': buildInfoJsonRaw({ nombre: 'Temperatura' }),
                ...Object.fromEntries(buildRasterFilenames('harm_temp').map((n) => [`HARMONIE/Temperatura/${n}`, 'x'])),
                'HARMONIE/Broken/info.json': '{ this is not valid json',
            }),
        );

        const result = await discovery.discover();
        expect(result.map((d) => d.layerName.toString())).toEqual(['tajo:harmonie_temperatura']);
    });

    it('handles RADAR-style providers (info.json directly under provider folder, no variable level)', async () => {
        sftp.setRoot(
            buildSftpTree('tajo/METEO', {
                'RADAR/info.json': buildInfoJsonRaw({ nombre: 'Precipitación radar' }),
                ...Object.fromEntries(buildRasterFilenames('radarprec').map((n) => [`RADAR/${n}`, 'x'])),
            }),
        );

        const result = await discovery.discover();
        expect(result).toHaveLength(1);
        expect(result[0].provider).toBe('RADAR');
        expect(result[0].variable).toBeNull();
        expect(result[0].layerName.toString()).toBe('tajo:radar_precipitacion');
    });
});
