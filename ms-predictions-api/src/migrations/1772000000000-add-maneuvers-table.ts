import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManeuversTable1772000000000 implements MigrationInterface {
    name = 'AddManeuversTable1772000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "maneuvers" (
                "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
                "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
                "simulationId"    uuid NOT NULL,
                "reservoirCode"   character varying(100) NOT NULL,
                "outputFlowValue" numeric(12,4) NOT NULL,
                CONSTRAINT "PK_maneuvers_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_maneuvers_simulation"
                    FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_maneuvers_simulationId" ON "maneuvers" ("simulationId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_maneuvers_simulationId"');
        await queryRunner.query('DROP TABLE "maneuvers"');
    }
}
