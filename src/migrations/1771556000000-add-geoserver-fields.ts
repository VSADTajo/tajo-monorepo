import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeoserverFields1771556000000 implements MigrationInterface {
    name = 'AddGeoserverFields1771556000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Recreate enum with 7 GeoServer types (mapping old values in USING CASE)
        await queryRunner.query('ALTER TYPE "station_type_enum" RENAME TO "station_type_enum_old"');
        await queryRunner.query(`
            CREATE TYPE "station_type_enum" AS ENUM (
                'AFORO_EN_RIO', 'AFOROS_EN_CANAL', 'EMBALSE_SAIH',
                'PLUVIOMETRO', 'TELENIVOMETRO', 'IMPULSION', 'MARCO_DE_CONTROL'
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "stations" ALTER COLUMN "stationType" TYPE "station_type_enum"
            USING CASE
                WHEN "stationType"::text = 'HYDROLOGICAL' THEN 'AFORO_EN_RIO'
                WHEN "stationType"::text = 'PLUVIOMETRIC' THEN 'PLUVIOMETRO'
                WHEN "stationType"::text = 'METEOROLOGICAL' THEN 'TELENIVOMETRO'
                ELSE "stationType"::text
            END::"station_type_enum"
        `);
        await queryRunner.query('DROP TYPE "station_type_enum_old"');

        // 3. Drop UNIQUE constraint on subBasinName
        await queryRunner.query('ALTER TABLE "stations" DROP CONSTRAINT "UQ_stations_subBasinName"');

        // 4. Add new columns to stations
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "municipio" character varying(150)');
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "provincia" character varying(100)');
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "ccaa" character varying(100)');
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "tipoCod" character varying(10)');

        // 5. Add new columns to sub_basins
        await queryRunner.query('ALTER TABLE "sub_basins" ADD COLUMN "basinName" character varying(100)');
        await queryRunner.query('ALTER TABLE "sub_basins" ADD COLUMN "area" double precision');
        await queryRunner.query('ALTER TABLE "sub_basins" ADD COLUMN "perimetro" double precision');
        await queryRunner.query('ALTER TABLE "sub_basins" ADD COLUMN "centroidX" double precision');
        await queryRunner.query('ALTER TABLE "sub_basins" ADD COLUMN "centroidY" double precision');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove sub_basins columns
        await queryRunner.query('ALTER TABLE "sub_basins" DROP COLUMN IF EXISTS "centroidY"');
        await queryRunner.query('ALTER TABLE "sub_basins" DROP COLUMN IF EXISTS "centroidX"');
        await queryRunner.query('ALTER TABLE "sub_basins" DROP COLUMN IF EXISTS "perimetro"');
        await queryRunner.query('ALTER TABLE "sub_basins" DROP COLUMN IF EXISTS "area"');
        await queryRunner.query('ALTER TABLE "sub_basins" DROP COLUMN IF EXISTS "basinName"');

        // Remove stations columns
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "tipoCod"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "ccaa"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "provincia"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "municipio"');

        // Re-add UNIQUE constraint on subBasinName
        await queryRunner.query(
            'ALTER TABLE "stations" ADD CONSTRAINT "UQ_stations_subBasinName" UNIQUE ("subBasinName")',
        );

        /* eslint-disable @typescript-eslint/quotes, prettier/prettier, quotes */
        // Revert enum (map back to original 3 values)
        await queryRunner.query(`UPDATE "stations" SET "stationType" = 'AFORO_EN_RIO' WHERE "stationType" IN ('AFORO_EN_RIO', 'AFOROS_EN_CANAL', 'EMBALSE_SAIH', 'IMPULSION', 'MARCO_DE_CONTROL')`);
        await queryRunner.query(`UPDATE "stations" SET "stationType" = 'PLUVIOMETRO' WHERE "stationType" = 'PLUVIOMETRO'`);
        await queryRunner.query(`UPDATE "stations" SET "stationType" = 'TELENIVOMETRO' WHERE "stationType" = 'TELENIVOMETRO'`);
        await queryRunner.query(`ALTER TYPE "station_type_enum" RENAME TO "station_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "station_type_enum" AS ENUM ('HYDROLOGICAL', 'METEOROLOGICAL', 'PLUVIOMETRIC')`);
        /* eslint-enable @typescript-eslint/quotes, prettier/prettier, quotes */
        await queryRunner.query(`
            ALTER TABLE "stations" ALTER COLUMN "stationType" TYPE "station_type_enum"
            USING CASE
                WHEN "stationType"::text = 'AFORO_EN_RIO' THEN 'HYDROLOGICAL'
                WHEN "stationType"::text = 'PLUVIOMETRO' THEN 'PLUVIOMETRIC'
                WHEN "stationType"::text = 'TELENIVOMETRO' THEN 'METEOROLOGICAL'
                ELSE 'HYDROLOGICAL'
            END::"station_type_enum"
        `);
        await queryRunner.query('DROP TYPE "station_type_enum_old"');
    }
}
