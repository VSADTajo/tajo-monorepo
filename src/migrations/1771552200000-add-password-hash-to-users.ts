import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordHashToUsers1771552200000 implements MigrationInterface {
    name = 'AddPasswordHashToUsers1771552200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN "password" character varying NOT NULL DEFAULT ''
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            DROP COLUMN "password"
        `);
    }
}
