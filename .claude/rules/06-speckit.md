# Spec-Driven Development

## Pipeline (in order)

1. `/speckit-specify` — define feature (user stories, acceptance criteria, success criteria)
2. `/speckit-clarify` — resolve `[NEEDS CLARIFICATION]` ambiguities
3. `/vsad-preset` — load NestJS + VSAD Tajo conventions into the session (run before `/speckit-plan`)
4. `/speckit-plan` — technical architecture (NestJS hexagonal + CQRS), API contracts, data model, migrations, events
5. `/speckit-tasks` — ordered implementation checklist (TDD, IDs `T001/T002`, `[P]` for parallel)
6. `/speckit-implement` — execute tasks with TDD (`tdd-implementer` agent)
7. `/speckit-analyze` — consistency audit between spec/plan/tasks (read-only)

## Hybrid `.specify/` Layout

The constitution lives at the **repo root**; specs live **per service**.

```
.specify/
└── memory/
    └── constitution.md                    # SHARED — repo-wide principles

<ms-xxx>/.specify/
├── memory/
│   └── constitution.md                    # OPTIONAL — service-specific extensions
├── templates/                             # spec, plan, tasks, checklist, constitution
└── specs/
    └── <feature-name>/
        ├── spec.md                        # WHAT & WHY (tech-agnostic)
        ├── plan.md                        # HOW (NestJS arch, API contracts, migrations)
        ├── tasks.md                       # TDD checklist with T001/T002 IDs
        └── checklists/<domain>.md         # quality gates
```

Rules:
- A feature scoped to a single service ALWAYS creates its spec inside that service's `.specify/specs/`.
- A cross-service feature creates a separate `<feature>-<service>` spec inside each service it touches and references the shared "umbrella" spec in `.specify/specs/<feature>/` at root.
- Service-level `constitution.md` MUST NOT contradict the root constitution.

## Hard Rules

- Always run `/vsad-preset` before `/speckit-plan`.
- Specs MUST be technology-agnostic. No NestJS / Vue / Postgres specifics in `spec.md`.
- Plans reference the root constitution (`.specify/memory/constitution.md`) and the canonical service template (`ms-gateway-api/CLAUDE.md`).
- Tasks use IDs `T001/T002`. Parallelizable tasks marked `[P]`. Test tasks marked `[TEST]` and ALWAYS precede the implementation task they cover.
- Never implement without an approved `tasks.md`.
- Never modify the root constitution without versioning it (semantic versioning, ratification date).

## Agents Behind the Skills

| Skill | Agent backing it |
|-------|-------------------|
| `/speckit-specify` + `/speckit-clarify` | `spec-developer` (writes/refines `spec.md`) |
| `/speckit-plan` + `/speckit-tasks` + `/speckit-analyze` | inline (planning logic in the skill itself) |
| `/speckit-implement` | `tdd-implementer` (the ONLY agent that writes production code) |
| post-impl review | `code-reviewer` |
| post-impl test coverage audit | `feature-test-orchestrator` |

For complex multi-service work, `/tech-lead` orchestrates an Agent Team, with each teammate following this same pipeline inside its assigned service.
