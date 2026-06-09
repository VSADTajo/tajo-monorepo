import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUniqueSubBasinNameFromStations1771558000000 implements MigrationInterface {
    name = 'DropUniqueSubBasinNameFromStations1771558000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "stations" DROP CONSTRAINT "UQ_stations_subBasinName"');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "stations" ADD CONSTRAINT "UQ_stations_subBasinName" UNIQUE ("subBasinName")',
        );
    }
}
