# Research: User Roles

**Feature**: 001-user-roles
**Date**: 2026-02-19

## R1: Many-to-Many Relationship Strategy

**Decision**: Use an explicit join entity (`UserRole`) rather than TypeORM's `@ManyToMany` decorator with an auto-generated pivot table.

**Rationale**:
- An explicit join entity allows adding metadata to the assignment (e.g., `createdAt` timestamp for when the role was assigned).
- It follows the existing pattern where the project uses explicit entities for all database tables.
- It provides a dedicated repository port (`IUserRoleRepository`), which is cleaner for the hexagonal architecture than relying on TypeORM relation loading.
- The join entity can be independently queried, tested, and migrated.

**Alternatives considered**:
- TypeORM `@ManyToMany` + `@JoinTable`: Simpler to set up but hides the pivot table, doesn't allow metadata on the relationship, and makes it harder to follow the port/repository pattern. Rejected because it conflicts with the explicit, controlled approach of the constitution.

## R2: Role Name Uniqueness (Case-Insensitive)

**Decision**: Store role names in lowercase and enforce uniqueness at both the application layer (value object normalization) and database layer (unique constraint + LOWER index).

**Rationale**:
- The spec requires case-insensitive uniqueness (e.g., "Admin" and "admin" are the same role).
- Normalizing to lowercase in the `RoleNameValueObject` ensures consistency before data reaches the database.
- A database-level unique constraint provides a safety net against race conditions.
- A functional index on `LOWER(name)` is unnecessary if we always store lowercase, but a plain unique constraint on `name` suffices.

**Alternatives considered**:
- Store as-provided and use `LOWER()` in queries: More complex, requires citext extension or functional indexes. Rejected for simplicity.
- Use PostgreSQL `citext` type: Adds a dependency on the citext extension. Rejected — unnecessary when we normalize in the application layer.

## R3: Role Name Validation Rules

**Decision**: Role names must be 1-50 characters, containing only alphanumeric characters, hyphens, and underscores. Whitespace is trimmed. Validated in `RoleNameValueObject`.

**Rationale**:
- Spec FR-011 requires trimming whitespace and restricting to alphanumeric + hyphens + underscores.
- 50 characters max comes from spec FR-001.
- The regex pattern `^[a-zA-Z0-9_-]+$` (applied after trimming and lowercasing) is simple and well-understood.

**Alternatives considered**:
- Allow spaces in role names: Would complicate queries and display. Rejected per spec constraint.
- Allow unicode characters: Unnecessary for role identifiers. Rejected for simplicity.

## R4: Duplicate User-Role Assignment Prevention

**Decision**: Enforce uniqueness via a composite unique constraint on `(userId, roleId)` in the `user_roles` table, plus a check in the command handler before inserting.

**Rationale**:
- The spec (FR-004) requires preventing duplicate assignments.
- Application-level check provides a user-friendly error message (409 Conflict).
- Database-level constraint prevents race conditions when two concurrent requests try to assign the same role.
- The handler catches the duplicate and throws `ApiError(409, ...)`.

**Alternatives considered**:
- Only application-level check: Vulnerable to race conditions. Rejected.
- Only database-level constraint: Would result in a generic RepositoryError (500) instead of a business-meaningful 409. Rejected — both layers are needed.

## R5: Cascade Behavior on User Deletion

**Decision**: Use `ON DELETE CASCADE` on the `user_roles.userId` foreign key so that when a user is deleted, all their role assignments are automatically removed by the database.

**Rationale**:
- Spec FR-012 requires automatic removal of role assignments when a user is deleted.
- Database-level cascade is the most reliable approach — works regardless of whether deletion happens through the application or directly in the database.
- The existing `cleanDatabase` helper in tests uses `TRUNCATE ... CASCADE`, which is compatible.

**Alternatives considered**:
- Application-level cascade (delete assignments in a service before deleting user): More error-prone, requires transaction management. Rejected — DB cascade is simpler and safer.

## R6: Role Deletion Policy

**Decision**: For this feature scope, role deletion (DELETE endpoint) is NOT implemented. The spec does not include a user story for deleting roles. The edge case about "role deleted while users have it assigned" is noted but deferred.

**Rationale**:
- The spec covers 5 user stories: create role, assign, view user roles, list roles, remove assignment. None involve deleting the role entity itself.
- Adding role deletion would expand scope and introduce the cascade/prevent decision noted in the edge cases.
- This can be added in a future iteration if needed.

**Alternatives considered**:
- Include role deletion now: Would add another command, handler, endpoint, and edge case handling. Rejected — not in spec scope.

## R7: Controller Organization

**Decision**: Create a single `RoleController` that handles all role-related endpoints, including user-role assignment/removal operations.

**Rationale**:
- Role CRUD and user-role assignments are closely related and share the same domain context.
- Keeping them in one controller avoids spreading role logic across multiple controllers.
- The existing pattern shows one controller per resource domain (UserController, TestController).

**Alternatives considered**:
- Separate `UserRoleController` for assignment operations: Would fragment the role management interface. Rejected — a single controller with clear route prefixes is cleaner.
- Add role endpoints to `UserController`: Would bloat the user controller with role concerns. Rejected — separation of concerns.

## R8: API Route Design

**Decision**: Use RESTful nested routes under `/roles` for role CRUD and `/users/:userId/roles` for user-role operations.

**Rationale**:
- `POST /roles` — create a role (clear, standard REST)
- `GET /roles` — list all roles
- `POST /users/:userId/roles` — assign a role to a user (the user is the parent resource)
- `GET /users/:userId/roles` — get roles for a user
- `DELETE /users/:userId/roles/:roleId` — remove a role from a user
- This follows REST conventions where the URL reflects the resource hierarchy.

**Alternatives considered**:
- All under `/roles` (e.g., `POST /roles/assign`): Less RESTful, mixes resource CRUD with relationship management. Rejected.
- Flat routes like `POST /user-roles`: Loses the semantic relationship. Rejected.
