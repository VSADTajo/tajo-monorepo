import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stores the FEWS task id of runs launched through the REST API, so the poller
 * can follow the task instead of watching an output folder. Null for the SFTP
 * and MOCK flows.
 */
export class AddSimulationRunFewsTaskId1772000500000 implements MigrationInterface {
    name = 'AddSimulationRunFewsTaskId1772000500000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "simulation_runs"
            ADD COLUMN "fewsTaskId" character varying(200)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "simulation_runs"
            DROP COLUMN "fewsTaskId"
        `);
    }
}
