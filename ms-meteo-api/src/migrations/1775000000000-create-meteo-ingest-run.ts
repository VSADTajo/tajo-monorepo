import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMeteoIngestRun1775000000000 implements MigrationInterface {
    name = 'CreateMeteoIngestRun1775000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "meteo_ingest_run" (
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "provider" varchar(32) NOT NULL,
                "variable" varchar(64) NULL,
                "forecast_run" timestamptz NULL,
                "files_processed" integer NOT NULL DEFAULT 0,
                "files_ok" integer NOT NULL DEFAULT 0,
                "files_failed" integer NOT NULL DEFAULT 0,
                "status" varchar(16) NOT NULL,
                "triggered_by" varchar(16) NOT NULL,
                "started_at" timestamptz NOT NULL,
                "finished_at" timestamptz NULL,
                "error_summary" text NULL,
                CONSTRAINT "PK_meteo_ingest_run_id" PRIMARY KEY ("id"),
                CONSTRAINT "CK_meteo_ingest_run_status" CHECK ("status" IN ('running','ok','partial','failed','noop')),
                CONSTRAINT "CK_meteo_ingest_run_triggered_by" CHECK ("triggered_by" IN ('cron','manual')),
                CONSTRAINT "CK_meteo_ingest_run_counters" CHECK ("files_processed" = "files_ok" + "files_failed")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_meteo_ingest_run_provider_variable_started_at"
            ON "meteo_ingest_run" ("provider", "variable", "started_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_meteo_ingest_run_started_at"
            ON "meteo_ingest_run" ("started_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_meteo_ingest_run_status"
            ON "meteo_ingest_run" ("status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "idx_meteo_ingest_run_status"');
        await queryRunner.query('DROP INDEX IF EXISTS "idx_meteo_ingest_run_started_at"');
        await queryRunner.query('DROP INDEX IF EXISTS "idx_meteo_ingest_run_provider_variable_started_at"');
        await queryRunner.query('DROP TABLE IF EXISTS "meteo_ingest_run"');
    }
}
