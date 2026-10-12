import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reservoir inflow arrives from WISKI as FICT99.Validado for most reservoirs and
 * as an "_" qualified variant (FICT99_Calculado, FICT99_Calculado_1h,
 * FICT99_Calculado-2, FICT99_Calculado_2h_opcon_v3) for the rest. Ingestion used
 * to cut the name on "." only, so the variants landed on their own prediction
 * types that no consumer asks for and the inflow of those reservoirs never
 * showed. ms-model-api now stores every variant under FICT99.historical; this
 * moves the history already ingested onto that type and drops the orphan types.
 *
 * A prediction is only moved when FICT99.historical has no prediction for the
 * same simulation, station and percentile, so the move can never duplicate one.
 * Each reservoir carries a single inflow variant, so in practice every row moves.
 */
export class MergeFict99CalculadoIntoFict991772000500000 implements MigrationInterface {
    name = 'MergeFict99CalculadoIntoFict991772000500000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "prediction_types" ("name", "unit")
            SELECT 'FICT99.historical', 'm³/s'
            WHERE EXISTS (SELECT 1 FROM "prediction_types" WHERE "name" LIKE 'FICT99\\_%.historical')
            ON CONFLICT ("name") DO NOTHING
        `);

        await queryRunner.query(`
            UPDATE "predictions" p
            SET "predictionTypeId" = target."id", "updatedAt" = now()
            FROM "prediction_types" source, "prediction_types" target
            WHERE p."predictionTypeId" = source."id"
              AND source."name" LIKE 'FICT99\\_%.historical'
              AND target."name" = 'FICT99.historical'
              AND NOT EXISTS (
                  SELECT 1 FROM "predictions" existing
                  WHERE existing."predictionTypeId" = target."id"
                    AND existing."simulationId" = p."simulationId"
                    AND existing."stationId" = p."stationId"
                    AND existing."percentile" IS NOT DISTINCT FROM p."percentile"
              )
        `);

        await queryRunner.query(`
            DELETE FROM "prediction_types" t
            WHERE t."name" LIKE 'FICT99\\_%.historical'
              AND NOT EXISTS (SELECT 1 FROM "predictions" p WHERE p."predictionTypeId" = t."id")
        `);
    }

    public async down(): Promise<void> {
        // Irreversible: which variant each moved prediction came from is not kept.
        // Rolling back the code is enough; the merged history stays readable.
    }
}
