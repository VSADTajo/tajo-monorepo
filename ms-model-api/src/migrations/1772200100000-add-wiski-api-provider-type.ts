import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWiskiApiProviderType1772200100000 implements MigrationInterface {
    name = 'AddWiskiApiProviderType1772200100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "provider_configs"
            DROP CONSTRAINT IF EXISTS "CHK_provider_configs_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "provider_configs"
            ADD CONSTRAINT "CHK_provider_configs_type"
            CHECK ("type" IN ('FEWS_API', 'SFTP_FILE', 'CSV_FILE', 'WISKI_API'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "provider_configs"
            DROP CONSTRAINT IF EXISTS "CHK_provider_configs_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "provider_configs"
            ADD CONSTRAINT "CHK_provider_configs_type"
            CHECK ("type" IN ('FEWS_API', 'SFTP_FILE', 'CSV_FILE'))
        `);
    }
}
