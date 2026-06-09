# Data Model: User Roles

**Feature**: 001-user-roles
**Date**: 2026-02-19

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    users     │       │   user_roles     │       │    roles     │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)          │    ┌──│ id (PK)      │
│ name         │  └───>│ userId (FK)      │    │  │ name (UQ)    │
│ email (UQ)   │       │ roleId (FK)      │<───┘  │ description  │
│ status       │       │ createdAt        │       │ createdAt    │
│ welcomeEmailId       │ updatedAt        │       │ updatedAt    │
│ createdAt    │       └──────────────────┘       └──────────────┘
│ updatedAt    │
└──────────────┘

Cardinality: User (1) ──< UserRole >── (1) Role
             Many-to-many through explicit join table
```

## Entities

### Role (NEW)

| Field       | Type         | Constraints                              | Notes                                    |
|-------------|--------------|------------------------------------------|------------------------------------------|
| id          | UUID         | PK, auto-generated (uuid_generate_v4())  | Unique identifier                        |
| name        | VARCHAR(50)  | NOT NULL, UNIQUE                         | Stored lowercase, validated by VO        |
| description | VARCHAR(255) | NULLABLE                                 | Optional human-readable description      |
| createdAt   | TIMESTAMP    | NOT NULL, DEFAULT now()                  | Inherited from BaseAuditEntity           |
| updatedAt   | TIMESTAMP    | NOT NULL, DEFAULT now()                  | Inherited from BaseAuditEntity           |

**Validation rules**:
- `name`: 1-50 characters, alphanumeric + hyphens + underscores only, trimmed and lowercased by `RoleNameValueObject`
- `name` uniqueness: Enforced at DB level (UNIQUE constraint) and application level (check before insert)
- `description`: Optional, max 255 characters

**State transitions**: None — roles are stateless entities.

### UserRole (NEW — Join Entity)

| Field     | Type      | Constraints                                            | Notes                              |
|-----------|-----------|--------------------------------------------------------|------------------------------------|
| id        | UUID      | PK, auto-generated (uuid_generate_v4())                | Unique identifier                  |
| userId    | UUID      | FK → users.id, NOT NULL, ON DELETE CASCADE             | Reference to the user              |
| roleId    | UUID      | FK → roles.id, NOT NULL, ON DELETE RESTRICT            | Reference to the role              |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now()                                | Inherited from BaseAuditEntity     |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT now()                                | Inherited from BaseAuditEntity     |

**Constraints**:
- UNIQUE(userId, roleId) — prevents duplicate assignments
- ON DELETE CASCADE on userId — removes assignments when user is deleted (FR-012)
- ON DELETE RESTRICT on roleId — prevents role deletion while assignments exist (edge case protection)

### User (EXISTING — No Modifications)

The User entity is not modified. The relationship is maintained entirely through the `UserRole` join entity. No new columns or decorators are added to User.

## Value Objects

### RoleNameValueObject (NEW)

| Property | Type   | Validation                                                                 |
|----------|--------|---------------------------------------------------------------------------|
| value    | string | Required, trimmed, lowercased, 1-50 chars, regex: `^[a-z0-9_-]+$`        |

**Construction behavior**:
1. Trim whitespace from input
2. Convert to lowercase
3. Validate: throw `EntityError` if empty, exceeds 50 chars, or contains invalid characters

## Ports (Abstract Classes)

### IRoleRepository

| Method            | Parameters              | Returns              | Description                        |
|-------------------|-------------------------|----------------------|------------------------------------|
| create            | data: Role              | Promise\<Role\>      | Persist a new role                 |
| findById          | id: string              | Promise\<Role\>      | Find role by ID (throws if none)   |
| findByName        | name: string            | Promise\<Role \| null\> | Find role by name (nullable)    |
| findAll           | —                       | Promise\<Role[]\>    | List all roles                     |

### IUserRoleRepository

| Method                   | Parameters                         | Returns                  | Description                              |
|--------------------------|------------------------------------|--------------------------|------------------------------------------|
| create                   | data: UserRole                     | Promise\<UserRole\>      | Persist a new user-role assignment       |
| findByUserIdAndRoleId    | userId: string, roleId: string     | Promise\<UserRole \| null\> | Find specific assignment (nullable)   |
| findByUserId             | userId: string                     | Promise\<UserRole[]\>    | Get all assignments for a user           |
| delete                   | id: string                         | Promise\<void\>          | Remove an assignment by ID               |

## Results (Domain DTOs)

### CreateRoleResult

| Field       | Type   |
|-------------|--------|
| id          | string |
| name        | string |
| description | string \| null |

### AssignRoleResult

| Field     | Type   |
|-----------|--------|
| id        | string |
| userId    | string |
| roleId    | string |
| roleName  | string |

### GetUserRolesResult

| Field | Type                                                 |
|-------|------------------------------------------------------|
| roles | Array\<{ id: string, name: string, description: string \| null }\> |

### ListRolesResult

| Field | Type                                                 |
|-------|------------------------------------------------------|
| roles | Array\<{ id: string, name: string, description: string \| null }\> |

## Migrations

### Migration 1: Create Roles Table

```sql
CREATE TABLE "roles" (
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying(50) NOT NULL,
    "description" character varying(255),
    CONSTRAINT "UQ_roles_name" UNIQUE ("name"),
    CONSTRAINT "PK_roles_id" PRIMARY KEY ("id")
)
```

### Migration 2: Create User Roles Table

```sql
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
```
