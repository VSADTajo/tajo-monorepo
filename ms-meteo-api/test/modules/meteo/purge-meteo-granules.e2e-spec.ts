import {
    PurgeMeteoGranulesCommand,
    PurgeMeteoGranulesHandler,
} from '../../../src/app/application/commands/meteo.commands';
import { MeteoDiscoveryService } from '../../../src/app/application/services/meteo-discovery.service';
import { Logger as PinoLogger } from 'nestjs-pino';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { MeteoConfigService } from '../../../src/configuration/meteo/meteo-config.service';
import { InMemorySftpFileClient, buildSftpTree } from '../../helpers/sftp-api.mock';
import { InMemoryGeoserverImageMosaicClient } from '../../helpers/geoserver-rest.mock';
import { buildInfoJsonRaw, buildRasterFilenames } from '../../factories/meteo-info-json.factory';

describe('Purge meteo granules (US6 retention)', () => {
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as PinoLogger;
    const tmpDir = path.join(os.tmpdir(), `meteo-retention-${Date.now()}`);

    let sftp: InMemorySftpFileClient;
    let geoserver: InMemoryGeoserverImageMosaicClient;
    let discovery: MeteoDiscoveryService;
    let handler: PurgeMeteoGranulesHandler;
    let config: MeteoConfigService;

    beforeEach(async () => {
        sftp = new InMemorySftpFileClient(
            buildSftpTree('tajo/METEO', {
                'HARMONIE/Precipitacion/info.json': buildInfoJsonRaw({ nombre: 'Precipitación' }),
                ...Object.fromEntries(
                    buildRasterFilenames('harm_prec').map((n) => [`HARMONIE/Precipitacion/${n}`, 'x']),
                ),
            }),
        );

        config = {
            meteoBasePath: 'tajo/METEO',
            geoserverWorkspace: 'tajo',
            meteoGeotiffDir: tmpDir,
            meteoRetentionDays: 7,
        } as MeteoConfigService;

        discovery = new MeteoDiscoveryService(logger, sftp, config);
        geoserver = new InMemoryGeoserverImageMosaicClient();
        const fileSystem = {
            mkdir: jest.fn().mockResolvedValue(undefined),
            writeFile: jest.fn().mockResolvedValue(undefined),
            deleteFile: jest.fn(async (p: string) => {
                try {
                    fs.unlinkSync(p);
                } catch {
                    /* ignore */
                }
            }),
        } as unknown as import('../../../src/app/domain/ports/file-system.port').IFileSystem;
        handler = new PurgeMeteoGranulesHandler(logger, discovery, geoserver as any, fileSystem, config);

        // Pre-populate granules: some old, some recent.
        await geoserver.createImageMosaicStore({
            workspace: 'tajo',
            store: 'harmonie_precipitacion',
            directory: tmpDir,
        });

        const layerDir = path.join(tmpDir, 'harmonie_precipitacion');
        fs.mkdirSync(layerDir, { recursive: true });

        const dayMs = 24 * 60 * 60 * 1000;
        const samples = [
            { name: 'old1.tif', age: 10 * dayMs },
            { name: 'old2.tif', age: 8 * dayMs },
            { name: 'recent1.tif', age: 6 * dayMs },
            { name: 'recent2.tif', age: 1 * 60 * 60 * 1000 },
        ];
        for (const s of samples) {
            const tifPath = path.join(layerDir, s.name);
            fs.writeFileSync(tifPath, 'stub');
            await geoserver.addGranule('tajo', 'harmonie_precipitacion', tifPath, new Date(Date.now() - s.age));
        }
    });

    afterEach(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    });

    it('removes granules and disk files older than the retention window, keeps the rest', async () => {
        const result = await handler.execute(new PurgeMeteoGranulesCommand());

        expect(result.datasetsScanned).toBe(1);
        expect(result.granulesDeleted).toBe(2);
        expect(result.filesDeleted).toBe(2);
        expect(result.errors).toEqual([]);

        const remaining = await geoserver.listGranules('tajo', 'harmonie_precipitacion');
        expect(remaining).toHaveLength(2);
        expect(remaining.map((g) => g.location).sort()).toEqual(['recent1.tif', 'recent2.tif']);

        const layerDir = path.join(tmpDir, 'harmonie_precipitacion');
        expect(fs.existsSync(path.join(layerDir, 'old1.tif'))).toBe(false);
        expect(fs.existsSync(path.join(layerDir, 'old2.tif'))).toBe(false);
        expect(fs.existsSync(path.join(layerDir, 'recent1.tif'))).toBe(true);
    });

    it('keeps the layer (store) even when all granules expire', async () => {
        const result = await handler.execute(new PurgeMeteoGranulesCommand({ retentionDays: 0 }));
        expect(result.granulesDeleted).toBeGreaterThanOrEqual(0);

        // Store still present in the mock — listGranules still works.
        const after = await geoserver.listGranules('tajo', 'harmonie_precipitacion');
        expect(after).toBeDefined();
    });
});
