import { MigrationInterface, QueryRunner } from 'typeorm';

export class PermissionGroups1771700000000 implements MigrationInterface {
    name = 'PermissionGroups1771700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create permissions table
        await queryRunner.query(`
            CREATE TABLE "permissions" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100),
                "method" character varying(10) NOT NULL,
                "path" character varying(500) NOT NULL,
                "tag" character varying(50),
                CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_permission_method_path" UNIQUE ("method", "path")
            )
        `);

        // 2. Insert unique method+path pairs from existing role_permissions
        await queryRunner.query(`
            INSERT INTO "permissions" ("method", "path")
            SELECT DISTINCT "method", "path" FROM "role_permissions"
        `);

        // 3. Add permissionId column to role_permissions
        await queryRunner.query(`
            ALTER TABLE "role_permissions" ADD COLUMN "permissionId" uuid
        `);

        // 4. Populate permissionId by matching method+path
        await queryRunner.query(`
            UPDATE "role_permissions" rp
            SET "permissionId" = p."id"
            FROM "permissions" p
            WHERE rp."method" = p."method" AND rp."path" = p."path"
        `);

        // 5. Make permissionId NOT NULL and add FK
        await queryRunner.query(`
            ALTER TABLE "role_permissions" ALTER COLUMN "permissionId" SET NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "role_permissions"
            ADD CONSTRAINT "FK_role_permissions_permission"
            FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT
        `);

        // 6. Add unique constraint (roleId, permissionId) before dropping old columns
        await queryRunner.query(`
            ALTER TABLE "role_permissions"
            ADD CONSTRAINT "UQ_role_permission" UNIQUE ("roleId", "permissionId")
        `);

        // 7. Drop old method and path columns
        await queryRunner.query('ALTER TABLE "role_permissions" DROP COLUMN "method"');
        await queryRunner.query('ALTER TABLE "role_permissions" DROP COLUMN "path"');

        // 8. Create groups table
        await queryRunner.query(`
            CREATE TABLE "groups" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(50) NOT NULL,
                "description" character varying(255),
                CONSTRAINT "PK_groups_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_groups_name" UNIQUE ("name")
            )
        `);

        // 9. Create group_roles join table
        await queryRunner.query(`
            CREATE TABLE "group_roles" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "groupId" uuid NOT NULL,
                "roleId" uuid NOT NULL,
                CONSTRAINT "PK_group_roles_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_group_role" UNIQUE ("groupId", "roleId"),
                CONSTRAINT "FK_group_roles_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_group_roles_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT
            )
        `);

        // 10. Create user_groups join table
        await queryRunner.query(`
            CREATE TABLE "user_groups" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "groupId" uuid NOT NULL,
                CONSTRAINT "PK_user_groups_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_group" UNIQUE ("userId", "groupId"),
                CONSTRAINT "FK_user_groups_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_user_groups_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse: drop new tables, restore role_permissions columns
        await queryRunner.query('DROP TABLE "user_groups"');
        await queryRunner.query('DROP TABLE "group_roles"');
        await queryRunner.query('DROP TABLE "groups"');

        // Restore method and path columns
        await queryRunner.query('ALTER TABLE "role_permissions" ADD COLUMN "method" character varying(10)');
        await queryRunner.query('ALTER TABLE "role_permissions" ADD COLUMN "path" character varying(500)');

        // Populate from permissions table
        await queryRunner.query(`
            UPDATE "role_permissions" rp
            SET "method" = p."method", "path" = p."path"
            FROM "permissions" p
            WHERE rp."permissionId" = p."id"
        `);

        await queryRunner.query('ALTER TABLE "role_permissions" ALTER COLUMN "method" SET NOT NULL');
        await queryRunner.query('ALTER TABLE "role_permissions" ALTER COLUMN "path" SET NOT NULL');

        // Drop permissionId FK and column
        await queryRunner.query('ALTER TABLE "role_permissions" DROP CONSTRAINT "UQ_role_permission"');
        await queryRunner.query('ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_permission"');
        await queryRunner.query('ALTER TABLE "role_permissions" DROP COLUMN "permissionId"');

        await queryRunner.query('DROP TABLE "permissions"');
    }
}
