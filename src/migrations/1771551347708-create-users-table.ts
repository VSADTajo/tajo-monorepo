import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1771551347708 implements MigrationInterface {
    name = 'CreateUsersTable1771551347708';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "public"."users_status_enum" AS ENUM('pending', 'active', 'inactive')
        `);
        await queryRunner.query(`
            CREATE TABLE "users" (
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "email" character varying NOT NULL,
                "status" "public"."users_status_enum" NOT NULL DEFAULT 'pending',
                "welcomeEmailId" character varying,
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "users"');
        await queryRunner.query('DROP TYPE "public"."users_status_enum"');
    }
}
