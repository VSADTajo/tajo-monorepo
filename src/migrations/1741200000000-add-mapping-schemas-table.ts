import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMappingSchemasTable1741200000000 implements MigrationInterface {
    name = 'AddMappingSchemasTable1741200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "mapping_schemas" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "directoryPath" character varying(500) NOT NULL,
                "name" character varying(255) NOT NULL,
                "inputFormat" character varying(20) NOT NULL,
                "outputFormat" character varying(20) NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "fieldMappings" jsonb NOT NULL,
                "csvOptions" jsonb,
                CONSTRAINT "PK_mapping_schema_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_mapping_schema_directory_path" UNIQUE ("directoryPath")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "mapping_schemas"');
    }
}
