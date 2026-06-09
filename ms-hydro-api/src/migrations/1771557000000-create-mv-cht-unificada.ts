import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMvChtUnificada1771557000000 implements MigrationInterface {
    name = 'CreateMvChtUnificada1771557000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure pg_trgm extension exists for trigram search
        await queryRunner.query(`
            CREATE EXTENSION IF NOT EXISTS pg_trgm;
        `);

        // Create materialized view that unifies all CHT geographic entities
        await queryRunner.query(`
            CREATE MATERIALIZED VIEW mv_cht_unificada AS
            SELECT
                'punto_saih'::text AS origen,
                p.codigo,
                p.nombre,
                p.tipo_cod,
                public.st_x(p.geom) AS x,
                public.st_y(p.geom) AS y,
                concat_ws(' '::text, p.nombre, p.codigo) AS search_text
            FROM public.cht_puntos_saih p
            WHERE p.geom IS NOT NULL
            UNION ALL
            SELECT
                'sistema'::text AS origen,
                NULL::character varying AS codigo,
                s.sistema AS nombre,
                NULL::character varying AS tipo_cod,
                public.st_x(public.st_pointonsurface(s.geom)) AS x,
                public.st_y(public.st_pointonsurface(s.geom)) AS y,
                concat_ws(' '::text, s.sistema) AS search_text
            FROM public.cht_sistemas10 s
            WHERE s.geom IS NOT NULL
            UNION ALL
            SELECT
                'subcuenca'::text AS origen,
                sc.code AS codigo,
                sc.name AS nombre,
                NULL::character varying AS tipo_cod,
                sc.centroid_x AS x,
                sc.centroid_y AS y,
                concat_ws(' '::text, sc.name, sc.code) AS search_text
            FROM public.cht_subcuencas sc
            UNION ALL
            SELECT
                'zona_expl'::text AS origen,
                NULL::character varying AS codigo,
                ze.nombre,
                NULL::character varying AS tipo_cod,
                public.st_x(public.st_pointonsurface(ze.geom)) AS x,
                public.st_y(public.st_pointonsurface(ze.geom)) AS y,
                concat_ws(' '::text, ze.nombre) AS search_text
            FROM public.cht_zonas_expl ze
            WHERE ze.geom IS NOT NULL
            WITH NO DATA;
        `);

        // Create index on nombre for sorting
        await queryRunner.query(`
            CREATE INDEX mv_cht_unificada_nombre_idx
            ON mv_cht_unificada USING btree (nombre);
        `);

        // Create GIN trigram index on search_text for fast ILIKE searches
        await queryRunner.query(`
            CREATE INDEX mv_cht_unificada_search_trgm_idx
            ON mv_cht_unificada USING gin (search_text gin_trgm_ops);
        `);

        // Populate the materialized view
        await queryRunner.query(`
            REFRESH MATERIALIZED VIEW mv_cht_unificada;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP MATERIALIZED VIEW IF EXISTS mv_cht_unificada');
    }
}
