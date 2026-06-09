import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStationThresholdsTable1771559000000 implements MigrationInterface {
    name = 'CreateStationThresholdsTable1771559000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "station_thresholds" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "stationId" uuid NOT NULL,
                "parametro" character varying(20),
                "senal" character varying(20),
                "umbralNivel1" double precision,
                "umbralCaudal1" double precision,
                "umbralNivel2" double precision,
                "umbralCaudal2" double precision,
                "umbralNivel3" double precision,
                "umbralCaudal3" double precision,
                "maxNivelMuro" double precision,
                "maxNivelCaseta" double precision,
                "umbralVolumen1" double precision,
                "umbralVolumen2" double precision,
                "umbralVolumen3" double precision,
                "caudalEntrada" double precision,
                "caudalSalida" double precision,
                "capacidad" double precision,
                CONSTRAINT "PK_station_thresholds_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_station_thresholds_stationId" UNIQUE ("stationId"),
                CONSTRAINT "FK_station_thresholds_stationId" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_station_thresholds_stationId" ON "station_thresholds" ("stationId")',
        );

        // Migrate existing umbral data from stations to station_thresholds
        await queryRunner.query(`
            INSERT INTO "station_thresholds" ("stationId", "umbralNivel1")
            SELECT "id", "umbral"
            FROM "stations"
            WHERE "umbral" IS NOT NULL
        `);

        // Drop the old umbral column from stations
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "umbral"');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add umbral column to stations
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "umbral" double precision');

        // Migrate data back
        await queryRunner.query(`
            UPDATE "stations" s
            SET "umbral" = st."umbralNivel1"
            FROM "station_thresholds" st
            WHERE s."id" = st."stationId"
        `);

        await queryRunner.query('DROP INDEX "IDX_station_thresholds_stationId"');
        await queryRunner.query('DROP TABLE "station_thresholds"');
    }
}
