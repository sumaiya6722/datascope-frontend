# DataScope Data Fetching Flow

```mermaid
flowchart TD
  subgraph FE[Frontend: Next.js / React]
    Open[User opens Data Explorer]
    ReadURL[Read applied URL parameters<br/>q, qMode, filters, sort,<br/>page, pageSize]
    Hooks[DataExplorer calls RTK Query hooks<br/>including useGetDatasetRecordsQuery]
    QueryKey[Endpoint + serialized arguments<br/>identify this records query]
    CacheCheck{Matching RTK Query<br/>cache entry available?}
    Reuse[Reuse cached result<br/>no records request sent]
    Loading[Hook exposes loading/fetching state<br/>Explorer shows loading/updating message]
    Build[Build GET URL and query string<br/>page, pageSize, sort, fields,<br/>q, qMode, filters]
    Send[HTTP request with credentials: include<br/>GET /api/datasets/:datasetId/records]
    Receive[Receive JSON response]
    CacheStore[Store result in RTK Query cache<br/>provide DatasetRecords tag for dataset]
    Render[Render current page of rows<br/>and page/count controls]
    ClientError[Hook exposes request error<br/>Explorer shows records error message]
    Mutate[Related mutation succeeds<br/>e.g. dataset deletion or field change]
    Invalidate[Mutation invalidates configured tags]
    Refetch[If an invalidated query has an active subscriber,<br/>RTK Query refetches it]

    Open --> ReadURL --> Hooks --> QueryKey --> CacheCheck
    CacheCheck -->|Yes| Reuse --> Render
    CacheCheck -->|No| Loading --> Build --> Send
    Receive --> CacheStore --> Render
    Send -. request error .-> ClientError
    ClientError --> Render
    Mutate --> Invalidate --> Refetch --> Build
  end

  subgraph BE[Backend: Express]
    Route[Match dataset records route]
    Auth[requireAuthentication<br/>Better Auth validates session from request headers/cookie]
    AuthFail[No valid session: return 401]
    Role[requirePermission(dataset:records:read)<br/>check role capability]
    RoleFail[Role lacks capability: return 403]
    Grant[Check dataset read access<br/>Administrator bypasses per-dataset grant]
    GrantFail[No read grant: return 403<br/>missing dataset: 404]
    Validate[Validate dataset ID and query parameters<br/>page/pageSize, allowed keys, fields, sort,<br/>search mode, filters, field metadata]
    ValidationFail[Invalid parameter or filter: return 400<br/>disallowed search/filter capability: 403]
    Query[Build MongoDB filter and projection<br/>count matching rows; calculate skip]
    Limited[Fetch only requested fields and page<br/>sort → skip → limit (maximum pageSize 100)]
    Shape[Shape JSON response<br/>records, page, pageSize, total count/pages]
    HandleError[Route errors go to Express error handler<br/>JSON error response]
    CsvRoute[Match CSV export route<br/>POST /api/datasets/:datasetId/export/csv]
    CsvAuth[Validate session and dataset:export role permission]
    CsvGrant[Check dataset read and export grants<br/>Administrator bypasses grants]
    CsvValidate[Validate export mode, fields, IDs,<br/>filters/search and 5,000-row cap]
    CsvQuery[Query matching records and build CSV<br/>synchronously]
    Route --> Auth
    Auth -->|valid| Role
    Auth -->|invalid| AuthFail
    Role -->|allowed| Grant
    Role -->|denied| RoleFail
    Grant -->|allowed| Validate
    Grant -->|denied| GrantFail
    Validate -->|valid| Query
    Validate -->|invalid| ValidationFail
    Query --> Limited --> Shape
    Auth -. unexpected error .-> HandleError
    Validate -. unexpected error .-> HandleError
    Query -. database/route error .-> HandleError
    CsvRoute --> CsvAuth --> CsvGrant --> CsvValidate --> CsvQuery
  end

  subgraph DB[Database: MongoDB through Mongoose]
    Records[(records collection<br/>DatasetRecord model)]
    Fields[(datasetFields collection<br/>DatasetField model)]
    Results[Matching record documents]
    Fields -. field definitions read for validation .-> Validate
    Query --> Records
    Records --> Results --> Limited
  end

  Send --> Route
  Shape -->|HTTP 200 JSON| Receive
  AuthFail -->|HTTP error| ClientError
  RoleFail -->|HTTP error| ClientError
  GrantFail -->|HTTP error| ClientError
  ValidationFail -->|HTTP error| ClientError
  HandleError -->|HTTP error| ClientError

  subgraph CSV[Separate implemented CSV export branch]
    ExportAction[User selects rows or filtered results]
    ExportHook[useExportDatasetCsvMutation]
    ExportHTTP[POST /api/datasets/:datasetId/export/csv<br/>credentials included]
    ExportAuth[Backend CSV route checks session,<br/>dataset:export role permission and dataset grants]
    ExportDB[MongoDB query for selected or filtered rows]
    CSVResponse[CSV response up to 5,000 records<br/>larger request returns 413]
    Blob[RTK Query response handler returns Blob<br/>component starts browser download]
    ExportError[Mutation error state shown in Explorer]
    ExportAction --> ExportHook --> ExportHTTP --> CsvRoute
    CsvQuery --> ExportDB --> CSVResponse --> Blob
    ExportHTTP -. request failure .-> ExportError
  end
  CsvAuth -. unauthorized .-> ExportError
  CsvGrant -. forbidden .-> ExportError
  CsvValidate -. invalid or too large .-> ExportError
  ExportHTTP -. request error .-> ExportError
  ExportDB --> Records
```

## Beginner-friendly explanation

### Opening the Explorer and choosing the request

When the user opens the Data Explorer, the component reads applied settings from the address bar: search text and mode, filters, sort rules, page number, and page size. It passes those settings, plus the dataset ID and selected fields, to `useGetDatasetRecordsQuery`. The generated hook is defined by the RTK Query service in `store/services/data-scope-api.js`.

### Cache reuse and loading

RTK Query keys a query by its endpoint and argument values. If the same endpoint and arguments already have cached data, the hook can provide that result without sending another records request. If a request is needed, the hook reports loading/fetching state, which the Explorer displays while waiting. RTK Query manages the client-side result cache; the inspected backend does not add a separate server response cache or background refresh for record queries.

### Backend checks and database query

The frontend sends a credentialed `GET` request to `/api/datasets/:datasetId/records`. Express routes it to the records handler. The handler first validates the Better Auth session, then checks the role's `dataset:records:read` permission, then checks that the user has a read grant for that dataset (unless the user is an administrator).

After access checks, the handler validates the dataset ID and query parameters. It loads field definitions to validate requested fields and sorting, and to ensure filters/search use fields configured for those operations. It builds a MongoDB filter and projection, counts matching records, and calculates the offset from the page number. The record query sorts, skips the rows from earlier pages, and applies a limit. The API page size cannot exceed 100 records; the Explorer offers 10, 25, 50, or 100.

Mongoose queries MongoDB's `records` collection for the bounded page. The handler returns the rows with pagination metadata, including total matching records and total pages. It does not send the entire matching dataset to the browser.

### Response, display, and errors

On success, RTK Query stores the JSON result under the matching query key and provides a `DatasetRecords` tag for the dataset. The component receives the result from its hook and renders the rows and paging controls. Authentication, authorization, validation, and server failures return error responses; the query hook exposes the error, and the Explorer displays an error message. The backend's shared Express error handler formats unexpected route/database errors as JSON.

### Cache invalidation

RTK Query mutations declare tags they invalidate. For example, dataset deletion invalidates dataset and dataset-record tags; field create/update/delete operations invalidate dataset-field and dataset tags. When a mutation invalidates a tag used by an active query, RTK Query refetches that query. This is client cache invalidation and refetching, not a database or Express cache. Saved-view and search-history mutations invalidate their own respective tag types.

### CSV export branch

The Explorer uses `useExportDatasetCsvMutation` to send a `POST` to `/api/datasets/:datasetId/export/csv`, with either selected record IDs or the current filters/search. The backend applies the same session and permission checks, including the separate export capability and dataset export grant for non-administrators, validates input, queries MongoDB, and returns CSV. The export is synchronous and capped at 5,000 rows; requests over the cap receive HTTP 413. The frontend handles the response as a Blob and triggers a browser download. There is no background export job or streaming-to-storage workflow in the inspected implementation.

## Implementation boundaries

- **Implemented:** client-side RTK Query result caching, query arguments based on Explorer state, tag invalidation, active-query refetching, server-side validation, dataset access checks, bounded page retrieval, and CSV Blob download.
- **Not present in this flow:** server-side response cache, dedicated query-cache service, automatic periodic records polling, cursor pagination, background export jobs, or streamed/object-storage exports.
- **Partial behavior:** cache reuse depends on RTK Query's cache entry and subscription lifecycle; it is not permanent storage. Dataset record queries provide a dataset-level tag, while record-detail queries use a separate dataset/record tag. Field changes refetch field queries, but do not directly invalidate the records tag in the API service.
