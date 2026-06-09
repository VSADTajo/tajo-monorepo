import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserRolesTable1771552100000 implements MigrationInterface {
    name = 'CreateUserRolesTable1771552100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "user_roles" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "roleId" uuid NOT NULL,
                CONSTRAINT "PK_user_roles_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_roles_user_role" UNIQUE ("userId", "roleId"),
                CONSTRAINT "FK_user_roles_userId" FOREIGN KEY ("userId")
                    REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_user_roles_roleId" FOREIGN KEY ("roleId")
                    REFERENCES "roles"("id") ON DELETE RESTRICT
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "user_roles"');
    }
}
