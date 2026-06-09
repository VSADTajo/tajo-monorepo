import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZonaExplToStations1771561000000 implements MigrationInterface {
    name = 'AddZonaExplToStations1771561000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "zonaExplOgcFid" integer');
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "zonaExplNombre" character varying(20)');
        await queryRunner.query('CREATE INDEX "IDX_stations_zonaExplOgcFid" ON "stations" ("zonaExplOgcFid")');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_stations_zonaExplOgcFid"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "zonaExplNombre"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "zonaExplOgcFid"');
    }
}
