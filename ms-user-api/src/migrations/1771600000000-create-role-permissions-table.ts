import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRolePermissionsTable1771600000000 implements MigrationInterface {
    name = 'CreateRolePermissionsTable1771600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "role_permissions" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "roleId" uuid NOT NULL,
                "method" character varying(10) NOT NULL,
                "path" character varying(500) NOT NULL,
                CONSTRAINT "PK_role_permissions_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_role_permissions_roleId" FOREIGN KEY ("roleId")
                    REFERENCES "roles"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_role_permissions_roleId" ON "role_permissions" ("roleId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_role_permissions_roleId"');
        await queryRunner.query('DROP TABLE "role_permissions"');
    }
}
