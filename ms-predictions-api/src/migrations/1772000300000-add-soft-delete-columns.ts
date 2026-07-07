import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteColumns1772000300000 implements MigrationInterface {
    name = 'AddSoftDeleteColumns1772000300000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "simulations" ADD COLUMN "deletedAt" TIMESTAMP');
        await queryRunner.query('ALTER TABLE "maneuvers" ADD COLUMN "deletedAt" TIMESTAMP');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "maneuvers" DROP COLUMN "deletedAt"');
        await queryRunner.query('ALTER TABLE "simulations" DROP COLUMN "deletedAt"');
    }
}
