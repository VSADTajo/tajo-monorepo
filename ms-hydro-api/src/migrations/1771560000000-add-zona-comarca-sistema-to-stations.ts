import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZonaComarcaSistemaToStations1771560000000 implements MigrationInterface {
    name = 'AddZonaComarcaSistemaToStations1771560000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "zona" character varying(100)');
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "comarcaName" character varying(150)');
        await queryRunner.query('ALTER TABLE "stations" ADD COLUMN "sistemaName" character varying(100)');

        await queryRunner.query('CREATE INDEX "IDX_stations_zona" ON "stations" ("zona")');
        await queryRunner.query('CREATE INDEX "IDX_stations_comarcaName" ON "stations" ("comarcaName")');
        await queryRunner.query('CREATE INDEX "IDX_stations_sistemaName" ON "stations" ("sistemaName")');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_stations_sistemaName"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_stations_comarcaName"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_stations_zona"');

        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "sistemaName"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "comarcaName"');
        await queryRunner.query('ALTER TABLE "stations" DROP COLUMN IF EXISTS "zona"');
    }
}
