import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSimulationRunsTable1750000100000 implements MigrationInterface {
    name = 'AddSimulationRunsTable1750000100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "simulation_runs" (
                "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
                "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
                "simulationId"   uuid NOT NULL,
                "outputFolder"   character varying(500) NOT NULL,
                "status"         character varying(20) NOT NULL DEFAULT 'WAITING_RESULT',
                "startedAt"      TIMESTAMP NOT NULL DEFAULT now(),
                "completedAt"    TIMESTAMP NULL,
                "errorMessage"   text NULL,
                CONSTRAINT "PK_simulation_runs_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_simulation_runs_simulationId" UNIQUE ("simulationId")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_simulation_runs_status" ON "simulation_runs" ("status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_simulation_runs_status"');
        await queryRunner.query('DROP TABLE IF EXISTS "simulation_runs"');
    }
}
