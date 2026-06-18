import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';
import * as zlib from 'zlib';
import { extract as tarExtract } from 'tar-stream';
import { XMLParser } from 'fast-xml-parser';
import { IAemetClient, AemetGeoJsonCollection, AemetGeoJsonFeature } from '@domain/ports/aemet-client.port';
import { ProviderError } from '@domain/errors/provider.error';
import { MeteoConfigService } from '@config/meteo/meteo-config.service';

@Injectable()
export class AemetClientService implements IAemetClient {
    private readonly xmlParser: XMLParser;

    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly config: MeteoConfigService,
    ) {
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            removeNSPrefix: true,
            isArray: (tagName) => ['info', 'area', 'eventCode', 'parameter', 'geocode'].includes(tagName),
        });
    }

    async fetchAvisos(): Promise<AemetGeoJsonCollection> {
        try {
            const datosUrl = await this.fetchDatosUrl();
            if (!datosUrl) {
                return { type: 'FeatureCollection', features: [] };
            }

            const tarBuffer = await this.downloadFile(datosUrl);
            const features = await this.extractAndParse(tarBuffer);

            this.logger.log({ msg: 'AEMET avisos fetched', area: 'esp', totalFeatures: features.length });
            return { type: 'FeatureCollection', features };
        } catch (error) {
            this.logger.error({ msg: 'Error fetching AEMET avisos', entity: 'AEMET', error: String(error) });
            throw new ProviderError(`AEMET avisos fetch failed: ${error}`);
        }
    }

    private async fetchDatosUrl(): Promise<string | null> {
        const url = `${this.config.aemetBaseUrl}/api/avisos_cap/ultimoelaborado/area/esp`;
        this.logger.log({ msg: 'Fetching AEMET datos URL', url });

        const response = await axios.get(url, {
            headers: { Accept: 'application/json' },
            params: { api_key: this.config.aemetApiKey },
            timeout: 15_000,
        });

        if (response.data?.estado !== 200 || !response.data?.datos) {
            this.logger.warn({ msg: 'AEMET returned no data', estado: response.data?.estado });
            return null;
        }

        return response.data.datos;
    }

    private async downloadFile(url: string): Promise<Buffer> {
        this.logger.log({ msg: 'Downloading AEMET TAR file', url });

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 60_000,
        });

        return Buffer.from(response.data);
    }

    private async extractAndParse(tarBuffer: Buffer): Promise<AemetGeoJsonFeature[]> {
        const features: AemetGeoJsonFeature[] = [];

        const isGzip = tarBuffer[0] === 0x1f && tarBuffer[1] === 0x8b;
        const rawTar = isGzip ? zlib.gunzipSync(tarBuffer) : tarBuffer;

        const xmlContents = await this.extractTarEntries(rawTar);

        for (const xml of xmlContents) {
            try {
                const parsed = this.xmlParser.parse(xml);
                const alerts = this.getAlerts(parsed);
                for (const alert of alerts) {
                    const alertFeatures = this.alertToFeatures(alert);
                    features.push(...alertFeatures);
                }
            } catch (error) {
                this.logger.warn({ msg: 'Failed to parse CAP XML', entity: 'AEMET', error: String(error) });
            }
        }

        return features;
    }

    private extractTarEntries(tarBuffer: Buffer): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const entries: string[] = [];
            const extractor = tarExtract();

            extractor.on('entry', (header, stream, next) => {
                const chunks: Buffer[] = [];
                stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                stream.on('end', () => {
                    if (header.name.endsWith('.xml')) {
                        entries.push(Buffer.concat(chunks).toString('utf-8'));
                    }
                    next();
                });
                stream.resume();
            });

            extractor.on('finish', () => resolve(entries));
            extractor.on('error', reject);

            extractor.end(tarBuffer);
        });
    }

    private getAlerts(parsed: any): any[] {
        if (parsed.alert) {
            return Array.isArray(parsed.alert) ? parsed.alert : [parsed.alert];
        }
        return [];
    }

    private alertToFeatures(alert: any): AemetGeoJsonFeature[] {
        const features: AemetGeoJsonFeature[] = [];

        const alertAttrs = {
            identifier: this.str(alert.identifier),
            sender: this.str(alert.sender),
            sent: this.str(alert.sent),
            status: this.str(alert.status),
            msgType: this.str(alert.msgType),
        };

        const infos = (Array.isArray(alert.info) ? alert.info : alert.info ? [alert.info] : []).filter(
            (i: any) => this.str(i.language) === 'es-ES',
        );

        for (const info of infos) {
            const { eventTypeCode, eventTypeName } = this.extractEventType(info.eventCode);
            const level = this.extractLevel(info.parameter);

            const infoAttrs = {
                language: this.str(info.language),
                category: this.str(info.category),
                event: this.str(info.event),
                responseType: this.str(info.responseType),
                urgency: this.str(info.urgency),
                severity: this.str(info.severity),
                certainty: this.str(info.certainty),
                effective: this.str(info.effective),
                onset: this.str(info.onset),
                expires: this.str(info.expires),
                senderName: this.str(info.senderName),
                headline: this.str(info.headline),
                description: this.str(info.description),
                instruction: this.str(info.instruction),
                web: this.str(info.web),
                contact: this.str(info.contact),
                eventCode: this.extractKeyValuePairs(info.eventCode),
                parameters: this.extractKeyValuePairs(info.parameter),
                eventTypeCode,
                eventTypeName,
                level,
            };

            const areas = Array.isArray(info.area) ? info.area : info.area ? [info.area] : [];

            for (const area of areas) {
                const polygonStr = this.str(area.polygon);
                const geometry = this.parseGeometry(polygonStr);
                const geocode = this.extractGeocode(area.geocode);
                const provinciaCode = geocode.length >= 4 ? geocode.substring(2, 4) : 'unknown';

                features.push({
                    type: 'Feature',
                    geometry,
                    properties: {
                        ...alertAttrs,
                        ...infoAttrs,
                        areaDesc: this.str(area.areaDesc),
                        polygon: polygonStr,
                        geocode,
                        provinciaCode,
                    },
                });
            }
        }

        return features;
    }

    private extractEventType(eventCodeItems: any): { eventTypeCode: string; eventTypeName: string } {
        if (!eventCodeItems) return { eventTypeCode: 'unknown', eventTypeName: 'unknown' };
        const arr = Array.isArray(eventCodeItems) ? eventCodeItems : [eventCodeItems];
        const fenomeno = arr.find((item: any) => this.str(item.valueName) === 'AEMET-Meteoalerta fenomeno');
        if (!fenomeno) return { eventTypeCode: 'unknown', eventTypeName: 'unknown' };

        const value = this.str(fenomeno.value);
        const parts = value.split(';');
        return {
            eventTypeCode: parts[0] || 'unknown',
            eventTypeName: parts[1] || 'unknown',
        };
    }

    private extractLevel(parameterItems: any): string {
        if (!parameterItems) return 'unknown';
        const arr = Array.isArray(parameterItems) ? parameterItems : [parameterItems];
        const nivel = arr.find((item: any) => this.str(item.valueName) === 'AEMET-Meteoalerta nivel');
        return nivel ? this.str(nivel.value) : 'unknown';
    }

    private extractGeocode(geocodeItems: any): string {
        if (!geocodeItems) return 'unknown';
        const arr = Array.isArray(geocodeItems) ? geocodeItems : [geocodeItems];
        const zona = arr.find((item: any) => this.str(item.valueName) === 'AEMET-Meteoalerta zona');
        return zona ? this.str(zona.value) : 'unknown';
    }

    private parseGeometry(polygonStr: string): AemetGeoJsonFeature['geometry'] {
        if (!polygonStr || polygonStr === 'unknown') {
            return { type: 'Point', coordinates: [0, 0] };
        }

        try {
            const coordinates = polygonStr
                .trim()
                .split(/\s+/)
                .map((pair) => {
                    const [lat, lon] = pair.split(',').map(Number);
                    return [lon, lat]; // GeoJSON is [lon, lat]
                });

            return { type: 'Polygon', coordinates: [coordinates] };
        } catch {
            return { type: 'Point', coordinates: [0, 0] };
        }
    }

    private extractKeyValuePairs(items: any): { valueName: string; value: string }[] | null {
        if (!items) return null;
        const arr = Array.isArray(items) ? items : [items];
        return arr.map((item) => ({
            valueName: this.str(item.valueName),
            value: this.str(item.value),
        }));
    }

    private str(value: any): string {
        if (value === null || value === undefined) return 'unknown';
        return String(value);
    }
}
