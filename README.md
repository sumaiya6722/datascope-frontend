# DataScope Frontend

Web client for **DataScope**, a role-based data exploration platform. It provides sign-in and registration, a dataset library, a full-featured Data Explorer (search, filters, sorting, column control, saved views, CSV export), an analytics dashboard, and administration screens for managing users and dataset access.

Built with Next.js (App Router), React, Redux Toolkit / RTK Query, Tailwind CSS, and Recharts. It talks to the [DataScope backend](https://github.com/sumaiya6722/datascope-backend), which owns authentication and all authorization decisions.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Routes](#routes)
- [Roles and permissions](#roles-and-permissions)
- [The Data Explorer](#the-data-explorer)
- [State management and data fetching](#state-management-and-data-fetching)
- [Scripts](#scripts)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Known issues](#known-issues)

## Features

- **Authentication**: email/password sign-up and sign-in through the backend's Better Auth server, using cookie-based sessions.
- **Role-aware UI**: navigation, buttons, and pages adapt to the signed-in user's role (`viewer`, `dataAnalyst`, `administrator`).
- **Dataset library**: browse the datasets you are authorized to see; administrators can create, edit, and delete datasets.
- **Field management**: administrators define each dataset's fields and whether they are searchable, filterable, sortable, and visible by default.
- **Data Explorer**:
  - partial, exact, and MongoDB text search
  - up to 10 typed filter conditions (combined with AND)
  - single and multi-column sorting
  - column visibility and resizable columns
  - paginated results with a choice of page sizes
  - matching-term highlighting
  - search state kept in the URL, so views can be bookmarked and shared
- **Saved views**: save the current search, filters, sort, and columns; share views with other users; edit and delete your own.
- **Search history**: recent searches per dataset, re-applicable in one click.
- **CSV export**: export selected rows or all rows matching the current search and filters.
- **Record details**: a dedicated page for any single record.
- **Analytics dashboard**: totals, records by category and status, growth over time, search activity, and most-used filters.
- **Administration**: system-wide counts, user role management, and per-dataset read/export grants.
- **Backend health indicator** on the landing page.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19 |
| State and data fetching | Redux Toolkit (RTK) 2 with RTK Query, `react-redux` |
| Authentication client | Better Auth (`better-auth/react`) |
| Styling | Tailwind CSS 4 via `@tailwindcss/postcss` |
| Charts | Recharts 3 |
| Linting | ESLint 9 with the Next.js and React plugins |
| Tests | Node's built-in test runner |
| Runtime | Node.js **>= 22.13** (ES modules) |

## Project structure

```
datascope-frontend/
├── app/
│   ├── layout.js                      # Root layout: store provider + top navigation
│   ├── globals.css                    # Tailwind import and dark theme base styles
│   ├── page.js                        # Public landing page with backend health check
│   ├── login/page.js                  # Sign-in
│   ├── register/page.js               # Create account
│   └── app/                           # Authenticated area
│       ├── page.js                    # Workspace home
│       ├── analytics/page.js          # Analytics dashboard
│       ├── admin/page.js              # Administration
│       └── datasets/
│           ├── page.js                # Dataset library
│           ├── new/page.js            # Create dataset
│           └── [datasetId]/
│               ├── page.js            # Dataset details, fields, access grants
│               ├── edit/page.js       # Edit dataset details
│               ├── explore/page.js    # Data Explorer
│               └── records/[recordId]/page.js   # Single record view
├── components/
│   ├── auth-form.js                   # Shared sign-in / register form
│   ├── authenticated-navigation.js    # Header nav, session sync, sign-out
│   ├── dataset-form.js                # Create / edit dataset form
│   └── data-explorer.js               # Search, filter, sort, saved views, export
├── lib/
│   ├── auth-client.js                 # Better Auth client (cookies included)
│   └── permissions.js                 # Role -> permission matrix (mirrors the backend)
├── store/
│   ├── make-store.js                  # Redux store factory
│   ├── store-provider.js              # Client-side provider
│   ├── services/data-scope-api.js     # RTK Query API definition (all endpoints)
│   └── slices/                        # Redux slices
├── test/api.test.js                   # Unit tests
└── public/                            # Static assets
```

## Getting started

### Prerequisites

- Node.js **22.13 or newer**
- The [DataScope backend](https://github.com/sumaiya6722/datascope-backend) running and reachable (default `http://localhost:5000`)

### Installation

```bash
git clone https://github.com/sumaiya6722/datascope-frontend.git
cd datascope-frontend
npm install
```

### Configure the environment

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Run the app

Start the backend first, then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page shows a live indicator confirming whether the frontend can reach the API and its database.

### Make the two apps trust each other

The backend only accepts requests from one configured origin and sets session cookies for it. In the backend's `.env`, make sure:

```env
FRONTEND_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:5000
```

If the frontend runs on a different origin than `FRONTEND_URL`, sign-in and API calls will fail with CORS or cookie errors.

### Get an administrator account

The first administrator cannot be created from the UI. Register a normal account, then promote it from the backend project:

```bash
npm run initialize:first-admin -- --email you@example.com
```

Sign out and back in to see the Administration area.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Base URL of the DataScope backend, with no trailing slash, e.g. `http://localhost:5000`. It is exposed to the browser (the `NEXT_PUBLIC_` prefix), so never put secrets in it. |

It is read at **build time**, so after changing it you must restart `npm run dev` or rebuild with `npm run build`.

## Routes

| Path | Access | Description |
| --- | --- | --- |
| `/` | Public | Landing page with backend connection status |
| `/login` | Public | Sign in |
| `/register` | Public | Create an account, choosing Viewer or Data Analyst |
| `/app` | Signed in | Workspace home |
| `/app/datasets` | `dataset:read` | Dataset library |
| `/app/datasets/new` | `dataset:manage` | Create a dataset |
| `/app/datasets/:datasetId` | `dataset:read` | Dataset details and fields; admins also see access grants |
| `/app/datasets/:datasetId/edit` | `dataset:manage` | Edit dataset details |
| `/app/datasets/:datasetId/explore` | `dataset:read` | Data Explorer |
| `/app/datasets/:datasetId/records/:recordId` | `dataset:records:read` | Record details |
| `/app/analytics` | Data Analyst or Administrator | Analytics dashboard |
| `/app/admin` | Administrator | User roles and system counts |

Unauthenticated visitors to protected pages are redirected to `/login`.

## Roles and permissions

`lib/permissions.js` mirrors the backend's role matrix and is used only to **show or hide UI**. The backend re-checks every request, so hiding a button is a convenience, not a security control.

| Capability | Viewer | Data Analyst | Administrator |
| --- | :---: | :---: | :---: |
| Browse authorized datasets and records | Yes | Yes | Yes |
| Partial text search and one filter | Yes | Yes | Yes |
| Exact / MongoDB text search | No | Yes | Yes |
| Multiple filters | No | Yes | Yes |
| Create, edit, and share saved views | No | Yes | Yes |
| Use views shared with them | Yes | Yes | Yes |
| Export CSV | No | Yes* | Yes |
| Analytics dashboard | No | Yes | Yes |
| Manage datasets and fields | No | No | Yes |
| Manage users and dataset access | No | No | Yes |

\* Also requires an `export` grant on that dataset, which an administrator assigns.

On sign-up, users choose **Viewer** or **Data Analyst**. The Administrator role can only be assigned by the backend's first-admin script.

## The Data Explorer

The explorer lives at `/app/datasets/:datasetId/explore`.

**Search.** The search box debounces input (350 ms) and updates the URL. Three modes are available: *Partial text*, *Exact text*, and *MongoDB text search*. Only analysts and administrators can change the mode. The text-search option stays disabled unless the dataset defines searchable fields named `companyName`, `industry`, `country`, `category`, and `contact`, because the backend's text index covers exactly those fields.

**Filters.** Add up to 10 conditions. Operators depend on the field type:

| Field type | Operators |
| --- | --- |
| Text, email, phone | Equals, Not equals, Contains, Does not contain, Starts with, Ends with |
| Number, currency | Equals, Not equals, Greater than, Less than, At least, At most, Between |
| Date | Before, After, Between |
| Boolean | Is true, Is false |

Conditions are combined with AND and applied with the **Apply search** button. Viewers are limited to a single condition.

**Sorting.** Click a column heading to sort; shift-click to add up to three sort columns.

**Columns.** Toggle visible columns from the *Columns* menu and drag (or use the keyboard on) a column edge to resize it. Rows-per-page choices are 10, 25, 50, and 100.

**URL state.** `page`, `pageSize`, `sort`, `q`, `qMode`, and `filters` all live in the URL, so any exploration state can be bookmarked, shared, or restored with the back button. The record details page keeps these parameters so "Back to dataset" returns you to the same view.

**Saved views.** Analysts and administrators can save the current search, filters, sort, and visible columns under a name. To share a view, enter the recipients' user IDs, comma-separated. Recipients must already have access to the dataset. Owners can rename, re-share, and delete their views; everyone can apply views shared with them.

**Search history.** Recent searches for the dataset are listed and can be re-applied.

**CSV export.** Select rows with the checkboxes and choose *Export selected*, or use *Export filtered results* to export everything matching the current search and filters. Exports are capped at 5,000 records, and the button only appears for users with export permission.

## State management and data fetching

The app uses **Redux Toolkit (RTK)**, the official toolset for Redux, for both client state (`configureStore`, `createSlice`) and server data (RTK Query).

**RTK Query** (`store/services/data-scope-api.js`) is the single place every backend call is defined. It uses `credentials: "include"` so session cookies are sent, and a tag system (`Datasets`, `DatasetRecords`, `DatasetFields`, `DatasetPermissions`, `SavedViews`, `SearchHistory`, `Analytics`, `AdminUsers`, and others) that automatically refetches affected data after mutations.

**Redux slices** registered in the store:

| Slice | Holds |
| --- | --- |
| `authentication` | A sanitized copy of the signed-in user (id, name, email, role, permissions) and an auth status |
| `uiPreferences` | `theme`, `sidebarCollapsed`, `displayDensity` (defined, not yet consumed by any UI) |

**Authentication state.** Sessions are managed by the Better Auth client (`lib/auth-client.js`). `AuthenticatedNavigation` syncs the session and the backend's `/api/me` response (which includes computed permissions) into the `authentication` slice.

The store is created per-request through `makeStore()` and a `StoreProvider`, the pattern recommended for the Next.js App Router.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the unit tests |

## Testing

```bash
npm test
```

Runs Node's built-in test runner against `test/api.test.js`, which checks that:

- the RTK Query API registers its key endpoints (analytics, current user, CSV export);
- the permission matrix gives each role the right permissions (for example, viewers cannot export and analysts cannot manage users).

There are currently no component or end-to-end tests.

## Security notes

- Authorization is enforced by the backend on every request. The frontend's permission checks only control what is displayed.
- Sessions use the backend's HTTP-only cookies; the app never stores tokens in `localStorage` or `sessionStorage`.
- Page protection is client-side: protected pages check the session in the browser and redirect to `/login`. There is no Next.js middleware, so protected page code is still delivered to the browser. The data itself stays protected because the API rejects unauthenticated and unauthorized requests.
- `NEXT_PUBLIC_API_URL` is public by design. Keep secrets in the backend only.
- `.env` is git-ignored. Don't commit it.

## Known issues

These were found while documenting the code. Remove this section once they are addressed.

1. **Three Redux slices are dead code.** `dataset-slice.js`, `saved-views-slice.js`, and `search-configuration-slice.js` are never registered in `make-store.js` or imported anywhere. The Data Explorer keeps that state in the URL and in component state instead. They can be deleted or wired in.
2. **No Google sign-in button.** The backend supports Google OAuth, but the sign-in and register forms only offer email and password.
3. **Saved views are shared by typing raw user IDs.** There is no user picker in the share field.
4. **`@better-auth/mongo-adapter` is listed as a dependency but is not used** by the frontend, which only needs `better-auth`.
5. **`app/api/auth/` is an empty folder.** It can be removed.
