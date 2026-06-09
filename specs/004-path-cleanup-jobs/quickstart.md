# Quickstart: Scheduled Path Cleanup Jobs

**Feature**: 004-path-cleanup-jobs
**Date**: 2026-03-09

Integration scenarios for manual validation and smoke testing.

---

## Prerequisites

```bash
docker compose up   # Start API + Postgres + Redis
# Frontend: npm run dev (in frontend/)
# Ensure at least one SFTP user or mapping schema exists so paths appear in the panel
```

---

## Scenario 1: Create a Cleanup Job and Verify It Appears in the Panel

**Goal**: Verify that a new cleanup job is persisted, scheduled, and visible in the Paths & Files panel.

```bash
# Step 1: Create a cleanup job for an existing path
curl -X POST http://localhost:3000/api/cleanup-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "directoryPath": "/data/files/forecast",
    "extensions": [".xml", ".csv"],
    "frequency": "EVERY_DAY"
  }'

# Expected: 201 with job id, isActive: true, nextExecutionAt populated

# Step 2: Verify paths-overview includes the job
curl http://localhost:3000/api/files/paths-overview

# Expected: path entry for /data/files/forecast has cleanupJob field with:
# - isActive: true
# - frequency: "EVERY_DAY"
# - nextExecutionAt: tomorrow at midnight
```

**UI verification**: Open `http://localhost:5173/paths` → the `/data/files/forecast` row shows a clock icon with an "Active" badge and the next execution time.

---

## Scenario 2: Toggle a Cleanup Job Off and Back On

**Goal**: Verify toggle preserves configuration and recalculates next execution on re-activation.

```bash
# Step 1: Create a job (use ID from scenario 1 or create new)
JOB_ID="<uuid-from-create>"

# Step 2: Deactivate the job
curl -X PATCH http://localhost:3000/api/cleanup-jobs/$JOB_ID/toggle \
  -H "Content-Type: application/json" \
  -d '{ "isActive": false }'

# Expected: 200, isActive: false, nextExecutionAt: null

# Step 3: Verify paths-overview shows inactive
curl http://localhost:3000/api/files/paths-overview
# Expected: cleanupJob.isActive: false, nextExecutionAt: null

# Step 4: Re-activate
curl -X PATCH http://localhost:3000/api/cleanup-jobs/$JOB_ID/toggle \
  -H "Content-Type: application/json" \
  -d '{ "isActive": true }'

# Expected: 200, isActive: true, nextExecutionAt: recalculated from now
```

**UI verification**: Toggle the switch on the path row → badge changes to "Inactive" → toggle back → "Active" badge returns with new next-execution time.

---

## Scenario 3: Edit Frequency and Verify Schedule Updates

**Goal**: Verify that updating frequency reschedules the job and updates nextExecutionAt.

```bash
JOB_ID="<uuid>"

# Update frequency from EVERY_DAY to EVERY_HOUR
curl -X PATCH http://localhost:3000/api/cleanup-jobs/$JOB_ID \
  -H "Content-Type: application/json" \
  -d '{
    "frequency": "EVERY_HOUR",
    "extensions": [".xml", ".csv", ".dat"]
  }'

# Expected: 200, frequency: "EVERY_HOUR", extensions: [".xml", ".csv", ".dat"]
# nextExecutionAt: within the next hour
```

---

## Scenario 4: Duplicate Job Prevention

**Goal**: Verify that creating a second job for the same path is rejected.

```bash
# Create first job
curl -X POST http://localhost:3000/api/cleanup-jobs \
  -H "Content-Type: application/json" \
  -d '{"directoryPath":"/data/files/shared","extensions":[".xml"],"frequency":"EVERY_HOUR"}'

# Try to create a second job for the same path
curl -X POST http://localhost:3000/api/cleanup-jobs \
  -H "Content-Type: application/json" \
  -d '{"directoryPath":"/data/files/shared","extensions":[".csv"],"frequency":"EVERY_DAY"}'

# Expected: 409 Conflict
```

---

## Scenario 5: Delete a Cleanup Job

**Goal**: Verify job is removed from DB, unscheduled, and path row returns to neutral state.

```bash
JOB_ID="<uuid>"

curl -X DELETE http://localhost:3000/api/cleanup-jobs/$JOB_ID

# Expected: 200, { deletedId: "<uuid>" }

# Verify it's gone
curl http://localhost:3000/api/cleanup-jobs/$JOB_ID
# Expected: 404

# Verify paths-overview shows no cleanup job
curl http://localhost:3000/api/files/paths-overview
# Expected: cleanupJob: null for that path
```

**UI verification**: The path row clock icon returns to neutral (no badge).

---

## Scenario 6: Job Execution (Fast Test with Short Interval)

**Goal**: Verify that the cleanup job actually deletes matching files when it fires.

```bash
# Create some test files in the storage directory
mkdir -p /data/files/test-cleanup
echo "test" > /data/files/test-cleanup/file1.xml
echo "test" > /data/files/test-cleanup/file2.csv
echo "test" > /data/files/test-cleanup/keep.txt

# Create a cleanup job with 5-minute interval
curl -X POST http://localhost:3000/api/cleanup-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "directoryPath": "/data/files/test-cleanup",
    "extensions": [".xml", ".csv"],
    "frequency": "EVERY_5_MIN"
  }'

# Wait up to 5 minutes (or trigger via debug endpoint if available)
# Then verify:
ls /data/files/test-cleanup
# Expected: only keep.txt remains

# Check execution result via API
curl http://localhost:3000/api/cleanup-jobs/<id>
# Expected: lastExecutedAt populated, lastExecutionResult.filesDeleted: 2
```
