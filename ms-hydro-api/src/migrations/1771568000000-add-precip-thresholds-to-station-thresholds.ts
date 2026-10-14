import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrecipThresholdsToStationThresholds1771568000000 implements MigrationInterface {
    name = 'AddPrecipThresholdsToStationThresholds1771568000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "station_thresholds"
                ADD COLUMN "umbral1Precip1h" double precision,
                ADD COLUMN "umbral2Precip1h" double precision,
                ADD COLUMN "umbral3Precip1h" double precision,
                ADD COLUMN "umbral1Precip12h" double precision,
                ADD COLUMN "umbral2Precip12h" double precision,
                ADD COLUMN "umbral3Precip12h" double precision
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "station_thresholds"
                DROP COLUMN IF EXISTS "umbral3Precip12h",
                DROP COLUMN IF EXISTS "umbral2Precip12h",
                DROP COLUMN IF EXISTS "umbral1Precip12h",
                DROP COLUMN IF EXISTS "umbral3Precip1h",
                DROP COLUMN IF EXISTS "umbral2Precip1h",
                DROP COLUMN IF EXISTS "umbral1Precip1h"
        `);
    }
}
