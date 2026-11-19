# DataScope Technical Decision Records

These records document decisions visible in the current source code. They are **retrospective records**, written from the implementation and existing project notes; they do not prove when a choice was made, who made it, or that the listed alternatives were formally evaluated at the time. “Alternatives considered” means plausible approaches for the same problem, not technologies that are present in DataScope.

## TDR-001: Next.js App Router for the frontend

- **Status:** Implemented
- **Context:** DataScope needs public entry pages and a multi-page authenticated workspace for datasets, records, analytics, and administration.
- **Decision:** Use Next.js App Router with file-based routes under `datascope-frontend/app/`. A root layout wraps pages in the Redux provider and shared navigation. The pages and interactive features use React client components.
- **Alternatives considered:** A single-page React app with a separate router; another React framework; server-rendered pages without a client-side application shell. These alternatives are not implemented in this project.
- **Advantages:** Route structure maps directly to page files; shared layout and navigation are centralized; the frontend can use Next.js build and deployment tooling.
- **Disadvantages and trade-offs:** Most interactive workspace behavior is client-side, including session-aware page handling. Protected pages are not protected by Next.js middleware; API authorization remains the data security boundary. This also means page code may be delivered before the client redirects.
- **Consequences for the project:** Routes include `/login`, `/register`, `/app`, dataset management/detail/explore/record pages, `/app/analytics`, and `/app/admin`. `NEXT_PUBLIC_API_URL` is used by browser-side clients and is public configuration, not a place for secrets.

## TDR-002: Express.js as the backend API framework

- **Status:** Implemented
- **Context:** The application needs an HTTP API for identity, datasets, fields, records, saved views, search history, analytics, exports, and administration.
- **Decision:** Use Node.js ES modules with Express 5. `src/server.js` validates startup configuration, connects the database and starts the server. `src/express-app.js` configures CORS, mounts Better Auth handlers and feature routers, and adds not-found and error handlers. Route modules perform validation and data access directly.
- **Alternatives considered:** Next.js route handlers, another Node HTTP framework, or a separate controller/service architecture. None of these alternatives is implemented as the DataScope API layer.
- **Advantages:** A dedicated API process separates backend authorization and database work from browser UI code. Express routers organize endpoints by feature and work with Better Auth's Node handler.
- **Disadvantages and trade-offs:** Route handlers contain substantial validation and business logic; no separate controller/service layer is present in the inspected structure. The API deployment and CORS/cookie configuration must be coordinated with the frontend origin.
- **Consequences for the project:** Application routes live under `/api`; protected routers use authentication and permission middleware. CORS allows the configured origin as well as the current deployed frontend and localhost origins.

## TDR-003: MongoDB and Mongoose for data storage

- **Status:** Implemented; differs from the PostgreSQL/Drizzle requirement
- **Context:** DataScope stores datasets whose record fields can vary by dataset, alongside metadata and access information.
- **Decision:** Use MongoDB with Mongoose models and connect to the `datascope` database. Records store a flexible `data` object (`Mixed`), while `DatasetField` documents describe allowed searchable/filterable/sortable fields. The native MongoDB driver is also used for Better Auth and selected admin operations.
- **Alternatives considered:** PostgreSQL with Drizzle, which the supplied requirement specifies; a relational schema with dataset-specific values; or MongoDB with a separate search service. These are alternatives only: the current implementation does not use PostgreSQL or Drizzle and does not include a separate search service.
- **Advantages:** Flexible record documents fit datasets with varying fields. Mongoose schemas still define core metadata, indexes, and ObjectId references. Keeping MongoDB also aligns the application store with the Better Auth Mongo adapter already in use.
- **Disadvantages and trade-offs:** This does not satisfy the PostgreSQL/Drizzle requirement. `Mixed` record payloads mean the application must enforce field type and query rules using metadata. Mongoose `ref` values do not create MongoDB foreign-key constraints; referential consistency and cleanup are application responsibilities.
- **Consequences for the project:** Collections include `datasets`, `datasetFields`, `records`, `datasetPermissions`, `savedViews`, and `searchHistory`, among others. A migration to PostgreSQL/Drizzle would require redesigning the persistence model, auth adapter, indexes, queries, and migration/data-transfer process; it is not a small configuration change.

## TDR-004: Better Auth for authentication and sessions

- **Status:** Implemented
- **Context:** The frontend needs signup/sign-in, and API requests need a server-verifiable user identity without trusting client-provided roles.
- **Decision:** Use Better Auth with its MongoDB adapter, email/password enabled, Google provider configured, and HTTP-only session cookies. Express validates the session with `auth.api.getSession()` in `requireAuthentication`. The backend adds computed permissions to user responses and omits the session token from returned response objects.
- **Alternatives considered:** A custom authentication implementation, browser-stored bearer tokens, or another authentication framework. These alternatives are not implemented. Google OAuth is configured on the backend, but the current frontend auth form exposes email/password only.
- **Advantages:** The browser does not need to read or store the session token in local storage. Express obtains identity from the validated session. Better Auth handles account/session persistence through its MongoDB adapter.
- **Disadvantages and trade-offs:** Cookie deployments require coordinated CORS, trusted-origin, and cookie attributes. Production cookies are configured `secure` and `sameSite: none`; non-production uses `sameSite: lax`. Exact auth route schemas are dependency-managed rather than implemented in DataScope route files.
- **Consequences for the project:** Auth handlers are mounted below `/api/auth/*`; application requests use `credentials: "include"`. Public registration permits Viewer or Data Analyst, while Administrator is assigned by a one-time initializer. Google sign-in UI and full dependency-generated auth API documentation remain absent/unverified.

## TDR-005: Redux Toolkit for shared client state

- **Status:** Partially implemented
- **Context:** Some client-owned information, such as safe signed-in user details and UI or selection state, may need to be shared across pages/components.
- **Decision:** Create a Redux store with Redux Toolkit in `store/make-store.js` and provide it through `StoreProvider`. Register five slices: `authentication`, `dataset`, `searchConfiguration`, `savedViews`, and `uiPreferences`.
- **Alternatives considered:** Keep all state local to components; use React Context; use Redux without Redux Toolkit. These approaches are not used as the central state framework in this project.
- **Advantages:** A consistent store and reducer setup exists for cross-component client state. Redux Toolkit provides the configured store and slice helpers. Authentication state contains safe display details rather than credentials.
- **Disadvantages and trade-offs:** Several registered slices are scaffolding or have limited usage. The Explorer keeps its drafts in component state and applied search state in the URL; it does not use the search/saved-view Redux slices as its active state source. UI preferences are not persisted through a backend API.
- **Consequences for the project:** `authentication` is actively synchronized by navigation and cleared at sign-out/session loss. The `dataset`, `searchConfiguration`, `savedViews`, and `uiPreferences` slices exist in the reducer but are not all consumed by current screens. Large API result data belongs to RTK Query's cache rather than ordinary client-state slices.

## TDR-006: RTK Query for API fetching and client caching

- **Status:** Implemented
- **Context:** Frontend pages need consistent API calls, loading/error state, reuse of fetched results, and refresh after mutations without manually coordinating every request.
- **Decision:** Define endpoints in `store/services/data-scope-api.js` using RTK Query and `fetchBaseQuery`, with `credentials: "include"`. Generated hooks are used throughout pages and components. Queries provide tags and mutations invalidate tags.
- **Alternatives considered:** Hand-written `fetch` calls in each component, Redux thunks, or another request/cache library. They are not the configured application API mechanism.
- **Advantages:** Endpoint hooks expose request status and response data. Query arguments identify cache entries; mutations can invalidate tags and cause active queries to refetch. Authenticated requests include the session cookie.
- **Disadvantages and trade-offs:** Cache freshness depends on correct endpoint arguments and tags. This is a frontend cache, not a server-side response cache. Some invalidation relationships are coarse or incomplete: for example, field mutations invalidate field/dataset tags but do not directly invalidate the records query tag.
- **Consequences for the project:** API calls are centralized and tags cover datasets, records, fields, permissions, views, history, analytics, admin users, and current user. The `/api/me` query polls every 30 seconds while relevant session consumers are active and refreshes on focus; ordinary records queries do not use periodic polling.

## TDR-007: URL parameters for applied Explorer search state

- **Status:** Implemented
- **Context:** Users need to refresh, bookmark, share, and navigate backward/forward through a dataset search without losing the applied query and page.
- **Decision:** Store applied Explorer state in URL parameters: `q`, `qMode`, `filters`, repeated `sort`, `page`, and `pageSize`. Keep incomplete drafts and temporary controls in React component state. Query hooks derive their arguments from the URL-backed state.
- **Alternatives considered:** Keep all search state only in component state; store applied search state only in Redux; use a server-side saved-query ID for every search. Those alternatives are not the current Explorer flow.
- **Advantages:** The browser address/history records applied state; refresh and record-detail return navigation can preserve the search. API arguments follow the URL state.
- **Disadvantages and trade-offs:** Filters need JSON serialization and parsing; invalid URL state must be handled. Complex filters can make long URLs. Search text updates the URL after a 350 ms debounce, and applying filters resets page position.
- **Consequences for the project:** Search is shareable as a URL but is not automatically a permission grant. Backend validation still checks every query. Saved views are separately persisted records and are not a replacement for URL state.

## TDR-008: MongoDB regex and text-index search modes

- **Status:** Implemented
- **Context:** DataScope needs substring/exact text matching and token search over dataset records without downloading records to the browser.
- **Decision:** Use escaped case-insensitive regex for partial and exact modes, and MongoDB `$text` for text mode using the text index declared on `DatasetRecord`. Searchable/filterable/sortable field metadata constrains the query. Exact and text modes require `dataset:search:advanced`.
- **Alternatives considered:** PostgreSQL full-text/trigram search or an external search engine such as Elasticsearch/OpenSearch. They are not implemented. The broader requirements named PostgreSQL/Drizzle, but this search path is MongoDB-specific.
- **Advantages:** Search stays within the existing database and does not require deploying a separate search service. Escaping regex metacharacters prevents user input from changing the intended regex structure. The text-index path supports MongoDB token search.
- **Disadvantages and trade-offs:** Broad regex substring queries may be expensive and are not guaranteed to use an index. MongoDB text search has different behavior and capabilities from PostgreSQL FTS/trigrams; typo-tolerant or relevance-tuned search is not implemented. Text mode requires all indexed fields to be marked searchable for the dataset.
- **Consequences for the project:** The indexed paths are `companyName`, `industry`, `country`, `category`, and `contact.email`; the route validates field metadata names including `contact`. Changing databases or search technology would require changing both index and query logic. Performance benchmarks are not checked in, so production-scale performance is unverified.

## TDR-009: Page-number offset pagination

- **Status:** Implemented
- **Context:** The Explorer needs page navigation, total page counts, and bounded browser/API payloads.
- **Decision:** Accept page number and page size, count matching records, compute `(page - 1) * pageSize`, then query with MongoDB `sort`, `skip`, and `limit`. The backend caps page size at 100; the frontend offers 10, 25, 50, and 100.
- **Alternatives considered:** Cursor/keyset pagination, infinite scrolling, or fetching all records. These alternatives are not implemented for the records endpoint.
- **Advantages:** Supports direct page selection and total-page calculations using straightforward request parameters. The frontend receives only the current page.
- **Disadvantages and trade-offs:** Deep offsets require MongoDB to skip preceding matches and can become slower. Concurrent inserts/deletes may shift page boundaries. The count query adds work to return totals.
- **Consequences for the project:** The response includes `page`, `pageSize`, `totalMatchingRecords`, and `totalPages`. Cursor pagination may be preferable if measured data volume or deep-page latency becomes a problem; no benchmark evidence currently establishes a specific threshold.

## TDR-010: Role permissions plus per-dataset grants

- **Status:** Implemented
- **Context:** Global roles alone cannot express which datasets a non-administrator may read or export. Frontend-only checks would not protect API data.
- **Decision:** Enforce a backend role permission matrix in middleware and check stored per-dataset `read`/`export` grants in dataset operations. Administrators have implicit access to all datasets. The frontend uses backend-supplied permissions only to tailor visible UI; it is not an authorization boundary.
- **Alternatives considered:** Frontend-only role checks; client-supplied role claims; role-only access to every dataset; or a separate policy service. None is the current authorization architecture.
- **Advantages:** The server derives identity from Better Auth, checks role capability, then checks dataset-specific access. Read and export can be granted separately. Grant revocation affects the next backend check because there is no grant cache in the inspected request path.
- **Disadvantages and trade-offs:** Dataset-specific permission lookups add database work. Permission checks are repeated across route handlers and must stay consistent. User IDs in grant documents are strings, so matching user documents requires application-level ID handling rather than a Mongoose foreign-key constraint.
- **Consequences for the project:** Roles are Viewer, Data Analyst, and Administrator. Administrator assignment is handled by bootstrap; admin UI can change users only between Viewer and Data Analyst. New ordinary users may receive read grants for existing demo datasets, but export remains separate. UI gating improves usability but every protected API endpoint must continue enforcing server-side checks.

## TDR-011: Bounded native table instead of row virtualization

- **Status:** Partially implemented
- **Context:** Large datasets could overwhelm the browser if all records were loaded and rendered at once.
- **Decision:** Use backend pagination capped at 100 records per request and render the returned page in a native table. The Explorer supports column visibility/resizing, selection, and sorting but does not virtualize rows.
- **Alternatives considered:** Virtualized rows, infinite scrolling, or full client-side loading. None is implemented for the current table.
- **Advantages:** Bounded page size limits the number of rendered rows and supports conventional page controls and record selection.
- **Disadvantages and trade-offs:** Users move between pages rather than viewing a continuous table. The current table may still need virtualization if row complexity or allowed page size grows. Offset-pagination costs remain separate from browser rendering costs.
- **Consequences for the project:** Do not describe the Explorer as virtualized. A future virtualization change should be justified by UI measurements and preserve accessible table behavior.

## TDR-012: Synchronous capped CSV export

- **Status:** Partially implemented
- **Context:** Analysts need downloadable subsets of records while exports are separately permission-controlled and kept to a bounded size.
- **Decision:** Generate CSV synchronously in the API request, supporting selected rows or filtered results, and reject exports above 5,000 rows. The frontend handles the response as a Blob and starts a browser download. CSV cells are quoted and formula-leading values are prefixed.
- **Alternatives considered:** Stream records to the client, create background export jobs, or write files to object storage and expose a job/status endpoint. These alternatives are not implemented.
- **Advantages:** The workflow is direct and enforces the export grant. The row cap bounds the response and guards against spreadsheet formula injection.
- **Disadvantages and trade-offs:** The server builds the CSV response synchronously and the browser buffers a Blob. Large exports are unavailable; request duration and memory can grow up to the cap. There is no queue, resumability, or export status endpoint.
- **Consequences for the project:** CSV export is suitable only for bounded selections/results. Requirements for streaming or background exports remain unmet and would require new API and storage/lifecycle design.

## Requirement alignment note

The current implementation uses MongoDB and Mongoose. It does **not** use the PostgreSQL and Drizzle stack named by the broader project requirement. Likewise, MongoDB regex/text search is not PostgreSQL full-text/trigram search, and the current implementation does not provide cursor pagination, row virtualization, or background CSV export. These records document the implementation and its trade-offs; they do not assert that unmet requirements have been satisfied.
