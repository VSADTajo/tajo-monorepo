import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSimulationDataOrigin1771553900000 implements MigrationInterface {
    name = 'AddSimulationDataOrigin1771553900000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "simulations" ADD COLUMN "dataOrigin" character varying(20) DEFAULT \'FORECAST\'',
        );

        await queryRunner.query(`
            UPDATE "simulations" SET "dataOrigin" = 'HISTORICAL'
            WHERE id IN (
                SELECT DISTINCT p."simulationId"
                FROM predictions p
                INNER JOIN prediction_types pt ON pt.id = p."predictionTypeId"
                WHERE pt.name LIKE '%.historical'
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "simulations" DROP COLUMN "dataOrigin"');
    }
}
