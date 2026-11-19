# DataScope Performance Testing Plan

## Purpose and current evidence

This document describes how to evaluate DataScope performance using its current implementation. It is a test plan, not a report of benchmark results.

**Current evidence from the repository:** the backend contains a deterministic demo-data seeder that creates 100,000 records by default and accepts up to 1,000,000 records. Record listing is server-paginated with a maximum page size of 100. Dataset records have MongoDB indexes for dataset/time, several common business fields, a seed key, and MongoDB text search. Analytics use MongoDB aggregation pipelines. These are implementation facts; they do not establish measured response times or production capacity.

The requirements audit reports that the demo seed was not run against an application database, and no live API benchmark, browser performance test, or production-data measurement was performed in that audit. **There are no verified benchmark results or service-level targets in this repository.** All thresholds below are proposed acceptance targets to agree on before a formal test; they are not achieved results.

## System components under test

- **Frontend:** Next.js/React Data Explorer; RTK Query provides browser-side API result caching. Native table rendering is bounded by backend page size, but there is no row virtualization.
- **API:** Node.js/Express routes, Better Auth session validation, role checks, dataset grant lookups, and request validation.
- **Database:** MongoDB queried through Mongoose. The record route loads dataset field definitions, counts matching records, then fetches a projected page using sort, `skip`, and `limit`.
- **Seed data:** `datascope-backend/src/scripts/seed-demo-data.js` creates deterministic synthetic business-directory records. It uses batched upserts and can seed from 1 through 1,000,000 records; default is 100,000, default batch size is 2,000, maximum batch size is 10,000.

## What to measure

For each API scenario, record:

- Request rate (requests/second) and completed request count.
- Latency p50, p90, p95, and p99; report mean only as supplemental information.
- HTTP status distribution and error/timeout rate.
- Response payload size and records returned.
- Backend process CPU and resident memory.
- MongoDB CPU, memory, disk I/O, connection count, and query execution statistics where available.
- For the browser run: navigation-to-interactive timing, records-response duration, table render duration, and browser memory.

Record the exact app commit, Node version, package versions, MongoDB version/configuration, OS/container, CPU/RAM, data count, index state, and network location. Keep API and database on documented, stable hosts for a run. Do not compare results from different environments as if they were a controlled comparison.

## Dataset preparation

1. Use a dedicated non-production MongoDB database. Never point benchmark setup at a production database.
2. Create or use a test user with a known role and the appropriate dataset read/export grant.
3. Seed `business-directory` using the backend CLI. For repeatable scale runs, use a fresh benchmark database or explicitly record existing rows, because the seed is idempotent and fills missing rows rather than clearing data.

```powershell
cd datascope-backend
npm run seed:demo -- --creator-email <registered-admin-email> --size 100000 --batch 2000
```

Repeat at 10,000, 100,000, and 1,000,000 records where available and practical. Record actual document count after seeding; do not assume the CLI inserted the requested number if the database already contained rows. The seed command upserts records but does not delete unrelated records.

## API benchmark scenarios

Run each scenario first with one client to establish a baseline, then with progressively higher concurrency. Suggested concurrency steps are **1, 5, 10, and 25** clients; these are proposed test settings, not a statement about supported production concurrency. Apply a short warm-up, a measured period, and a cooldown between cases. Use the same request set for each dataset size.

| ID | Endpoint / workload | What it evaluates |
|---|---|---|
| P1 | `GET /api/health` | API and database connection health overhead; not a substitute for data-query tests. |
| P2 | `GET /api/datasets` | Dataset/grant listing and record-count aggregation. |
| P3 | `GET /api/datasets/{id}/records?page=1&pageSize=25` | Baseline first-page query, count query, projection, and response serialization. |
| P4 | Same record route at page sizes 10, 50, and 100 | Impact of returned row count and payload size. |
| P5 | Partial search on representative `companyName`, `industry`, or `country` values | Regex substring search behavior. Include both common and rare terms. |
| P6 | Exact search and MongoDB text search with valid role/dataset configuration | Advanced regex and `$text` paths. Keep result selectivity and query terms recorded. |
| P7 | One filter and multiple filters, including numeric/date ranges | Filter query construction, match count, and role-dependent multi-filter checks. |
| P8 | One sort and three sort rules on configured sortable fields | Sort performance at varied selectivity and page sizes. |
| P9 | Medium and deep pages (for example page 1, 100, 1,000 where valid) | Offset/`skip` cost. Confirm page range has matching data for meaningful results. |
| P10 | `GET /api/datasets/{id}/records/{recordId}` | Point lookup for a known record and field metadata projection. |
| P11 | `GET /api/analytics` | Three aggregation workloads for record distributions/growth, search activity, and frequent filters. |
| P12 | CSV export: selected rows and filtered result sets at increasing sizes up to 5,000 | Synchronous query, CSV generation, transfer size, and server/client memory. Do not exceed the cap except for a single negative check that expects 413. |

For authenticated endpoints, use a dedicated benchmark account and valid Better Auth cookie. Do not log session cookies or credentials. Avoid running sign-in on every data request unless authentication throughput itself is the explicit test objective; otherwise authenticate before the measured run and reuse the test session within its valid lifetime.

## Frontend/browser scenarios

Use a production build served in a controlled environment for browser measurements; development mode includes tooling overhead and is not representative. Suggested manual workflow:

1. Open the Explorer for the seeded dataset and record initial load behavior.
2. Repeat with page sizes 10, 25, 50, and 100.
3. Try partial/exact/text search and a small filter set, and record URL, request, response, and render timings.
4. Navigate between pages and return from a record detail page to verify the Explorer state is restored.
5. Repeat the same request once with RTK Query data available to observe client cache reuse. Keep the backend timing separate from the browser cache-hit timing.
6. Measure selected and filtered CSV download behavior up to 5,000 rows.

There is no configured browser automation/performance suite in the frontend package scripts. Browser timing in this plan is therefore manual or requires adding separate test tooling in a later, explicitly scoped change.

## Proposed acceptance thresholds

The following are starting points for discussion, not current guarantees. Approve or revise them based on hosting tier, expected users, and real data before declaring pass/fail.

| Measure | Proposed initial target |
|---|---:|
| First-page records API, 100k rows, page size 25, warm database, concurrency 1 | p95 ≤ 500 ms |
| Records API under proposed normal load (10 concurrent clients), page size ≤ 100 | p95 ≤ 1,000 ms |
| Unexpected 5xx/timeout ratio during normal-load run | < 1% |
| Records payload for page size ≤ 100 | ≤ 1 MiB, unless representative field payload requires a documented exception |
| Browser rendering for a returned page of 100 representative rows | p95 ≤ 500 ms after response completion |
| CSV export of 5,000 representative records | Complete without 5xx or process restart; record duration and peak memory for a separately agreed target |

Do not apply these thresholds to the database seeding command or cold-start runs. Cold and warm measurements should be reported separately.

## How to interpret results

- Compare latency by data size, concurrency, query mode, filter selectivity, page size, and depth. A single aggregate average hides the cases likely to degrade.
- The records route executes `countDocuments()` and the page query separately. Record these as a combined endpoint measurement; use MongoDB profiler/explain tooling in an isolated environment if query-level attribution is needed.
- Regex substring search may scan many documents. MongoDB text-index performance is a separate path and should not be presented as evidence that regex search is indexed.
- Increasing `skip` can raise deep-page query cost. Compare page 1 and deep pages at equivalent data/selectivity.
- RTK Query cache reuse is client-side. Report a cache hit as a browser interaction result, not as a faster Express/MongoDB response.
- Analytics aggregation runtime can depend on accumulated `SearchHistory` size as well as record count.
- CSV export is synchronous, buffered, and capped at 5,000 rows. Large-export behavior beyond that cap is not an implemented workload.
- The UI uses a native table and does not virtualize rows. Assess browser render time separately from API/database time.

## Results record template

Copy this section for every formal run and fill it with measured values. Leave values as `Not measured` until the run has actually happened.

| Field | Value |
|---|---|
| Run date/time and operator | Not measured |
| Commit/revision | Not measured |
| Environment and hardware | Not measured |
| Node/MongoDB versions | Not measured |
| Dataset size and index state | Not measured |
| Scenario and request parameters | Not measured |
| Duration, warm-up, concurrency | Not measured |
| Throughput | Not measured |
| p50 / p90 / p95 / p99 | Not measured |
| HTTP errors/timeouts | Not measured |
| CPU / memory / MongoDB metrics | Not measured |
| Result and follow-up | Not measured |

## Current status

Performance testing is **not yet evidenced** in the repository. Existing implementation choices (seed script, indexes, bounded pages, and aggregations) provide workloads and mechanisms to evaluate, but no benchmark result, production measurement, or performance pass/fail conclusion is currently recorded.
