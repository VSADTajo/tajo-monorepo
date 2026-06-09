import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeStationidToVarchar1771553600000 implements MigrationInterface {
    name = 'ChangeStationidToVarchar1771553600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "predictions" ALTER COLUMN "stationId" TYPE character varying(50) USING "stationId"::text',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "predictions" ALTER COLUMN "stationId" TYPE uuid USING "stationId"::uuid');
    }
}
