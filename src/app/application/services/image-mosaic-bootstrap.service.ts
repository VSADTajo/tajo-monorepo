import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { IGeoserverImageMosaicClient } from '@domain/ports/geoserver-image-mosaic-client.port';
import { IFileSystem } from '@domain/ports/file-system.port';
import { MeteoConfigService } from '@config/meteo/meteo-config.service';
import { DiscoveredDataset } from '@domain/results/meteo.results';
import { GeoTiffPathValueObject } from '@domain/value-objects/geotiff-path.value-object';

const INDEXER_PROPERTIES = [
    'Schema=*the_geom:Polygon,location:String,ingestion:java.util.Date',
    'TimeAttribute=ingestion',
    'PropertyCollectors=TimestampFileNameExtractorSPI[timeregex](ingestion)',
    'Caching=false',
    '',
].join('\n');

// 14 consecutive digits: yyyyMMddHHmmss — avoids the 'T' literal escape which GeoServer ignores.
const TIMEREGEX_PROPERTIES = ['regex=([0-9]{14}),format=yyyyMMddHHmmss', ''].join('\n');

// PostGIS datastore for the mosaic index. The default shapefile index stores
// dates as DBF DATE (day precision only), losing the time-of-day component.
// PostgreSQL stores full TIMESTAMP with hours/minutes/seconds.
function buildDatastoreProperties(host: string, port: number, database: string, user: string, passwd: string): string {
    return [
        'SPI=org.geotools.data.postgis.PostgisNGDataStoreFactory',
        `host=${host}`,
        `port=${port}`,
        `database=${database}`,
        `user=${user}`,
        `passwd=${passwd}`,
        'schema=public',
        'Loose bbox=true',
        'Estimated extends=false',
        'max connections=5',
        'min connections=1',
        '',
    ].join('\n');
}

/**
 * Application service that ensures the GeoServer ImageMosaic store + layer
 * exists for a given dataset. Idempotent: if the store already exists,
 * this is a no-op apart from re-writing the property files (safe).
 *
 * Lives in `application/services/` because it orchestrates two output ports
 * (`IGeoserverImageMosaicClient` + `IFileSystem`) without knowing about
 * concrete implementations. The handler injects this service directly.
 */
@Injectable()
export class ImageMosaicBootstrapService {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly geoserverClient: IGeoserverImageMosaicClient,
        private readonly fileSystem: IFileSystem,
        private readonly config: MeteoConfigService,
    ) {}

    async ensure(dataset: DiscoveredDataset): Promise<{ directory: string; storeExists: boolean }> {
        const workspace = this.config.geoserverWorkspace;
        const store = dataset.layerName.bareName();
        const directory = GeoTiffPathValueObject.directoryFor(this.config.meteoGeotiffDir, store);

        const datastoreProperties = buildDatastoreProperties(
            this.config.geoserverDbHost,
            this.config.geoserverDbPort,
            this.config.geoserverDbDatabase,
            this.config.geoserverDbUsername,
            this.config.geoserverDbPassword,
        );

        await this.fileSystem.mkdir(directory);
        await this.fileSystem.writeFile(`${directory}/indexer.properties`, INDEXER_PROPERTIES);
        await this.fileSystem.writeFile(`${directory}/timeregex.properties`, TIMEREGEX_PROPERTIES);
        await this.fileSystem.writeFile(`${directory}/datastore.properties`, datastoreProperties);

        const exists = await this.geoserverClient.storeExists(workspace, store);
        return { directory, storeExists: exists };
    }

    async createStore(dataset: DiscoveredDataset, directory: string): Promise<void> {
        const workspace = this.config.geoserverWorkspace;
        const store = dataset.layerName.bareName();
        // Drop the PostGIS index table before creating the store so GeoServer does
        // not reuse stale granule records from a previously deleted store.
        await this.geoserverClient.purgeMosaicIndex(store);
        this.logger.log({ msg: 'Creating ImageMosaic store', entity: 'GeoServer', workspace, store, directory });
        await this.geoserverClient.createImageMosaicStore({ workspace, store, directory });
    }
}
