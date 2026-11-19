# DataScope Search Architecture

```mermaid
flowchart TD
  subgraph FE[Frontend: Data Explorer]
    User[User enters a search term<br/>or edits filter conditions]
    Drafts[React component state<br/>draftSearch, draftSearchMode,<br/>draftFilters]
    Debounce[Search input waits 350 ms<br/>then trims term]
    ApplyFilters[Apply filters button<br/>checks draft completeness]
    AppliedURL[Applied search in URL<br/>q, qMode, filters, sort,<br/>page, pageSize]
    ReadURL[Explorer parses URL state<br/>defaults qMode to partial,<br/>page to 1 and pageSize to default]
    UseQuery[useGetDatasetRecordsQuery<br/>passes dataset, URL settings,<br/>and requested fields]
    RTK[RTK Query builds GET request<br/>to /api/datasets/:id/records]
    Results[Hook provides response data]
    Display[Data Explorer displays rows,<br/>match total, page number,<br/>sort controls and pagination]
    UIError[Explorer displays query errors<br/>and loading/fetching states]
    User --> Drafts
    Drafts --> Debounce --> AppliedURL
    Drafts --> ApplyFilters --> AppliedURL
    AppliedURL --> ReadURL --> UseQuery --> RTK
    Results --> Display
    RTK -. loading / error state .-> UIError
  end

  subgraph BE[Backend: Express records route]
    Receive[Receive GET request]
    Session[requireAuthentication<br/>validate Better Auth session cookie]
    Role[requirePermission(dataset:records:read)]
    DatasetAccess[Check dataset exists and user has read grant<br/>Administrator bypasses dataset grant]
    ParamCheck[Validate dataset ID, page and pageSize<br/>allowed query keys and bounds]
    LoadFields[Load DatasetField definitions<br/>for this dataset]
    SearchInput{Search term present?}
    Mode{qMode}
    CheckAdvanced[Require dataset:search:advanced<br/>for exact or text modes]
    Partial[Partial mode:<br/>searchable text fields;<br/>escape regex punctuation;<br/>case-insensitive regex, unanchored]
    Exact[Exact mode:<br/>searchable text fields;<br/>escape regex punctuation;<br/>case-insensitive regex ^term$]
    Text[Text mode:<br/>MongoDB $text: {$search: term};<br/>all indexed fields must be searchable]
    TextIndex[Configured text index fields:<br/>companyName, industry, country,<br/>category, contact.email]
    FilterInput{Filters supplied?}
    FilterCheck[Validate 1–10 conditions;<br/>each field must be filterable;<br/>validate operator/value for data type]
    MultiCheck{More than one filter?}
    MultiDenied[Require dataset:filters:multiple<br/>otherwise 403]
    Combine[Combine filter conditions with AND<br/>and combine with dataset/search criteria]
    SortCheck[Validate up to 3 distinct sort rules;<br/>each field must be sortable;<br/>default createdAt descending]
    PageCalc[Compute skip = (page - 1) × pageSize<br/>pageSize max 100]
    Count[Count matching records]
    Find[Find matching page with projection;<br/>sort, skip, limit(pageSize)]
    Shape[Shape response with records,<br/>page, pageSize, totalMatchingRecords,<br/>totalPages, sort, fields, search]
    BadRequest[Invalid inputs return 400<br/>permission failures return 403<br/>missing session 401 / dataset 404]
    UserError[Return error response]

    Receive --> Session
    Session -->|valid| Role
    Session -->|invalid| BadRequest
    Role -->|allowed| DatasetAccess
    Role -->|denied| BadRequest
    DatasetAccess -->|allowed| ParamCheck
    DatasetAccess -->|denied or missing| BadRequest
    ParamCheck -->|valid| LoadFields
    ParamCheck -->|invalid| BadRequest
    LoadFields --> SearchInput
    SearchInput -->|yes| Mode
    SearchInput -->|no| FilterInput
    Mode -->|partial| Partial --> FilterInput
    Mode -->|exact| CheckAdvanced
    Mode -->|text| CheckAdvanced
    CheckAdvanced -->|allowed| ModeSearchBranch{Requested advanced mode}
    CheckAdvanced -->|denied| BadRequest
    ModeSearchBranch -->|exact| Exact
    ModeSearchBranch -->|text and fields valid| Text
    Text -. requires configured fields .-> TextIndex
    ModeSearchBranch -->|text fields missing| BadRequest
    Exact --> FilterInput
    Text --> FilterInput
    FilterInput -->|yes| FilterCheck
    FilterInput -->|no| SortCheck
    FilterCheck -->|valid| MultiCheck
    FilterCheck -->|invalid| BadRequest
    MultiCheck -->|one filter| Combine
    MultiCheck -->|multiple allowed| Combine
    MultiCheck -->|multiple denied| MultiDenied --> BadRequest
    Combine --> SortCheck
    SortCheck -->|valid| PageCalc
    SortCheck -->|invalid| BadRequest
    PageCalc --> Count --> Find --> Shape
    BadRequest --> UserError
  end

  subgraph DB[Database: MongoDB accessed through Mongoose]
    FieldCollection[(datasetFields collection<br/>DatasetField model)]
    RecordCollection[(records collection<br/>DatasetRecord model)]
    TextIndex[(MongoDB text index<br/>companyName, industry, country,<br/>category, contact.email)]
    Found[Matching record documents]
    LoadFields --> FieldCollection
    FieldCollection --> LoadFields
    Partial --> RecordCollection
    Exact --> RecordCollection
    Text --> RecordCollection
    Text -. uses .-> TextIndex
    FilterCheck --> RecordCollection
    SortCheck --> RecordCollection
    Count --> RecordCollection
    Find --> RecordCollection
    RecordCollection --> Found --> Shape
  end

  RTK --> Receive
  Shape -->|HTTP 200 JSON| Results
  UserError -->|HTTP error| UIError
```

## Beginner-friendly explanation

### 1. Drafting and applying a search

The search input and unfinished filter rows live in React component state. Typing updates the draft text immediately, then waits 350 milliseconds before trimming it and writing it to the URL. Filters are written to the URL when the user clicks **Apply search**; the component checks that required values are present first. Changing search/filter/sort settings resets the page parameter so results start from page one.

The applied state is in URL parameters: `q` is the term, `qMode` is the mode, `filters` is serialized JSON, repeated `sort` values hold sort rules, and `page`/`pageSize` choose the result page. The Explorer parses those values and passes them to `useGetDatasetRecordsQuery`. If no mode is supplied, the backend defaults to partial; the frontend also interprets unsupported modes as partial.

### 2. Permissions and field metadata

The backend validates the Better Auth session and requires the `dataset:records:read` role permission. It then checks the dataset exists and, for non-administrators, checks the user's dataset `read` grant. It loads that dataset's field definitions to ensure search, filters, requested output fields, and sorting conform to the dataset's configuration.

Fields have separate `searchable`, `filterable`, and `sortable` flags. The frontend uses these flags to construct controls; the backend checks them again and is the enforcement point. Exact and text search require `dataset:search:advanced`. More than one filter requires `dataset:filters:multiple`. Viewers can use basic/partial search and one filter under the backend's role matrix.

### 3. Search mode branches

- **Partial:** The backend escapes regex punctuation in the term and builds case-insensitive, unanchored regular-expression conditions across searchable text fields. A match in any of those fields qualifies.
- **Exact:** It uses the same escaping and case-insensitive regex, with `^` and `$` anchors so the whole field value must match. This is an advanced-search mode.
- **MongoDB text:** It uses MongoDB's `$text` query. The dataset must mark each indexed text field as searchable. The configured index covers `companyName`, `industry`, `country`, `category`, and `contact.email` (the field-metadata check uses the `contact` field name).

The MongoDB text-index branch is the implemented text search. PostgreSQL full-text search, trigram search, and Elasticsearch are not part of this code path.

### 4. Filters and sorting

Filters must be a JSON array of 1–10 conditions. Each condition targets a declared field marked filterable, and the backend validates the operator and value according to that field's type. The backend converts each condition into MongoDB query syntax and combines filter conditions with AND. When a text/regex search is also present, the search criteria are included with those conditions.

Sorting accepts up to three distinct `field:asc` or `field:desc` rules, and every field must be marked sortable. Without explicit sorting, the backend sorts by creation time descending, with an ID tiebreaker.

### 5. Pagination and returned results

The backend counts all documents matching the combined dataset, search, and filter criteria so it can return `totalMatchingRecords` and `totalPages`. It calculates an offset from the page number, then asks MongoDB for only that page using `skip` and `limit`. The API rejects a page size above 100. The Explorer offers page sizes of 10, 25, 50, and 100.

The response includes the current records and pagination metadata. RTK Query exposes it to the component, which renders the visible columns, matching-record count, and previous/next controls.

## Search limitations and boundaries

- Regex partial/exact queries can be expensive on broad datasets; the code escapes user input but does not provide a dedicated substring-search index.
- MongoDB text search is limited by its configured index and the requirement that all indexed fields be searchable for a dataset.
- Page-number pagination uses `skip`; deep offsets can become slower as data grows. It is not cursor/keyset pagination.
- The backend enforces at most 10 filter conditions, at most 3 sort rules, a 100-character search term, and page sizes up to 100.
- The code defines per-dataset searchability/filterability/sortability metadata; it does not support arbitrary unbounded field search.
