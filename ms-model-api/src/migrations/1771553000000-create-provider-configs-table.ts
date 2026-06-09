import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProviderConfigsTable1771553000000 implements MigrationInterface {
    name = 'CreateProviderConfigsTable1771553000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "provider_configs" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "type" character varying(20) NOT NULL,
                "baseUrl" character varying(500) NOT NULL,
                "pollingIntervalMinutes" integer NOT NULL DEFAULT 360,
                "isActive" boolean NOT NULL DEFAULT false,
                "settings" jsonb NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_provider_configs_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_provider_configs_name" UNIQUE ("name"),
                CONSTRAINT "CHK_provider_configs_type" CHECK ("type" IN ('FEWS_API', 'SFTP_FILE')),
                CONSTRAINT "CHK_provider_configs_interval" CHECK ("pollingIntervalMinutes" >= 5)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "ingestion_runs" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "providerConfigId" uuid NOT NULL,
                "status" character varying(20) NOT NULL,
                "startedAt" TIMESTAMP NOT NULL,
                "completedAt" TIMESTAMP,
                "seriesCount" integer NOT NULL DEFAULT 0,
                "eventsCount" integer NOT NULL DEFAULT 0,
                "errorMessage" text,
                CONSTRAINT "PK_ingestion_runs_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_ingestion_runs_provider" FOREIGN KEY ("providerConfigId") REFERENCES "provider_configs"("id") ON DELETE CASCADE,
                CONSTRAINT "CHK_ingestion_runs_status" CHECK ("status" IN ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL'))
            )
        `);

        await queryRunner.query('CREATE INDEX "IDX_ingestion_runs_provider" ON "ingestion_runs" ("providerConfigId")');
        await queryRunner.query('CREATE INDEX "IDX_ingestion_runs_started" ON "ingestion_runs" ("startedAt" DESC)');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_ingestion_runs_started"');
        await queryRunner.query('DROP INDEX "IDX_ingestion_runs_provider"');
        await queryRunner.query('DROP TABLE "ingestion_runs"');
        await queryRunner.query('DROP TABLE "provider_configs"');
    }
}
