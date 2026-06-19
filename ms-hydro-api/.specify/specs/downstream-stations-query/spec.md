# Feature: Downstream Stations Query — ms-hydro-api

**Status**: Draft
**Created**: 2026-06-19
**Last Updated**: 2026-06-19
**Umbrella spec**: `.specify/specs/manual-simulation-flow/spec.md`

---

## Overview

Adds a network-analysis query endpoint to ms-hydro-api that, given a list of origin station codes, returns the distinct set of stations and reservoirs located downstream. The underlying data comes from a materialized view (`mv_estaciones_aguas_abajo`) maintained by the GIS team.

---

## User Scenarios

### US1: Get Downstream Stations from a List of Origins [P1]

**As a** system (or operator)
**I want** to provide a list of origin station codes and receive all downstream stations and reservoirs
**So that** I can determine which measurement points are affected by events at the origin stations

**Acceptance Criteria:**
- Given a non-empty list of origin station codes
- When the query endpoint is called
- Then the system returns a list of distinct downstream destinations, each with its code, name, and type (station or reservoir)

**Edge Cases:**
- One or more codes in the input list are unknown → they are silently ignored; the result reflects only known origins
- All input codes are unknown → returns an empty list (not an error)
- Empty input list → rejected with a 400 validation error
- Very large input list (> 100 codes) → [NEEDS CLARIFICATION]

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | The endpoint must accept a list of one or more origin station codes | P1 |
| FR-002 | The endpoint must return distinct downstream destinations (no duplicates) | P1 |
| FR-003 | Each result item must include: destination code, destination name, destination type | P1 |
| FR-004 | An empty input list must be rejected with a validation error | P1 |
| FR-005 | Unknown origin codes must be silently excluded (not cause an error) | P1 |
| FR-006 | The endpoint must be read-only and cacheable | P2 |

---

## Success Criteria

- [ ] Given a known origin code, the endpoint returns at least the expected downstream destinations
- [ ] Given all unknown codes, the endpoint returns an empty list with status 200
- [ ] Given an empty list, the endpoint returns 400
- [ ] No duplicate entries appear in the response for the same query

---

## Assumptions

- The materialized view `mv_estaciones_aguas_abajo` exists in the GIS database with columns `codigo_origen`, `codigo_destino`, `nombre_destino`, `tipo_destino`
- The GIS database is accessible from ms-hydro-api (same infrastructure network)
- The view is kept up to date by the GIS team; this service does not refresh it

---

## Out of Scope

- Upstream direction queries
- Refreshing or managing the `mv_estaciones_aguas_abajo` materialized view
- Multi-hop downstream traversal beyond what the view already provides
