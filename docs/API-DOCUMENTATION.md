# DataScope API Documentation

This reference was checked against the Express route handlers, Better Auth configuration, Mongoose models, and the frontend RTK Query definitions. The API uses JSON for ordinary requests/responses and returns CSV for the CSV export route. Backend base URL is configured by `BETTER_AUTH_URL`; the frontend's API base URL is configured by `NEXT_PUBLIC_API_URL`.

## Endpoint summary

`{datasetId}`, `{fieldId}`, `{recordId}`, `{viewId}`, and `{userId}` are MongoDB ObjectId values serialized as 24-character hexadecimal strings unless otherwise stated.

| Method | Path | Authentication | Required permission | Purpose |
|---|---|---|---|---|
| GET | `/` | Public | None | Root service/database status |
| GET | `/api/health` | Public | None | Health status |
| POST | `/api/auth/sign-up/email` | Public | None | Register with email/password |
| POST | `/api/auth/sign-in/email` | Public | None | Sign in with email/password |
| POST | `/api/auth/sign-out` | Session as applicable | None | End current Better Auth session |
| GET | `/api/auth/get-session` | Public/session optional | None | Read current Better Auth session |
| GET | `/api/me` | Session cookie | Authenticated | Current user and computed permissions |
| GET | `/api/datasets` | Session cookie | `dataset:read` | List readable datasets |
| POST | `/api/datasets` | Session cookie | `dataset:manage` | Create dataset |
| GET | `/api/datasets/{datasetId}` | Session cookie | `dataset:read` | Read dataset metadata |
| PATCH | `/api/datasets/{datasetId}` | Session cookie | `dataset:manage` | Update dataset metadata |
| DELETE | `/api/datasets/{datasetId}` | Session cookie | `dataset:manage` | Delete dataset and related application documents |
| GET | `/api/datasets/{datasetId}/fields` | Session cookie | `dataset:read` | List dataset field definitions |
| POST | `/api/datasets/{datasetId}/fields` | Session cookie | `dataset:manage` | Add field definition |
| PATCH | `/api/datasets/{datasetId}/fields/{fieldId}` | Session cookie | `dataset:manage` | Update field definition |
| DELETE | `/api/datasets/{datasetId}/fields/{fieldId}` | Session cookie | `dataset:manage` | Delete field definition |
| GET | `/api/datasets/{datasetId}/records` | Session cookie | `dataset:records:read` plus dataset read grant | Search/list a page of records |
| GET | `/api/datasets/{datasetId}/records/{recordId}` | Session cookie | `dataset:records:read` plus dataset read grant | Read one record |
| GET | `/api/datasets/{datasetId}/export` | Session cookie | `dataset:export` plus dataset export grant | JSON export, first 1,000 records |
| POST | `/api/datasets/{datasetId}/export/csv` | Session cookie | `dataset:export` plus dataset export grant | Export selected or filtered records as CSV |
| GET | `/api/saved-views` | Session cookie | Authenticated; dataset read access if scoped | List own/shared saved views |
| POST | `/api/saved-views` | Session cookie | `view:manage:personal` plus dataset read | Create saved view |
| PATCH | `/api/saved-views/{viewId}` | Session cookie | `view:manage:personal`; owner only | Update saved view |
| DELETE | `/api/saved-views/{viewId}` | Session cookie | `view:manage:personal`; owner only | Delete saved view |
| GET | `/api/search-history` | Session cookie | Authenticated; dataset read access if scoped | Read current user's recent searches |
| POST | `/api/search-history` | Session cookie | Authenticated plus dataset read | Record a search configuration |
| GET | `/api/analytics` | Session cookie | `dataset:analyze` | Dataset-scoped analytics |
| GET | `/api/admin/users` | Session cookie | `user:manage` | List users |
| PATCH | `/api/admin/users/{userId}/role` | Session cookie | `user:manage` | Set Viewer/Data Analyst role |
| GET | `/api/admin/analytics` | Session cookie | `analytics:admin` | System-wide user/dataset/record counts |
| GET | `/api/admin/system-config` | Session cookie | `system:manage` | Read application name and role names |
| GET | `/api/admin/datasets/{datasetId}/permissions` | Session cookie | `dataset:permissions:manage` | List grants for a dataset |
| PUT | `/api/admin/datasets/{datasetId}/permissions/{userId}` | Session cookie | `dataset:permissions:manage` | Set a user's dataset grants |
| DELETE | `/api/admin/datasets/{datasetId}/permissions/{userId}` | Session cookie | `dataset:permissions:manage` | Revoke a user's dataset grant |

Better Auth itself is mounted on `app.all('/api/auth', ...)` and `app.all('/api/auth/*splat', ...)`. Only the four common email/session paths above are included as concrete operations; see [Better Auth route boundary](#better-auth-route-boundary).

## Authentication and authorization

### Better Auth session cookies

Better Auth is configured with the MongoDB adapter and email/password enabled. Google OAuth is configured on the backend when its client credentials are supplied. The auth routes are mounted under `/api/auth/*`. Session cookies are HTTP-only; in production they are secure and use `sameSite: none`, and in non-production they use `sameSite: lax`. The custom session token field is not returned in response bodies, and an auth response hook removes `token` values from returned objects.

The frontend Better Auth client and RTK Query `fetchBaseQuery` both set `credentials: "include"`. The browser therefore sends the cookie to the backend. For protected application routes, `requireAuthentication` calls `auth.api.getSession()` with request headers. If there is no session, it returns `401`; otherwise it attaches the authenticated `userId`, role, and user to `req.auth`.

### Role permissions and dataset grants

The backend role matrix is authoritative:

| Role | Main capabilities |
|---|---|
| `viewer` | Read granted datasets/records, basic search, one filter, use shared views |
| `dataAnalyst` | Viewer capabilities plus advanced search, multiple filters, personal saved views, export, analytics |
| `administrator` | All application permissions and implicit access to all datasets |

For non-administrators, dataset read and export are separate `DatasetAccessPermission` grants: `read` permits browsing that dataset; `export` additionally permits exports. A protected route checks the role permission and, when dataset-scoped, the dataset grant. Administrators bypass per-dataset grants. A grant change applies to subsequent backend access checks; there is no server-side grant cache in the inspected route logic.

New Viewer and Data Analyst accounts receive read grants for configured demo dataset slugs when those datasets exist. This does not grant export. Signup accepts `requestedRole` only as `viewer` or `dataAnalyst`; all other values become Viewer. The Administrator role is assigned through the first-admin initialization script, not an API endpoint. Admin role editing can only set Viewer or Data Analyst.

### Common error shapes

The source uses several endpoint-specific error bodies, usually `{ "error": "...", "message": "..." }`. `requireAuthentication` returns `401 {"error":"Unauthorized"}`. Permission middleware returns `403 {"error":"Forbidden","message":"You do not have permission to perform this action."}`. The shared error handler returns JSON with `error` and `message`; unexpected failures use status `500` and a generic message. Unknown routes return `404` with the missing method/path. The precise errors listed in endpoint sections are the explicit handler branches; database/network failures may also reach the shared `500` handler.

## System and identity endpoints

### `GET /`

Public. Reports whether the database connection topology is connected.

- **Success:** `200` when connected, otherwise `503`.
- **Response:** `{ "status": "ok" | "error", "service": "datascope-api", "database": "connected" | "disconnected" }`.

Example:

```json
{"status":"ok","service":"datascope-api","database":"connected"}
```

### `GET /api/health`

Public. Reports Mongoose connection ready state.

- **Success:** `200` when connected, `503` otherwise.
- **Response:** `{ "status": "ok" | "unavailable", "service": "datascope-api", "database": "connected" | "disconnected" }`.

### Better Auth common endpoints

These are Better Auth handler routes, not Express application route implementations. Request/response schemas and all status codes are determined by the installed Better Auth version; where the repository does not define them, they are marked **unverified**.

#### `POST /api/auth/sign-up/email`

Public. Email/password registration. Request fields used by the frontend are `name`, `email`, `password`, and optional `requestedRole` (`viewer` or `dataAnalyst`; other values are coerced to Viewer). Better Auth-specific validation fields, full response schema, and error statuses: **unverified from repository source**. On success Better Auth creates a session cookie and the backend grants read access to existing demo datasets.

Example request:

```json
{"name":"Ada Lovelace","email":"ada@example.com","password":"example-password","requestedRole":"dataAnalyst"}
```

#### `POST /api/auth/sign-in/email`

Public. Email/password sign-in. Frontend sends `{ "email": "...", "password": "..." }`. Full Better Auth response/error schema: **unverified from repository source**. Successful authentication establishes a session cookie.

#### `POST /api/auth/sign-out`

Ends the current Better Auth session. Request and response details/status codes are Better Auth-managed and **unverified beyond the endpoint path and frontend call**.

#### `GET /api/auth/get-session`

Reads the current Better Auth session. Exact response schema/status behavior is Better Auth-managed and **unverified beyond the endpoint path**.

Google OAuth provider support is configured, but exact Better Auth OAuth endpoint operations and provider callback responses are dependency-generated and not enumerated in the OpenAPI file. They are **unverified from repository route source**.

### `GET /api/me`

Authentication: session cookie. Requires a valid session; no additional named role permission.

- **Success:** `200`.
- **Response:** `{ user: { id, name, email, role, permissions } }`.
- **Error:** `401` without a valid session; `500` for unexpected errors.

Example:

```json
{"user":{"id":"65f000000000000000000001","name":"Ada Lovelace","email":"ada@example.com","role":"dataAnalyst","permissions":["dataset:read","dataset:records:read","dataset:search:basic","dataset:search:advanced","dataset:filters:basic","dataset:filters:multiple","view:manage:personal","view:access:shared","dataset:export","dataset:analyze"]}}
```

## Dataset and field endpoints

For all non-admin dataset reads, the user must have a `read` grant on the dataset. Dataset-management endpoints require `dataset:manage` (Administrator in the current role matrix).

### `GET /api/datasets`

Lists datasets readable by the caller; administrators get all datasets. No query parameters.

- **Success:** `200 { "datasets": Dataset[] }`.
- Each dataset has `id`, `name`, `description`, `slug`, `category`, `dataSource: {name,type,description}`, `totalRecords`, `creatorId`, `createdAt`, `updatedAt`.
- **Errors:** `401`, `403`, `500`.

### `POST /api/datasets`

Requires `dataset:manage`. Body allows exactly `name`, `slug`, optional `description`, `category`, and `dataSource: {name,type,description?}`. Required: name (2–160 chars), lowercase hyphenated slug (up to 180 chars), category, source name and type. Unknown body keys are rejected.

- **Success:** `201 { "dataset": Dataset }`, newly created with `creatorId` from the session and record count zero.
- **Errors:** `400` invalid body/model validation; `401`; `403`; `409` duplicate slug; `500` unexpected.

Example request:

```json
{"name":"Customer Directory","slug":"customer-directory","description":"Customer accounts","category":"Sales","dataSource":{"name":"CRM","type":"database","description":"Imported CRM records"}}
```

Example success:

```json
{"dataset":{"id":"65f000000000000000000010","name":"Customer Directory","description":"Customer accounts","slug":"customer-directory","category":"Sales","dataSource":{"name":"CRM","type":"database","description":"Imported CRM records"},"totalRecords":0,"creatorId":"65f000000000000000000001","createdAt":"2026-11-19T10:00:00.000Z","updatedAt":"2026-11-19T10:00:00.000Z"}}
```

### `GET /api/datasets/{datasetId}`

Requires `dataset:read` and dataset read grant (except administrator). No query/body.

- **Success:** `200 { "dataset": Dataset, "canManage": boolean }` (`canManage` is true only for administrator).
- **Errors:** `400` invalid ID; `401`; `403` no dataset grant; `404` missing dataset; `500` unexpected.

### `PATCH /api/datasets/{datasetId}`

Requires `dataset:manage`. Body may contain one or more of `name`, `slug`, `description`, `category`, `dataSource`; no unknown keys. Validation uses the same field constraints as creation, except fields are optional.

- **Success:** `200 { "dataset": Dataset }`.
- **Errors:** `400` invalid ID/body/model validation; `401`; `403`; `404`; `409` duplicate slug; `500` unexpected.

### `DELETE /api/datasets/{datasetId}`

Requires `dataset:manage`. Deletes dataset documents, fields, permissions, records, saved views, search history, and any record-history/relationship documents with that dataset ID.

- **Success:** `204` empty body.
- **Errors:** `400` invalid ID; `401`; `403`; `404`; `500` unexpected.

### Field definition endpoints

Field shape: `{ id, datasetId, name, label, dataType, searchable, filterable, sortable, visibleByDefault, createdAt, updatedAt }`. Supported `dataType`: `string`, `number`, `date`, `boolean`, `email`, `phone`, `currency`, `object`. Field names start with a letter and contain letters, numbers, or underscores (max 80 chars); labels max 80 chars.

| Method and path | Auth/permission | Request | Success | Explicit errors |
|---|---|---|---|---|
| `GET /api/datasets/{datasetId}/fields` | Session; `dataset:read` plus read grant | No query/body | `200 {fields: Field[]}` | `400` invalid dataset ID; `401`; `403`; `404` dataset missing/no access; `500` |
| `POST /api/datasets/{datasetId}/fields` | Session; `dataset:manage` | Required `name`, `label`, `dataType`; optional boolean `searchable`, `filterable`, `sortable`, `visibleByDefault` | `201 {field: Field}` | `400` invalid ID/body/model; `401`; `403`; `404` dataset missing; `409` duplicate field name; `500` |
| `PATCH /api/datasets/{datasetId}/fields/{fieldId}` | Session; `dataset:manage` | Any nonempty subset of field properties above | `200 {field: Field}` | `400` invalid ID/body/model; `401`; `403`; `404` field missing; `409` duplicate field name; `500` |
| `DELETE /api/datasets/{datasetId}/fields/{fieldId}` | Session; `dataset:manage` | No body | `204` empty | `400` invalid IDs; `401`; `403`; `404` field missing; `500` |

## Record search and retrieval

### `GET /api/datasets/{datasetId}/records`

Requires session, `dataset:records:read`, and dataset `read` grant (Administrator bypasses dataset grants).

Query parameters (unknown keys are rejected):

| Parameter | Meaning and validation |
|---|---|
| `page` | Positive integer, default `1`, maximum `1,000,000`. |
| `pageSize` | Positive integer, default `25`, maximum `100`. |
| `sort` | Repeatable up to 3 distinct `field:asc`/`field:desc` values. Each field must be marked sortable. Default is creation time descending plus `_id` tiebreaker. |
| `fields` | Comma-separated, 1–40 distinct defined field names. If omitted, return fields marked `visibleByDefault`. |
| `q` | Search text up to 100 characters. Searches configured searchable text fields. |
| `qMode` | `partial` (default), `exact`, or `text`; requires `q`. Exact/text require `dataset:search:advanced`. |
| `filters` | JSON array of 1–10 conditions, AND-combined. More than one condition requires `dataset:filters:multiple`. Each field must be filterable. |

Search modes are implemented with escaped case-insensitive regex for partial/exact and MongoDB `$text` for text mode. Text mode requires the dataset to define all text-index fields as searchable: `companyName`, `industry`, `country`, `category`, and `contact` (the index itself includes `contact.email`).

Filter body-in-query shape: `{ "field": "status", "operator": "equals", "value": "active" }`; `between` also uses `valueTo`. Operators depend on field type:

- Text/email/phone: `equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`.
- Number/currency: `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `between`.
- Date: `before`, `after`, `between`.
- Boolean: `isTrue`, `isFalse`.

- **Success:** `200` with `{ dataset, records, page, pageSize, totalMatchingRecords, totalPages, sort, fields, search }`. Each record has `{id,datasetId,createdAt,updatedAt,data}`; `data` contains selected fields.
- **Errors:** `400` invalid ID, pagination, keys, fields, sort, filters, search mode, missing searchable fields, or malformed conditions; `401` unauthenticated; `403` missing role permission/read grant; `404` dataset not found; `500` unexpected.

Example request:

```http
GET /api/datasets/65f000000000000000000010/records?page=2&pageSize=25&sort=revenue:desc&q=acme&qMode=partial&filters=%5B%7B%22field%22%3A%22status%22%2C%22operator%22%3A%22equals%22%2C%22value%22%3A%22active%22%7D%5D
```

Example response:

```json
{"dataset":{"id":"65f000000000000000000010","name":"Customer Directory","slug":"customer-directory","category":"Sales","totalRecords":4300},"records":[{"id":"65f000000000000000000200","datasetId":"65f000000000000000000010","createdAt":"2026-10-03T12:00:00.000Z","updatedAt":"2026-10-05T12:00:00.000Z","data":{"companyName":"Acme Ltd","status":"active","revenue":90000}}],"page":2,"pageSize":25,"totalMatchingRecords":31,"totalPages":2,"sort":["revenue:desc"],"fields":["companyName","status","revenue"],"search":"acme"}
```

The actual `dataset` object is serialized with dataset metadata; included fields can vary with serialization context. The example omits optional fields for readability.

### `GET /api/datasets/{datasetId}/records/{recordId}`

Requires session, `dataset:records:read`, and dataset read grant. No query/body.

- **Success:** `200 { "record": { id, datasetId, createdAt, updatedAt, data } }`; `data` includes declared dataset fields.
- **Errors:** `400` invalid dataset/record ID; `401`; `403` no role permission/read grant; `404` record absent from that dataset or dataset missing; `500` unexpected.

## Export endpoints

Both require `dataset:export`, a session, dataset read access, and for non-admins an `export` grant on that dataset.

### `GET /api/datasets/{datasetId}/export`

No query or body. Returns the first at most 1,000 records (no ordering guarantee is specified by the handler).

- **Success:** `200 { "dataset": Dataset, "records": [...] }`; records are Mongoose documents spread into response objects with an added string `id`. Exact internal document fields are not separately normalized by this endpoint.
- **Errors:** `400` invalid ID; `401`; `403` missing role/read/export permission; `404` dataset missing; `500` unexpected.

### `POST /api/datasets/{datasetId}/export/csv`

JSON body allows only `mode`, `recordIds`, `fields`, `filters`, `q`, `qMode`.

- `mode: "selected"`: requires 1–5,000 distinct valid record ID strings in `recordIds`.
- `mode: "filtered"`: requires nonempty `q` and/or 0–10 `filters`; accepts optional `qMode` (`partial`, `exact`, `text`). Search and multiple-filter permissions apply as for records. `fields` is required: 1–40 distinct names defined for the dataset.
- **Success:** `200` with `text/csv; charset=utf-8`, attachment filename `<dataset-slug>-export.csv`, and `Cache-Control: no-store`. The first CSV row uses field labels. Cells are quoted/escaped and formula-leading values are prefixed with `'`.
- **Errors:** `400` invalid mode/body/fields/IDs/filters, no matched records, or selected IDs outside dataset; `401`; `403` role/read/export/search/filter permission; `404` dataset missing; `413` over 5,000 matches; `500` unexpected.

Example selected request:

```json
{"mode":"selected","recordIds":["65f000000000000000000200"],"fields":["companyName","status"]}
```

## Saved views and search history

All these routes require a valid session. A view/history record can only be read or written for datasets the caller can read; administrators bypass dataset grants. Sharing a view does not grant dataset access.

### `GET /api/saved-views?datasetId={datasetId}`

`datasetId` is optional. Returns at most 100 most recently updated views the caller owns or that are shared with them, filtered again to datasets they may read.

- **Success:** `200 { "views": SavedView[] }`. Each view: `id,datasetId,ownerId,name,description,query,searchMode,filters,sort,visibleFields,sharedWith,isShared,createdAt,updatedAt`.
- **Errors:** `400` invalid dataset ID; `401`; `403` no dataset read access; `404` dataset not found; `500`.

### `POST /api/saved-views`

Requires `view:manage:personal` and dataset read access. Body: required `datasetId`, `name`; optional `description`, `query`, `searchMode`, `filters`, `sort`, `visibleFields`, `sharedWith`. Name max 120, description max 500, query max 100; mode is `partial|exact|text`; up to 10 filters, 3 sort rules, 40 visible fields, 100 distinct recipients. Sort/filter/field permissions and recipient dataset access are validated.

- **Success:** `201 { "view": SavedView }`.
- **Errors:** `400` invalid body/configuration/recipient; `401`; `403` role, dataset, advanced-search, or multiple-filter restriction; `404` missing dataset; `500`.

Example request:

```json
{"datasetId":"65f000000000000000000010","name":"Active Acme accounts","description":"Active matching accounts","query":"Acme","searchMode":"partial","filters":[{"field":"status","operator":"equals","value":"active"}],"sort":["revenue:desc"],"visibleFields":["companyName","status","revenue"],"sharedWith":[]}
```

### `PATCH /api/saved-views/{viewId}`

Requires `view:manage:personal`; owner only. Body is a nonempty subset of saved-view properties except `datasetId`. Same validation limits as create; configuration is merged with stored values.

- **Success:** `200 { "view": SavedView }`.
- **Errors:** `400` invalid ID/body/config/recipient; `401`; `403` insufficient role, not owner, no dataset access, or forbidden search/filter mode; `404` missing view/dataset; `500`.

### `DELETE /api/saved-views/{viewId}`

Requires `view:manage:personal`; owner only, and dataset read access remains required.

- **Success:** `204` empty body.
- **Errors:** `400` invalid view ID; `401`; `403` role/owner/dataset denial; `404` missing view/dataset; `500`.

### `GET /api/search-history?datasetId={datasetId}`

`datasetId` optional. Returns up to 50 most recent entries belonging to the current user, filtering out entries for datasets they can no longer read.

- **Success:** `200 { "history": [{id,datasetId,query,searchMode,filters,sort,description,resultCount,searchedAt}] }`.
- **Errors:** `400` invalid dataset ID; `401`; `403` scoped dataset access denied; `404` missing scoped dataset; `500`.

### `POST /api/search-history`

Body allows `datasetId` and optional `query`, `searchMode`, `filters`, `sort`. Query/mode/filter/sort validation is the same general configuration validation used for saved views. At least a query or one filter is required. The server stores `resultCount: 0` rather than calculating/populating the actual result count. It retains the latest 200 records per user.

- **Success:** `201 { "history": {id,datasetId,query,searchMode,filters,sort,description,resultCount,searchedAt} }`.
- **Errors:** `400` unsupported keys, invalid ID/configuration, empty search; `401`; `403` no dataset access or prohibited search/filter mode; `404` dataset missing; `500`.

## Analytics endpoints

### `GET /api/analytics`

Requires session and `dataset:analyze`. Results are scoped to datasets readable by the caller; administrators see all datasets. No query/body.

- **Success:** `200 { totalRecords, recordsByCategory, recordsByStatus, dataGrowth, searchActivity, frequentFilters }`.
- `recordsByCategory`: `{category,count}[]`; `recordsByStatus`: `{status,count}[]`; `dataGrowth`: `{month,count}[]` (up to 24 grouped months); `searchActivity`: `{date,count}[]` (up to 30 dates); `frequentFilters`: `{field,operator,count}[]` (top 10).
- **Errors:** `401`; `403`; `500`.

Example:

```json
{"totalRecords":100000,"recordsByCategory":[{"category":"Enterprise","count":25000}],"recordsByStatus":[{"status":"active","count":50000}],"dataGrowth":[{"month":"2026-10","count":3200}],"searchActivity":[{"date":"2026-11-18","count":42}],"frequentFilters":[{"field":"status","operator":"equals","count":17}]}
```

## Administration endpoints

All `/api/admin` routes first require a valid session; each route then checks the listed permission. Under the current matrix these capabilities are Administrator-only.

### `GET /api/admin/users`

Requires `user:manage`. No query/body.

- **Success:** `200 { "users": [{id,name,email,role,createdAt}] }`; missing stored role is presented as `viewer`.
- **Errors:** `401`, `403`, `500`.

### `PATCH /api/admin/users/{userId}/role`

Requires `user:manage`. Body exactly `{ "role": "viewer" | "dataAnalyst" }`. Cannot modify an Administrator using this endpoint.

- **Success:** `200 { "userId": "...", "role": "viewer" | "dataAnalyst" }`.
- **Errors:** `400` invalid ObjectId or role; `401`; `403`; `404` user missing; `409` target is an Administrator; `500`.

### `GET /api/admin/analytics`

Requires `analytics:admin`. No query/body.

- **Success:** `200 { "users": number, "datasets": number, "records": number }`.
- **Errors:** `401`, `403`, `500`.

### `GET /api/admin/system-config`

Requires `system:manage`. This endpoint is read-only.

- **Success:** `200 { "application": "DataScope", "roles": ["administrator","dataAnalyst","viewer"] }` (role ordering follows the permission object).
- **Errors:** `401`, `403`.

### `GET /api/admin/datasets/{datasetId}/permissions`

Requires `dataset:permissions:manage`.

- **Success:** `200 { "permissions": [{userId,name,email,role,permissions,grantedBy,updatedAt}] }`.
- **Errors:** `400` invalid dataset ID; `401`; `403`; `404` dataset missing; `500`.

### `PUT /api/admin/datasets/{datasetId}/permissions/{userId}`

Requires `dataset:permissions:manage`. Body exactly `{ "permissions": ["read"] }`, `["export"]`, or `["read","export"]`; nonempty unique values only. Both IDs must be valid ObjectIds and both resources must exist. The stored grant user ID is a string.

- **Success:** `200 { "datasetId": "...", "userId": "...", "permissions": [...] }`.
- **Errors:** `400` invalid IDs/body/permissions; `401`; `403`; `404` dataset or user missing; `500`.

### `DELETE /api/admin/datasets/{datasetId}/permissions/{userId}`

Requires `dataset:permissions:manage`. Deletes the matching grant; absence of a matching grant is still treated as successful deletion.

- **Success:** `204` empty body.
- **Errors:** `400` invalid IDs; `401`; `403`; `500`.

## Missing, partial, and unverified API surface

- **No record create/update/delete endpoints** are registered. Dataset records are read, searched, exported, and deleted as part of whole-dataset deletion; the requirements for ordinary record CRUD are not implemented as API routes.
- **No route exists** for the `RecordHistory`, `RecordRelationship`, or `UserPreference` models. Those models are initialized, and dataset deletion cleans history/relationship documents, but no API reads/writes them.
- `/api/admin/system-config` is read-only. There is no settings update endpoint.
- Search history persists `resultCount: 0` at write time; it is not populated with the actual query result count by the route.
- CSV is synchronous, buffered, and capped at 5,000 matching rows. The JSON export endpoint returns at most 1,000 records.
- Analytics are implemented as database aggregates for records and recorded searches, not operational metrics such as query latency/cache hit rate.
- Better Auth routes are catch-all delegated to the installed dependency. Exact complete auth/OAuth endpoint schemas and status codes are **unverified from application source**. The OpenAPI file includes only the common paths confirmed by the repository's auth usage/documentation and avoids asserting unknown response schemas.
- Error status codes are documented from explicit route branches. Driver-level errors can reach the shared `500` handler; exhaustive database-specific failure codes are not knowable from route source.

## Related API client

The frontend's `store/services/data-scope-api.js` defines RTK Query endpoints for the listed dataset, records, field, CSV, saved-view, history, analytics, admin, and `/api/me` operations. It sets `credentials: "include"`, uses query hooks for reads and mutation hooks for writes, and uses cache tags. This client definition is not a separate backend endpoint inventory; the Express registrations above are authoritative.
