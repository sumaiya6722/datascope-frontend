# DataScope architecture decisions

These decisions describe the implementation that exists today and its trade-offs.

## 1. MongoDB and Mongoose

- **Problem:** Store flexible, field-defined business records and related access metadata.
- **Alternatives:** PostgreSQL/Drizzle as specified, MongoDB/Mongoose, or a relational core with a search service.
- **Selected:** Keep MongoDB/Mongoose, per the user's explicit instruction.
- **Reason and advantages:** This preserves the current data, Better Auth adapter, schemas, and API without a risky database migration. Flexible `data` documents fit changing dataset fields.
- **Costs and limits:** It does not satisfy the PostgreSQL/Drizzle requirement. Flexible fields make type consistency and indexing harder; the application validates values against field metadata. A separate migration project would be needed to meet the original SQL requirement.

## 2. Better Auth with HTTP-only cookies

- **Problem:** Authenticate users and maintain server-verified sessions.
- **Alternatives:** NextAuth, JWTs in browser storage, or a custom password/session implementation.
- **Selected:** Better Auth backed by MongoDB with HTTP-only cookies and credentialed requests.
- **Reason and advantages:** It avoids a second auth system and keeps session tokens out of browser JavaScript. Express derives identity from the validated session.
- **Costs and limits:** Cross-site deployment needs careful cookie/site configuration. Current production deployment guidance recommends a same-site frontend/API or a frontend proxy.

## 3. Server-owned roles plus dataset grants

- **Problem:** Enforce global capabilities and per-dataset visibility/export.
- **Alternatives:** Frontend-only role checks, roles embedded in requests, or role checks plus stored dataset grants.
- **Selected:** Backend role permissions plus per-user `read`/`export` grants; Administrator is the only role with implicit all-dataset access.
- **Reason and advantages:** Requests cannot supply their own identity or role, and export is checked independently from read. A grant lookup on each operation makes revocation effective on the next request.
- **Costs and limits:** Each protected data request may add a permission query. A carefully invalidated server-side grant cache could reduce this later.

## 4. RTK Query for server state

- **Problem:** Fetch pages and metadata without keeping large record sets in Redux.
- **Alternatives:** Redux thunks, ad hoc `fetch`, or another query/cache library.
- **Selected:** RTK Query with credentialed `fetchBaseQuery`, argument-keyed cache entries, tags, and endpoint hooks.
- **Reason and advantages:** It deduplicates matching in-flight requests, exposes loading/error states, and refetches active data after tag invalidation.
- **Costs and limits:** Cache correctness depends on accurate tags and query arguments. Current-user polling adds a small periodic request while the app is open.

## 5. Page-number offset pagination

- **Problem:** Let users jump to pages while retrieving only a bounded subset.
- **Alternatives:** Offset pagination, cursor/keyset pagination, or loading all rows.
- **Selected:** Page number with MongoDB `skip` and `limit`, capped to 100 rows per API request.
- **Reason and advantages:** It supports page counts, direct page navigation, and preserves the current URL-driven controls with simple API semantics.
- **Costs and limits:** Deep `skip` becomes slower as offsets grow and concurrent inserts can shift page boundaries. Cursor pagination should be considered for much larger or fast-changing collections.

## 6. MongoDB text index and validated regex search

- **Problem:** Support token search plus exact and substring modes over configured fields.
- **Alternatives:** PostgreSQL full-text search, PostgreSQL trigram indexes, MongoDB text indexes, or Elasticsearch/OpenSearch.
- **Selected:** Existing MongoDB text index for token search and escaped, case-insensitive regex for exact/partial modes; all filter fields/operators are checked against `DatasetField` metadata.
- **Reason and advantages:** It avoids introducing another service and fits the current database. Queries stay server-side and are combined with dataset ID and validated filters.
- **Costs and limits:** Regex substring queries are not guaranteed to use indexes and can become expensive. MongoDB text behavior is not equivalent to PostgreSQL FTS/trigrams. A dedicated search engine or a different database search strategy may be needed at higher scale or for typo tolerance.

## 7. URL state for applied searches

- **Problem:** Keep search, filters, sorting, and page in browser history and shareable links.
- **Alternatives:** Component-only state, Redux-only state, or URL state for applied parameters with local drafts.
- **Selected:** URL parameters for applied Explorer state; local state for drafts; Redux slices for small cross-screen client preferences.
- **Reason and advantages:** Refresh, back/forward, and record-detail return navigation preserve the search context. Large result sets are never placed in the URL or global slices.
- **Costs and limits:** Query parameters require validation and serialization. Very complex search configurations may exceed comfortable URL length and could move to opaque saved-query IDs.

## 8. Bounded pages instead of row virtualization

- **Problem:** Keep table rendering and browser memory bounded.
- **Alternatives:** Virtualized rows, infinite scrolling, or server-paginated pages.
- **Selected:** Server pagination with page sizes up to 100 and a native table.
- **Reason and advantages:** Bounded rows keep rendering simple and support predictable selection, page navigation, and accessibility.
- **Costs and limits:** Virtualization may be warranted if page size or row complexity grows. The current implementation does not claim virtualized rendering.

## 9. MongoDB aggregation for analytics

- **Problem:** Calculate totals and distributions without sending all records to the browser.
- **Alternatives:** Client-side full scans, maintained summary tables, or database aggregation.
- **Selected:** MongoDB aggregation pipelines for totals, categories, statuses, growth, search activity, and frequent filters.
- **Reason and advantages:** The browser receives compact summaries, not record collections.
- **Costs and limits:** Repeated aggregations may be expensive on very large/high-write collections; materialized summaries and scheduled refreshes may be needed after measurement.

## 10. Bounded synchronous CSV export

- **Problem:** Export selected or filtered data while enforcing separate export grants.
- **Alternatives:** Unbounded in-memory CSV, streamed response, or background export jobs.
- **Selected:** Synchronous export capped at 5,000 records, with field validation and CSV formula escaping.
- **Reason and advantages:** It limits current memory and response size and guards against spreadsheet formula injection.
- **Costs and limits:** It does not meet the requested large-export/background-job target. The frontend buffers a Blob. Streaming to object storage with a job/status/notification flow remains future work.
