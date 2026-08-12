import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `scenario_files` (N files of any type per scenario) and migrates the
 * legacy single `payload` jsonb of each existing scenario into one `.json`
 * file so no data is lost. Expand-contract: `payload` is only made nullable
 * here; it is dropped in a later migration once every consumer reads files.
 */
export class CreateScenarioFilesTable1771566000000 implements MigrationInterface {
    name = 'CreateScenarioFilesTable1771566000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "scenario_files" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "scenarioId" uuid NOT NULL,
                "filename" character varying(255) NOT NULL,
                "contentType" character varying(255) NOT NULL,
                "content" bytea NOT NULL,
                "sizeBytes" integer NOT NULL DEFAULT 0,
                CONSTRAINT "PK_scenario_files_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_scenario_files_scenario" FOREIGN KEY ("scenarioId")
                    REFERENCES "scenarios" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_scenario_files_scenarioId" ON "scenario_files" ("scenarioId")`);

        // Data migration: each legacy payload becomes a "<name>.json" file.
        await queryRunner.query(`
            INSERT INTO "scenario_files"
                ("createdAt", "updatedAt", "id", "scenarioId", "filename", "contentType", "content", "sizeBytes")
            SELECT
                s."createdAt",
                s."updatedAt",
                uuid_generate_v4(),
                s."id",
                s."name" || '.json',
                'application/json',
                convert_to(s."payload"::text, 'UTF8'),
                octet_length(convert_to(s."payload"::text, 'UTF8'))
            FROM "scenarios" s
            WHERE s."payload" IS NOT NULL
        `);

        // Expand-contract: new scenarios no longer require a payload.
        await queryRunner.query(`ALTER TABLE "scenarios" ALTER COLUMN "payload" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore the NOT NULL guarantee safely (backfill any null payloads first).
        await queryRunner.query(`UPDATE "scenarios" SET "payload" = '{}'::jsonb WHERE "payload" IS NULL`);
        await queryRunner.query(`ALTER TABLE "scenarios" ALTER COLUMN "payload" SET NOT NULL`);
        await queryRunner.query(`DROP INDEX "IDX_scenario_files_scenarioId"`);
        await queryRunner.query(`DROP TABLE "scenario_files"`);
    }
}
