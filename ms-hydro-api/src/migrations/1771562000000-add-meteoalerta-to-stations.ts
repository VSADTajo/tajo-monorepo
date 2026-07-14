import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeteoalertaToStations1771562000000 implements MigrationInterface {
    name = 'AddMeteoalertaToStations1771562000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "meteoalertaZonaCode" character varying(10)');
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "meteoalertaZonaNombre" character varying(150)');
        await queryRunner.query(
            'CREATE INDEX "IDX_stations_meteoalertaZonaCode" ON "stations" ("meteoalertaZonaCode")',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_stations_meteoalertaZonaCode"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "meteoalertaZonaNombre"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "meteoalertaZonaCode"');
    }
}
