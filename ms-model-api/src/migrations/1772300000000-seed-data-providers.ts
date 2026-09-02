import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the data providers a fresh deployment needs, so the backoffice comes up
 * with every source already described and the switch from SFTP files to the
 * FEWS PI REST service is an activate/deactivate away.
 *
 * Rows are matched by name: a provider an operator already created (or edited)
 * is left untouched. Every FEWS provider mirrors one block of Idrica's
 * `endpoints_FEWS_TagusFlowCast.xlsx` — filter, parameter ids and the search
 * period each GET is documented with. They start inactive on purpose: "Run now"
 * on an inactive provider is how a new source is compared against the one in
 * production before anything is switched over.
 */
export class SeedDataProviders1772300000000 implements MigrationInterface {
    name = 'SeedDataProviders1772300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const provider of PROVIDERS) {
            await queryRunner.query(
                `INSERT INTO "provider_configs" ("name", "type", "baseUrl", "pollingIntervalMinutes", "isActive", "settings")
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                 ON CONFLICT ("name") DO NOTHING`,
                [
                    provider.name,
                    provider.type,
                    provider.baseUrl,
                    provider.pollingIntervalMinutes,
                    provider.isActive,
                    JSON.stringify(provider.settings),
                ],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Only the rows this migration introduced are removed; anything an
        // operator created under one of these names since is theirs to keep.
        await queryRunner.query(
            `DELETE FROM "provider_configs"
             WHERE "name" = ANY($1::text[])
               AND NOT EXISTS (SELECT 1 FROM "ingestion_runs" r WHERE r."providerConfigId" = "provider_configs"."id")`,
            [PROVIDERS.map((provider) => provider.name)],
        );
    }
}

interface SeedProvider {
    name: string;
    type: 'FEWS_API' | 'SFTP_FILE' | 'CSV_FILE' | 'WISKI_API';
    baseUrl: string;
    pollingIntervalMinutes: number;
    isActive: boolean;
    settings: Record<string, unknown>;
}

const FEWS_BASE_URL = 'http://cpdfews2.saihchtajo.es:8080/FewsWebServices';
const SFTP_BASE_URL = 'http://ms-sftp-api:3003';
const WISKI_BASE_URL = 'https://apisaih.saihchtajo.es';
const HOURLY = 60;

function fews(name: string, settings: Record<string, unknown>): SeedProvider {
    return {
        name,
        type: 'FEWS_API',
        baseUrl: FEWS_BASE_URL,
        pollingIntervalMinutes: HOURLY,
        isActive: false,
        settings,
    };
}

function sftp(name: string, filePrefix: string): SeedProvider {
    return {
        name,
        type: 'SFTP_FILE',
        baseUrl: SFTP_BASE_URL,
        pollingIntervalMinutes: HOURLY,
        isActive: true,
        settings: { filePath: 'tajo', filePrefix },
    };
}

export const PROVIDERS: SeedProvider[] = [
    // ── Today's sources: PI-JSON files FEWS drops on the SFTP ────────────────
    sftp('EPS Caudal', 'tagus_eps_Q'),
    sftp('EPS Pluviometría', 'tagus_eps_p'),
    sftp('EPS Volumen', 'tagus_eps_V'),
    sftp('Harmonie Caudal', 'tagus_harmonie_Q'),
    sftp('Harmonie Pluviometría', 'tagus_harmonie_P'),
    sftp('Harmonie Volumen', 'tagus_harmonie_V'),
    {
        name: 'FlowCast Observados',
        type: 'CSV_FILE',
        baseUrl: SFTP_BASE_URL,
        pollingIntervalMinutes: HOURLY,
        isActive: true,
        settings: { filePath: 'tajo/wiski', filePrefix: 'Tagus_FlowCast' },
    },
    {
        name: 'WISKI Observados (API)',
        type: 'WISKI_API',
        baseUrl: WISKI_BASE_URL,
        pollingIntervalMinutes: HOURLY,
        isActive: false,
        settings: { endpointPath: '/wiski/tagus_flowcast_observado/', sourceTimezone: 'Europe/Madrid' },
    },

    // ── FEWS PI REST — sheet "GET timeseries Precipitaciones" ────────────────
    fews('FEWS EPS Pluviometría', {
        filterId: 'Tajo_ImportEPS',
        parameterIds: [
            'P.ens.forecast.Med',
            'P.ens.forecast.90',
            'P.ens.forecast.75',
            'P.ens.forecast.25',
            'P.ens.forecast.10',
        ],
        horizonDays: 10,
        lookbackDays: 0,
    }),
    fews('FEWS Harmonie Pluviometría', {
        filterId: 'Spain_Estaciones_Harmonie',
        parameterIds: ['P.harmonie.forecast'],
        horizonDays: 3,
        lookbackDays: 0,
    }),
    fews('FEWS EPS Precipitación areal', {
        filterId: 'Tajo_Pareal',
        parameterIds: [
            'P.areal.ens.sis10.Med',
            'P.areal.ens.sis10.Max',
            'P.areal.ens.sis10.Med.12h',
            'P.areal.ens.sis10.Max.12h',
            'P.areal.ens.sis10.Med.24h',
            'P.areal.ens.sis10.Max.24h',
            'P.areal.ens.subcNAM.Med',
            'P.areal.ens.subcNAM.Max',
            'P.areal.ens.subcNAM.Med.12h',
            'P.areal.ens.subcNAM.Max.12h',
            'P.areal.ens.subcNAM.Med.24h',
            'P.areal.ens.subcNAM.Max.24h',
            'P.areal.ens.aemet.Med',
            'P.areal.ens.aemet.Max',
            'P.areal.ens.aemet.Med.12h',
            'P.areal.ens.aemet.Max.12h',
            'P.areal.ens.aemet.Med.24h',
            'P.areal.ens.aemet.Max.24h',
        ],
        horizonDays: 10,
        lookbackDays: 0,
    }),
    fews('FEWS Harmonie Precipitación areal', {
        filterId: 'Tajo_Pareal',
        parameterIds: [
            'P.areal.harmonie.sis10',
            'P.areal.harmonie.sis10.12H',
            'P.areal.harmonie.sis10.24H',
            'P.areal.harmonie.subcNAM',
            'P.areal.harmonie.subcNAM.12H',
            'P.areal.harmonie.subcNAM.24H',
            'P.areal.harmonie.aemet',
            'P.areal.harmonie.aemet.12H',
            'P.areal.harmonie.aemet.24H',
        ],
        horizonDays: 3,
        lookbackDays: 0,
    }),
    fews('FEWS SAIH Precipitación areal observada', {
        filterId: 'Tajo_Pareal',
        parameterIds: [
            'P.areal.obs.sis10.1h.v',
            'P.areal.obs.sis10.12h.v',
            'P.areal.obs.sis10.24h.v',
            'P.areal.obs.subcNAM.1h.v',
            'P.areal.obs.subcNAM.12h.v',
            'P.areal.obs.subcNAM.24h.v',
            'P.areal.obs.aemet.1h.v',
            'P.areal.obs.aemet.12h.v',
            'P.areal.obs.aemet.24h.v',
        ],
        horizonDays: 0,
        lookbackDays: 3,
    }),

    // ── sheet "GET timeseries Caudales" ──────────────────────────────────────
    fews('FEWS EPS Caudal', {
        filterId: 'Tajo_API',
        parameterIds: [
            'Q.NAM.ens.Med',
            'Q.NAM.ens.90',
            'Q.NAM.ens.75',
            'Q.NAM.ens.25',
            'Q.NAM.ens.10',
            'I.NAM.ens.medio',
            'I.NAM.ens.90',
            'I.NAM.ens.75',
            'I.NAM.ens.25',
            'I.NAM.ens.10',
            'Q.mk11.EPSforecast',
            'Q.mk11.EPS25forecast',
            'Q.mk11.EPS75forecast',
            'I.mk11.EPSforecast',
            'I.mk11.EPS25forecast',
            'I.mk11.EPS75forecast',
        ],
        horizonDays: 6,
        lookbackDays: 0,
    }),
    fews('FEWS Harmonie Caudal', {
        filterId: 'Tajo_API',
        parameterIds: ['Q.NAM.harmonie', 'I.NAM.harmonie', 'Q.mk11.forecast', 'I.mk11.forecast'],
        horizonDays: 3,
        lookbackDays: 0,
    }),
    fews('FEWS RS Minerve Caudal', {
        filterId: 'Tajo_API',
        parameterIds: ['Q.minerve'],
        ensembleId: 'RSMinerve_cases',
        horizonDays: 5,
        lookbackDays: 0,
    }),

    // ── sheet "GET timeseries Volumenes" ─────────────────────────────────────
    fews('FEWS EPS Volumen', {
        filterId: 'Tajo_EmbalsesForecasts',
        parameterIds: [
            'V.NAM.ens.medio_acum',
            'V.NAM.ens.10_acum',
            'V.NAM.ens.25_acum',
            'V.NAM.ens.75_acum',
            'V.NAM.ens.90_acum',
            'V.MIKE11.ens.medio_acum',
            'V.MIKE11.ens.25_acum',
            'V.MIKE11.ens.75_acum',
        ],
        horizonDays: 6,
        lookbackDays: 0,
    }),
    fews('FEWS Harmonie Volumen', {
        filterId: 'Tajo_EmbalsesForecasts',
        parameterIds: ['V.NAM.harmonie_acum', 'V.MIKE11.harmonie_acum'],
        horizonDays: 3,
        lookbackDays: 0,
    }),
];
