import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePredictionEnsembleColumn1771553800000 implements MigrationInterface {
    name = 'RemovePredictionEnsembleColumn1771553800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "predictions" DROP COLUMN IF EXISTS "ensemble"');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "predictions" ADD "ensemble" character varying(5)');
    }
}
