import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records which model source a run was launched against.
 *
 * A run followed by task id has to be polled against the same PI REST service it
 * was launched on, and the real FEWS and the local mock are different services —
 * without this the poller would have to guess. Existing rows predate the direct
 * flow, so they are all SFTP.
 *
 * `IF NOT EXISTS` on purpose. Deploys swap the container and migrations are run
 * by hand afterwards, so between the two the new code would query a column that
 * is not there yet — and that breaks the poller for every simulation, not only
 * the direct ones. Being idempotent means the column can be added ahead of the
 * deploy to close that window, and this migration still records itself
 * afterwards instead of failing on a column that is already in place.
 */
export class AddSimulationRunModelSource1772100000000 implements MigrationInterface {
    name = 'AddSimulationRunModelSource1772100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "simulation_runs"
            ADD COLUMN IF NOT EXISTS "modelSource" character varying(20) NOT NULL DEFAULT 'SFTP'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "simulation_runs"
            DROP COLUMN IF EXISTS "modelSource"
        `);
    }
}
