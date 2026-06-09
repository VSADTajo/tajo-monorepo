# Tasks: User Roles

**Input**: Design documents from `/specs/001-user-roles/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the project constitution (Principle V) mandates integration testing through endpoints for all features.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Domain Layer + Infrastructure)

**Purpose**: Create all shared domain entities, value objects, ports, repositories, module bindings, and migrations that ALL user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 [P] Create Role entity extending BaseAuditEntity with id (uuid PK), name (varchar 50, unique, not null), description (varchar 255, nullable) in `src/app/domain/entities/role.entity.ts`
- [x] T002 [P] Create UserRole join entity extending BaseAuditEntity with id (uuid PK), userId (uuid FK, not null), roleId (uuid FK, not null) in `src/app/domain/entities/user-role.entity.ts`
- [x] T003 [P] Create RoleNameValueObject that trims, lowercases, and validates role names (1-50 chars, regex `^[a-z0-9_-]+$`, throws EntityError on invalid) in `src/app/domain/value-objects/role-name.value-object.ts`
- [x] T004 [P] Create IRoleRepository abstract class with methods: create(Role), findById(string), findByName(string), findAll() in `src/app/domain/ports/role-repository.port.ts`
- [x] T005 [P] Create IUserRoleRepository abstract class with methods: create(UserRole), findByUserIdAndRoleId(string, string), findByUserId(string), delete(string) in `src/app/domain/ports/user-role-repository.port.ts`
- [x] T006 [P] Create RoleRepository implementing IRoleRepository using @InjectRepository(Role), wrapping all operations in try/catch with RepositoryError, injecting Logger in `src/app/infrastructure/persistence/role.repository.ts`
- [x] T007 [P] Create UserRoleRepository implementing IUserRoleRepository using @InjectRepository(UserRole), wrapping all operations in try/catch with RepositoryError, injecting Logger in `src/app/infrastructure/persistence/user-role.repository.ts`
- [x] T008 Update infrastructure.module.ts: add Role and UserRole to TypeOrmModule.forFeature([...]), bind IRoleRepository to RoleRepository and IUserRoleRepository to UserRoleRepository, export both ports in `src/app/infrastructure/infrastructure.module.ts`
- [x] T009 [P] Create migration for roles table with columns (createdAt, updatedAt, id uuid PK, name varchar(50) NOT NULL UNIQUE, description varchar(255) NULLABLE) in `src/migrations/TIMESTAMP-create-roles-table.ts`
- [x] T010 [P] Create migration for user_roles table with columns (createdAt, updatedAt, id uuid PK, userId uuid FK ON DELETE CASCADE, roleId uuid FK ON DELETE RESTRICT, UNIQUE(userId, roleId)) in `src/migrations/TIMESTAMP-create-user-roles-table.ts`
- [x] T011 [P] Create test factory with buildCreateRoleDto(overrides?) and buildAssignRoleDto(overrides?) functions generating unique test data per call in `test/factories/role.factory.ts`

**Checkpoint**: Foundation ready — domain layer, infrastructure, and migrations are in place. User story implementation can now begin.

---

## Phase 2: User Story 1 — Create a Role (Priority: P1) MVP

**Goal**: An administrator can create a new role with a unique name and optional description. Duplicate names are rejected (case-insensitive).

**Independent Test**: Create a role via POST /roles and verify it returns the role details. Attempt duplicate creation and verify 409 rejection. Attempt invalid names and verify 400 rejection.

### Implementation for User Story 1

- [x] T012 [P] [US1] Create CreateRoleResult with readonly fields (id, name, description) in `src/app/domain/results/create-role.result.ts`
- [x] T013 [P] [US1] Create CreateRoleRequestDto with @IsNotEmpty @IsString @MaxLength(50) name and @IsOptional @IsString @MaxLength(255) description, both with @ApiProperty in `src/app/api/dtos/create-role.request.dto.ts`
- [x] T014 [P] [US1] Create CreateRoleResponseDto with @ApiProperty for id, name, description in `src/app/api/dtos/create-role.response.dto.ts`
- [x] T015 [US1] Create CreateRoleCommand (with name, description getters) and CreateRoleHandler that: validates name with RoleNameValueObject, checks uniqueness via IRoleRepository.findByName, throws ApiError(409) if duplicate, creates Role entity, returns CreateRoleResult in `src/app/application/commands/create-role.command.ts`
- [x] T016 [US1] Create CreateRoleMapper with static toCommand(dto) and toResponseDto(result) methods in `src/app/application/mappers/create-role.mapper.ts`
- [x] T017 [US1] Create RoleController with @ApiTags('Roles'), @Controller() routes, inject Logger/CommandBus/QueryBus, add POST /roles endpoint using @ApiEndpoint decorator, standard try/catch error handling pattern in `src/app/api/controllers/role.controller.ts`
- [x] T018 [US1] Register CreateRoleHandler in providers and RoleController in controllers in `src/app/application/application.module.ts`
- [x] T019 [US1] Create e2e test: successful creation (201), duplicate name rejection (409), empty name (400), name too long (400), invalid characters (400), case-insensitive duplicate (409) in `test/modules/roles/create-role.e2e-spec.ts`

**Checkpoint**: POST /roles is fully functional. Roles can be created, validated, and uniqueness is enforced. MVP is deliverable.

---

## Phase 3: User Story 4 — List All Roles (Priority: P4, moved up)

**Goal**: Retrieve the complete list of roles in the system. Moved before US2/US3 because it only depends on US1's Role entity and provides a verification endpoint for role creation.

**Independent Test**: Create several roles, then GET /roles and verify all appear with correct details.

### Implementation for User Story 4

- [x] T020 [P] [US4] Create ListRolesResult with readonly roles array (each with id, name, description) in `src/app/domain/results/list-roles.result.ts`
- [x] T021 [P] [US4] Create ListRolesResponseDto with @ApiProperty roles array containing RoleItemDto (id, name, description) in `src/app/api/dtos/list-roles.response.dto.ts`
- [x] T022 [US4] Create ListRolesQuery and ListRolesHandler that calls IRoleRepository.findAll() and returns ListRolesResult in `src/app/application/queries/list-roles.query.ts`
- [x] T023 [US4] Create ListRolesMapper with static toResponseDto(result) method in `src/app/application/mappers/list-roles.mapper.ts`
- [x] T024 [US4] Add GET /roles endpoint to RoleController with @ApiEndpoint decorator in `src/app/api/controllers/role.controller.ts`
- [x] T025 [US4] Register ListRolesHandler in providers in `src/app/application/application.module.ts`
- [x] T026 [US4] Create e2e test: empty list (200, []), multiple roles returned (200), verify role details in list in `test/modules/roles/list-roles.e2e-spec.ts`

**Checkpoint**: POST /roles and GET /roles both work. Roles can be created and listed.

---

## Phase 4: User Story 2 — Assign a Role to a User (Priority: P2)

**Goal**: Assign an existing role to an existing user. Validates both exist and prevents duplicate assignments.

**Independent Test**: Register a user, create a role, assign role via POST /users/:userId/roles, verify 201. Attempt duplicate assignment and verify 409. Attempt with non-existent user/role and verify 404.

### Implementation for User Story 2

- [x] T027 [P] [US2] Create AssignRoleResult with readonly fields (id, userId, roleId, roleName) in `src/app/domain/results/assign-role.result.ts`
- [x] T028 [P] [US2] Create AssignRoleRequestDto with @IsNotEmpty @IsUUID roleId and @ApiProperty in `src/app/api/dtos/assign-role.request.dto.ts`
- [x] T029 [P] [US2] Create AssignRoleResponseDto with @ApiProperty for id, userId, roleId, roleName in `src/app/api/dtos/assign-role.response.dto.ts`
- [x] T030 [US2] Create AssignRoleToUserCommand (userId, roleId getters) and AssignRoleToUserHandler that: verifies user exists via IUserRepository.findById, verifies role exists via IRoleRepository.findById, checks no duplicate via IUserRoleRepository.findByUserIdAndRoleId (throws ApiError 409 if exists), creates UserRole entity, returns AssignRoleResult in `src/app/application/commands/assign-role-to-user.command.ts`
- [x] T031 [US2] Create AssignRoleToUserMapper with static toCommand(userId, dto) and toResponseDto(result) methods in `src/app/application/mappers/assign-role-to-user.mapper.ts`
- [x] T032 [US2] Add POST /users/:userId/roles endpoint to RoleController with @ApiEndpoint decorator in `src/app/api/controllers/role.controller.ts`
- [x] T033 [US2] Register AssignRoleToUserHandler in providers in `src/app/application/application.module.ts`
- [x] T034 [US2] Create e2e test: successful assignment (201), duplicate assignment (409), non-existent user (404/500), non-existent role (404/500), verify assignment details in response in `test/modules/roles/assign-role-to-user.e2e-spec.ts`

**Checkpoint**: Roles can be created, listed, and assigned to users.

---

## Phase 5: User Story 3 — View User Roles (Priority: P3)

**Goal**: Retrieve all roles assigned to a specific user. Returns empty list if user has no roles.

**Independent Test**: Register a user, create and assign multiple roles, then GET /users/:userId/roles and verify all assigned roles are returned.

### Implementation for User Story 3

- [x] T035 [P] [US3] Create GetUserRolesResult with readonly roles array (each with id, name, description) in `src/app/domain/results/get-user-roles.result.ts`
- [x] T036 [P] [US3] Create GetUserRolesResponseDto with @ApiProperty roles array in `src/app/api/dtos/get-user-roles.response.dto.ts`
- [x] T037 [US3] Create GetUserRolesQuery (userId getter) and GetUserRolesHandler that: verifies user exists via IUserRepository.findById, fetches assignments via IUserRoleRepository.findByUserId, loads role details for each assignment via IRoleRepository.findById, returns GetUserRolesResult in `src/app/application/queries/get-user-roles.query.ts`
- [x] T038 [US3] Create GetUserRolesMapper with static toResponseDto(result) method in `src/app/application/mappers/get-user-roles.mapper.ts`
- [x] T039 [US3] Add GET /users/:userId/roles endpoint to RoleController with @ApiEndpoint decorator in `src/app/api/controllers/role.controller.ts`
- [x] T040 [US3] Register GetUserRolesHandler in providers in `src/app/application/application.module.ts`
- [x] T041 [US3] Create e2e test: user with multiple roles (200, all returned), user with no roles (200, empty array), non-existent user (404/500) in `test/modules/roles/get-user-roles.e2e-spec.ts`

**Checkpoint**: Full read path works — create roles, assign to users, view user's roles.

---

## Phase 6: User Story 5 — Remove a Role from a User (Priority: P5)

**Goal**: Remove a previously assigned role from a user. Fails if assignment does not exist.

**Independent Test**: Assign a role to a user, remove it via DELETE, verify it no longer appears in GET /users/:userId/roles.

### Implementation for User Story 5

- [x] T042 [P] [US5] Create RemoveUserRoleResponseDto with @ApiProperty message field in `src/app/api/dtos/remove-user-role.response.dto.ts`
- [x] T043 [US5] Create RemoveRoleFromUserCommand (userId, roleId getters) and RemoveRoleFromUserHandler that: verifies user exists via IUserRepository.findById, verifies role exists via IRoleRepository.findById, finds assignment via IUserRoleRepository.findByUserIdAndRoleId (throws ApiError 404 if not found), deletes via IUserRoleRepository.delete, returns success message in `src/app/application/commands/remove-role-from-user.command.ts`
- [x] T044 [US5] Create RemoveRoleFromUserMapper with static toCommand(userId, roleId) and toResponseDto() methods in `src/app/application/mappers/remove-role-from-user.mapper.ts`
- [x] T045 [US5] Add DELETE /users/:userId/roles/:roleId endpoint to RoleController with @ApiEndpoint decorator in `src/app/api/controllers/role.controller.ts`
- [x] T046 [US5] Register RemoveRoleFromUserHandler in providers in `src/app/application/application.module.ts`
- [x] T047 [US5] Create e2e test: successful removal (200), assignment does not exist (404), verify role no longer in user's roles after removal, non-existent user (404/500) in `test/modules/roles/remove-role-from-user.e2e-spec.ts`

**Checkpoint**: Complete CRUD lifecycle — create roles, assign, view, list, remove. All user stories are implemented.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify the entire feature compiles, passes linting, and all tests pass together.

- [x] T048 Run linter and fix any issues with `npm run lint`
- [x] T049 Run TypeScript build and fix any compilation errors with `npm run build`
- [x] T050 Run all e2e tests together and verify all pass with `npm run test:e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories.
- **US1 (Phase 2)**: Depends on Foundational. Creates the controller and module registration.
- **US4 (Phase 3)**: Depends on Foundational + US1 (controller exists). Can run after US1.
- **US2 (Phase 4)**: Depends on Foundational + US1 (controller exists). Can run after US1, parallel with US4.
- **US3 (Phase 5)**: Depends on Foundational + US1 (controller exists). Can run after US1, parallel with US2/US4.
- **US5 (Phase 6)**: Depends on Foundational + US1 (controller exists). Can run after US1, parallel with US2/US3/US4.
- **Polish (Phase 7)**: Depends on all user stories being complete.

### User Story Dependencies

```text
Foundational ──> US1 (P1) ──┬──> US4 (P4) ──┐
                             ├──> US2 (P2) ──┤
                             ├──> US3 (P3) ──├──> Polish
                             └──> US5 (P5) ──┘
```

- **US1** is the only blocking story — it creates the controller file and initial module registration
- **US2, US3, US4, US5** can all run in parallel after US1 completes (they each add an endpoint to the existing controller)

### Within Each User Story

1. Result + DTOs can be created in parallel [P]
2. Command/Query + Handler depends on Result being available
3. Mapper depends on Command/Query and DTOs being available
4. Controller endpoint depends on Mapper, DTOs, and Command/Query
5. Module registration depends on Handler existing
6. E2E test depends on everything above

### Parallel Opportunities

**Foundational Phase** — 9 of 11 tasks are parallelizable:
```
Parallel: T001, T002, T003, T004, T005 (all domain files)
Parallel: T006, T007 (both repositories)
Parallel: T009, T010 (both migrations)
Parallel: T011 (test factory)
Sequential: T008 (module update, depends on entities + repos)
```

**Per User Story** — DTOs and Result can always run in parallel:
```
US1 example:
  Parallel: T012, T013, T014 (result, DTOs)
  Then: T015 (command+handler)
  Then: T016, T017 (mapper, controller)
  Then: T018 (module), T019 (e2e test)
```

**After US1 completes** — US2, US3, US4, US5 can all be worked on in parallel by different developers.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational
2. Complete Phase 2: User Story 1 — Create a Role
3. **STOP and VALIDATE**: Test POST /roles independently
4. Deploy/demo if ready — administrators can create roles

### Incremental Delivery

1. Foundational → ready
2. US1 (Create Role) → Test → Deploy (MVP!)
3. US4 (List Roles) → Test → Deploy (can see created roles)
4. US2 (Assign Role) → Test → Deploy (can assign roles to users)
5. US3 (View User Roles) → Test → Deploy (can see user's roles)
6. US5 (Remove Role) → Test → Deploy (full lifecycle complete)

### Parallel Team Strategy

With multiple developers after US1 completes:
- Developer A: US2 (Assign) + US5 (Remove) — write operations on user-roles
- Developer B: US3 (View User Roles) + US4 (List Roles) — read operations

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to specific user story for traceability
- US4 (List Roles) was moved before US2 because it provides a useful verification endpoint and has no dependency on UserRole
- All e2e tests follow the existing patterns: createTestApp(), supertest, Testcontainers, cleanDatabase(), factory functions
- Controller endpoints accumulate in a single `role.controller.ts` file — each story adds its endpoint(s)
- Module registrations accumulate in `application.module.ts` — each story adds its handler
- Commit after each completed story phase for clean git history
