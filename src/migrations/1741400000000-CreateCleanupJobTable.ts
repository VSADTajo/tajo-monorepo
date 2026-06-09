import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCleanupJobTable1741400000000 implements MigrationInterface {
    name = 'CreateCleanupJobTable1741400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "cleanup_jobs" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "directoryPath" character varying NOT NULL,
                "extensions" text[] NOT NULL,
                "frequency" character varying NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "lastExecutedAt" TIMESTAMP WITH TIME ZONE,
                "lastExecutionResult" jsonb,
                "nextExecutionAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_cleanup_jobs_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_cleanup_jobs_directoryPath" UNIQUE ("directoryPath")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "cleanup_jobs"');
    }
}
