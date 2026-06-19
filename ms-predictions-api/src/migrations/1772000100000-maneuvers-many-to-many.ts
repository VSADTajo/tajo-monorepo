import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refactors maneuvers from a per-simulation child entity to a standalone,
 * reusable entity linked to simulations through a `simulation_maneuvers`
 * pivot table.
 *
 * Up:
 *   1. Create the pivot table `simulation_maneuvers`.
 *   2. Backfill it with the existing maneuver-simulation pairs.
 *   3. Drop the FK + index on maneuvers.simulationId and the column itself.
 *
 * Down: re-add simulationId column (nullable so we can backfill), re-create
 * the FK, backfill from the pivot table (one of the existing pairs), drop
 * the pivot, then mark NOT NULL.
 */
export class ManeuversManyToMany1772000100000 implements MigrationInterface {
    name = 'ManeuversManyToMany1772000100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create the pivot table
        await queryRunner.query(`
            CREATE TABLE "simulation_maneuvers" (
                "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
                "simulationId" uuid NOT NULL,
                "maneuverId"   uuid NOT NULL,
                CONSTRAINT "PK_simulation_maneuvers" PRIMARY KEY ("simulationId", "maneuverId"),
                CONSTRAINT "FK_simulation_maneuvers_simulation"
                    FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_simulation_maneuvers_maneuver"
                    FOREIGN KEY ("maneuverId") REFERENCES "maneuvers"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_simulation_maneuvers_maneuverId"
                ON "simulation_maneuvers" ("maneuverId")
        `);

        // 2. Backfill the pivot with existing pairs
        await queryRunner.query(`
            INSERT INTO "simulation_maneuvers" ("simulationId", "maneuverId")
            SELECT "simulationId", "id" FROM "maneuvers"
            ON CONFLICT DO NOTHING
        `);

        // 3. Drop the old simulationId column on maneuvers
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_maneuvers_simulationId"');
        await queryRunner.query('ALTER TABLE "maneuvers" DROP CONSTRAINT IF EXISTS "FK_maneuvers_simulation"');
        await queryRunner.query('ALTER TABLE "maneuvers" DROP COLUMN IF EXISTS "simulationId"');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add simulationId (nullable so we can backfill, then NOT NULL)
        await queryRunner.query('ALTER TABLE "maneuvers" ADD COLUMN "simulationId" uuid');

        await queryRunner.query(`
            UPDATE "maneuvers" m
            SET "simulationId" = sm."simulationId"
            FROM (
                SELECT DISTINCT ON ("maneuverId") "maneuverId", "simulationId"
                FROM "simulation_maneuvers"
                ORDER BY "maneuverId", "createdAt"
            ) sm
            WHERE m.id = sm."maneuverId"
        `);

        // Maneuvers that had no associated simulation in the pivot are orphans — drop them
        await queryRunner.query('DELETE FROM "maneuvers" WHERE "simulationId" IS NULL');

        await queryRunner.query('ALTER TABLE "maneuvers" ALTER COLUMN "simulationId" SET NOT NULL');
        await queryRunner.query(`
            ALTER TABLE "maneuvers"
            ADD CONSTRAINT "FK_maneuvers_simulation"
            FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE CASCADE
        `);
        await queryRunner.query('CREATE INDEX "IDX_maneuvers_simulationId" ON "maneuvers" ("simulationId")');

        // Drop the pivot
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_simulation_maneuvers_maneuverId"');
        await queryRunner.query('DROP TABLE "simulation_maneuvers"');
    }
}
