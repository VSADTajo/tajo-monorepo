import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records where a manual simulation expects its model output from, so a run
 * made against the mock is never mistaken for one made against the real model.
 * Existing rows predate the mock, so they are all SFTP.
 */
export class AddSimulationModelSource1772000400000 implements MigrationInterface {
    name = 'AddSimulationModelSource1772000400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "simulations"
            ADD COLUMN "modelSource" character varying(20) NOT NULL DEFAULT 'SFTP'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "simulations"
            DROP COLUMN "modelSource"
        `);
    }
}
