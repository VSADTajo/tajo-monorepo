import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenPredictedByColumn1771554000000 implements MigrationInterface {
    name = 'WidenPredictedByColumn1771554000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "predictions" ALTER COLUMN "predictedBy" TYPE character varying(100)',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "predictions" ALTER COLUMN "predictedBy" TYPE character varying(30)',
        );
    }
}
