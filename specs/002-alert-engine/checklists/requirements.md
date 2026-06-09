# Requirements Checklist: Alert Engine

## Completeness

- [x] All CRUD operations for alert rules are specified (create, read, update, delete, toggle)
- [x] Query execution against MongoDB and PostgreSQL is defined
- [x] Condition evaluation logic with 6 operators is specified
- [x] Notification dispatch payload matches ms-notifications-api consumer contract
- [x] Cooldown mechanism is defined to prevent alert flooding
- [x] Execution history storage and retrieval is specified
- [x] Test query functionality (before saving) is defined
- [x] Predefined templates with variable substitution are specified
- [x] Data source connection configuration is defined
- [x] Server restart recovery (reload enabled rules) is specified

## Clarity

- [x] Data model fields have types, constraints, and defaults
- [x] API contract has request/response examples for all endpoints
- [x] Condition operators are enumerated (eq, neq, gt, lt, gte, lte)
- [x] Data sources are enumerated with connection details
- [x] RabbitMQ payload structure matches existing consumer contract

## Consistency

- [x] Backend follows ms-logs-api patterns (static class methods, Express Router, Mongoose)
- [x] Frontend follows existing UI patterns (Tailwind, TanStack Query, Lucide icons)
- [x] API response format follows existing pattern (`{ success, data, error }`)
- [x] New section follows sidebar pattern (admin-only, with icon and color)

## Security

- [x] PostgreSQL queries execute in read-only mode
- [x] Alert management restricted to admin users
- [x] PG credentials from environment variables, not hardcoded
- [x] RabbitMQ credentials from environment variables

## Edge Cases

- [x] Query execution timeout (30s max per rule)
- [x] Failed query handling (increment counter, don't disable)
- [x] RabbitMQ connection failure (log error, continue evaluation)
- [x] Invalid query syntax (catch and report in execution history)
- [x] Cooldown prevents duplicate notifications
- [x] Server restart restores all cron jobs
- [x] AlertExecution TTL auto-cleanup (30 days)
