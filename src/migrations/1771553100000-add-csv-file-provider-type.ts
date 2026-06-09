import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCsvFileProviderType1771553100000 implements MigrationInterface {
    name = 'AddCsvFileProviderType1771553100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "provider_configs"
            DROP CONSTRAINT "CHK_provider_configs_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "provider_configs"
            ADD CONSTRAINT "CHK_provider_configs_type"
            CHECK ("type" IN ('FEWS_API', 'SFTP_FILE', 'CSV_FILE'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "provider_configs"
            DROP CONSTRAINT "CHK_provider_configs_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "provider_configs"
            ADD CONSTRAINT "CHK_provider_configs_type"
            CHECK ("type" IN ('FEWS_API', 'SFTP_FILE'))
        `);
    }
}
