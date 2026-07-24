import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAerialPrecipitation1784896544000 implements MigrationInterface {
    name = 'CreateAerialPrecipitation1784896544000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "aerial_precipitation_series" (
                "createdAt"        TIMESTAMP        NOT NULL DEFAULT now(),
                "updatedAt"        TIMESTAMP        NOT NULL DEFAULT now(),
                "id"               uuid             NOT NULL DEFAULT uuid_generate_v4(),
                "locationId"       varchar(100)     NOT NULL,
                "parameterId"      varchar(100)     NOT NULL,
                "forecastDate"     TIMESTAMP        NOT NULL,
                "provider"         varchar(20)      NOT NULL,
                "layer"            varchar(20)      NOT NULL,
                "stat"             varchar(10),
                "accumulation"     varchar(10)      NOT NULL,
                "moduleInstanceId" varchar(100),
                "stationName"      varchar(100),
                "lat"              double precision,
                "lon"              double precision,
                "startDate"        TIMESTAMP,
                "endDate"          TIMESTAMP,
                "units"            varchar(20)      NOT NULL DEFAULT 'mm',
                "missVal"          double precision NOT NULL DEFAULT -999,
                "timeStepSeconds"  integer          NOT NULL DEFAULT 3600,
                "creationDate"     TIMESTAMP,
                "approvedDate"     TIMESTAMP,
                "sourceFileName"   varchar(200)     NOT NULL,
                CONSTRAINT "PK_aerial_precipitation_series_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_aerial_precip_series_natural_key"
                    UNIQUE ("locationId", "parameterId", "forecastDate")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_aerial_precip_series_forecastDate"
                ON "aerial_precipitation_series" ("forecastDate")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_aerial_precip_series_lookup"
                ON "aerial_precipitation_series"
                ("layer", "provider", "accumulation", "stat", "forecastDate" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_aerial_precip_series_locationId"
                ON "aerial_precipitation_series" ("locationId")
        `);

        await queryRunner.query(`
            CREATE TABLE "aerial_precipitation_events" (
                "createdAt"  TIMESTAMP        NOT NULL DEFAULT now(),
                "seriesId"   uuid             NOT NULL,
                "eventDate"  TIMESTAMP        NOT NULL,
                "value"      double precision NOT NULL,
                "flag"       smallint         NOT NULL,
                CONSTRAINT "PK_aerial_precip_events" PRIMARY KEY ("seriesId", "eventDate"),
                CONSTRAINT "FK_aerial_precip_events_series"
                    FOREIGN KEY ("seriesId")
                    REFERENCES "aerial_precipitation_series"("id")
                    ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS "aerial_precipitation_events"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_aerial_precip_series_locationId"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_aerial_precip_series_lookup"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_aerial_precip_series_forecastDate"');
        await queryRunner.query('DROP TABLE IF EXISTS "aerial_precipitation_series"');
    }
}
