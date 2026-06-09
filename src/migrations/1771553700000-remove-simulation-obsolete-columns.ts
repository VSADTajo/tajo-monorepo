import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSimulationObsoleteColumns1771553700000 implements MigrationInterface {
    name = 'RemoveSimulationObsoleteColumns1771553700000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "simulations" DROP COLUMN IF EXISTS "method"');
        await queryRunner.query('ALTER TABLE "simulations" DROP COLUMN IF EXISTS "modmeteots"');
        await queryRunner.query('ALTER TABLE "simulations" DROP COLUMN IF EXISTS "ensemble"');
        await queryRunner.query('ALTER TABLE "simulations" DROP COLUMN IF EXISTS "state"');
        await queryRunner.query('ALTER TABLE "simulations" DROP COLUMN IF EXISTS "basin"');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "simulations" ADD "method" character varying(10)');
        await queryRunner.query('ALTER TABLE "simulations" ADD "modmeteots" character varying(100)');
        await queryRunner.query('ALTER TABLE "simulations" ADD "ensemble" character varying(5)');
        await queryRunner.query('ALTER TABLE "simulations" ADD "state" character varying(1)');
        await queryRunner.query('ALTER TABLE "simulations" ADD "basin" character varying(100)');
    }
}
