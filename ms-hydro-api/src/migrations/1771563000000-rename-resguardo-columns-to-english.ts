import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameResguardoColumnsToEnglish1771563000000 implements MigrationInterface {
    name = 'RenameResguardoColumnsToEnglish1771563000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "station_resguardos" RENAME COLUMN "volumenResguardoOriginal" TO "originalReserveVolume"',
        );
        await queryRunner.query(
            'ALTER TABLE "station_resguardos" RENAME COLUMN "cotaResguardoOriginal" TO "originalReserveLevel"',
        );
        await queryRunner.query(
            'ALTER TABLE "station_resguardos" RENAME COLUMN "volumenMinimoOriginal" TO "originalMinimumVolume"',
        );
        await queryRunner.query('ALTER TABLE "station_resguardos" RENAME COLUMN "volumenResguardo" TO "reserveVolume"');
        await queryRunner.query('ALTER TABLE "station_resguardos" RENAME COLUMN "cotaResguardo" TO "reserveLevel"');
        await queryRunner.query('ALTER TABLE "station_resguardos" RENAME COLUMN "volumenMinimo" TO "minimumVolume"');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "station_resguardos" RENAME COLUMN "originalReserveVolume" TO "volumenResguardoOriginal"',
        );
        await queryRunner.query(
            'ALTER TABLE "station_resguardos" RENAME COLUMN "originalReserveLevel" TO "cotaResguardoOriginal"',
        );
        await queryRunner.query(
            'ALTER TABLE "station_resguardos" RENAME COLUMN "originalMinimumVolume" TO "volumenMinimoOriginal"',
        );
        await queryRunner.query('ALTER TABLE "station_resguardos" RENAME COLUMN "reserveVolume" TO "volumenResguardo"');
        await queryRunner.query('ALTER TABLE "station_resguardos" RENAME COLUMN "reserveLevel" TO "cotaResguardo"');
        await queryRunner.query('ALTER TABLE "station_resguardos" RENAME COLUMN "minimumVolume" TO "volumenMinimo"');
    }
}
