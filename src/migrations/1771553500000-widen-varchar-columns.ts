import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenVarcharColumns1771553500000 implements MigrationInterface {
    name = 'WidenVarcharColumns1771553500000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "simulations" ALTER COLUMN "modmeteo" TYPE character varying(100)');
        await queryRunner.query('ALTER TABLE "simulations" ALTER COLUMN "modmeteots" TYPE character varying(100)');
        await queryRunner.query('ALTER TABLE "simulations" ALTER COLUMN "environment" TYPE character varying(100)');
        await queryRunner.query('ALTER TABLE "simulations" ALTER COLUMN "createdBy" TYPE character varying(100)');
        await queryRunner.query(
            'ALTER TABLE "predictions" ALTER COLUMN "predictionProvider" TYPE character varying(100)',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "simulations" ALTER COLUMN "modmeteo" TYPE character varying(20)');
        await queryRunner.query('ALTER TABLE "simulations" ALTER COLUMN "modmeteots" TYPE character varying(20)');
        await queryRunner.query('ALTER TABLE "simulations" ALTER COLUMN "environment" TYPE character varying(20)');
        await queryRunner.query('ALTER TABLE "simulations" ALTER COLUMN "createdBy" TYPE character varying(20)');
        await queryRunner.query(
            'ALTER TABLE "predictions" ALTER COLUMN "predictionProvider" TYPE character varying(20)',
        );
    }
}
