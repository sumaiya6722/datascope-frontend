"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "../lib/auth-client.js";
import { hasPermission } from "../lib/permissions.js";
import {
  useCreateSavedViewMutation,
  useCreateSearchHistoryMutation,
  useDeleteSavedViewMutation,
  useExportDatasetCsvMutation,
  useGetDatasetFieldsQuery,
  useGetDatasetQuery,
  useGetDatasetRecordsQuery,
  useGetDatasetsQuery,
  useGetSavedViewsQuery,
  useGetSearchHistoryQuery,
  useUpdateSavedViewMutation,
} from "../store/services/data-scope-api.js";

const defaultPageSize = 25;

function getErrorMessage(error, fallback) {
  return error?.data?.message ?? error?.data?.error ?? fallback;
}

function parsePageParameter(value, fallback, maximum) {
  if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : fallback;
}

function getOperators(field) {
  if (["number", "currency"].includes(field.dataType)) {
    return [
      ["equals", "Equals"],
      ["notEquals", "Not equals"],
      ["greaterThan", "Greater than"],
      ["lessThan", "Less than"],
      ["greaterThanOrEqual", "At least"],
      ["lessThanOrEqual", "At most"],
      ["between", "Between"],
    ];
  }
  if (field.dataType === "date") {
    return [
      ["before", "Before"],
      ["after", "After"],
      ["between", "Between"],
    ];
  }
  if (field.dataType === "boolean") {
    return [
      ["isTrue", "Is true"],
      ["isFalse", "Is false"],
    ];
  }
  return [
    ["equals", "Equals"],
    ["notEquals", "Not equals"],
    ["contains", "Contains"],
    ["notContains", "Does not contain"],
    ["startsWith", "Starts with"],
    ["endsWith", "Ends with"],
  ];
}

function defaultOperator(field) {
  if (field.dataType === "date") return "before";
  if (field.dataType === "boolean") return "isTrue";
  return "equals";
}

function parseFilterDrafts(rawFilters) {
  if (!rawFilters) return { filters: [], error: null };
  try {
    const filters = JSON.parse(rawFilters);
    if (!Array.isArray(filters)) return { filters: [], error: "Filter URL state must be an array." };
    return {
      filters: filters.map((filter, index) => ({ ...filter, draftId: `filter-${index}` })),
      error: null,
    };
  } catch {
    return { filters: [], error: "Filter URL state is invalid. Clear the filters to continue." };
  }
}

function serializeFilter(filter) {
  const result = { ...filter };
  delete result.draftId;
  return result;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function HighlightedText({ text, terms }) {
  const activeTerms = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!activeTerms.length) return text;
  const lowerText = text.toLocaleLowerCase();
  const parts = [];
  let cursor = 0;
  while (cursor < text.length) {
    let matchIndex = -1;
    let matchTerm = "";
    for (const term of activeTerms) {
      const nextIndex = lowerText.indexOf(term.toLocaleLowerCase(), cursor);
      if (nextIndex !== -1 && (matchIndex === -1 || nextIndex < matchIndex)) {
        matchIndex = nextIndex;
        matchTerm = term;
      }
    }
    if (matchIndex === -1) break;
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <mark className="rounded bg-amber-300/30 px-0.5 text-amber-100" key={`${matchIndex}-${parts.length}`}>
        {text.slice(matchIndex, matchIndex + matchTerm.length)}
      </mark>,
    );
    cursor = matchIndex + matchTerm.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function ResizableHeader({ field, width, onResize, sortRules, onSort }) {
  const drag = useRef(null);
  const direction = sortRules.find((rule) => rule.startsWith(`${field.name}:`))?.split(":")[1];
  const sortPriority = sortRules.findIndex((rule) => rule.startsWith(`${field.name}:`));

  return (
    <th
      className="relative border-b border-white/10 bg-slate-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300"
      style={{ minWidth: `${width}px`, width: `${width}px` }}
    >
      <button
        className="flex w-full items-center gap-2 text-left"
        disabled={!field.sortable}
        onClick={(event) => onSort(field.name, event.shiftKey)}
        title={field.sortable ? "Click to sort; Shift-click to add a sort column" : "This field cannot be sorted"}
        type="button"
      >
        <span className="truncate">{field.label}</span>
        {direction && (
          <span className="shrink-0 text-cyan-300">
            {direction === "asc" ? "↑" : "↓"}{sortRules.length > 1 ? sortPriority + 1 : ""}
          </span>
        )}
      </button>
      <span
        aria-label={`Resize ${field.label} column`}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { startX: event.clientX, startWidth: width };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          onResize(
            field.name,
            Math.max(100, Math.min(560, drag.current.startWidth + event.clientX - drag.current.startX)),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            onResize(field.name, width + (event.key === "ArrowRight" ? 20 : -20));
          }
        }}
        aria-orientation="vertical"
        aria-valuenow={width}
        role="separator"
        tabIndex={0}
      />
    </th>
  );
}

export default function DataExplorer() {
  const { datasetId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: isCheckingSession } = authClient.useSession();
  const canUseAdvancedSearch = ["administrator", "dataAnalyst"].includes(session?.user?.role);
  const canManageSavedViews = ["administrator", "dataAnalyst"].includes(session?.user?.role);
  const {
    data: datasetsResult,
    error: datasetsError,
    isLoading: isLoadingDatasets,
  } = useGetDatasetsQuery(undefined, { skip: isCheckingSession || !session });
  const {
    data: datasetResult,
    error: datasetError,
    isLoading: isLoadingDataset,
  } = useGetDatasetQuery(datasetId, { skip: isCheckingSession || !session });
  const {
    data: fieldsResult,
    error: fieldsError,
    isLoading: isLoadingFields,
  } = useGetDatasetFieldsQuery(datasetId, { skip: isCheckingSession || !session });
  const savedViewsQuery = useGetSavedViewsQuery(datasetId, {
    skip: isCheckingSession || !session,
  });
  const searchHistoryQuery = useGetSearchHistoryQuery(datasetId, {
    skip: isCheckingSession || !session,
  });
  const [createSavedView, createSavedViewState] = useCreateSavedViewMutation();
  const [updateSavedView] = useUpdateSavedViewMutation();
  const [deleteSavedView] = useDeleteSavedViewMutation();
  const [createSearchHistory] = useCreateSearchHistoryMutation();
  const [exportDatasetCsv, { isLoading: isExporting }] = useExportDatasetCsvMutation();

  const page = parsePageParameter(searchParams.get("page"), 1, 1_000_000);
  const rawPageSize = parsePageParameter(searchParams.get("pageSize"), defaultPageSize, 100);
  const pageSize = [10, 25, 50, 100].includes(rawPageSize) ? rawPageSize : defaultPageSize;
  const sortRules = useMemo(
    () => searchParams.getAll("sort").slice(0, 3),
    [searchParams],
  );
  const searchTerm = searchParams.get("q")?.slice(0, 100) ?? "";
  const searchMode = ["partial", "exact", "text"].includes(searchParams.get("qMode"))
    ? searchParams.get("qMode")
    : "partial";
  const rawFilters = searchParams.get("filters");
  const parsedFilterState = useMemo(() => parseFilterDrafts(rawFilters), [rawFilters]);
  const fields = fieldsResult?.fields ?? [];
  const filterableFields = fields.filter(
    (field) => field.filterable && field.dataType !== "object",
  );
  const canUseMongoTextSearch = [
    "companyName",
    "industry",
    "country",
    "category",
    "contact",
  ].every((name) => fields.some((field) => field.name === name && field.searchable));
  const fieldKey = fields.map((field) => field.name).join(",");
  const recordQuery = useGetDatasetRecordsQuery(
    {
      datasetId,
      page,
      pageSize,
      sort: sortRules,
      fields: fields.map((field) => field.name),
      q: searchTerm,
      qMode: searchMode,
      filters: parsedFilterState.filters.map(serializeFilter),
    },
    {
      skip:
        isCheckingSession ||
        !session ||
        isLoadingFields ||
        Boolean(fieldsError) ||
        Boolean(parsedFilterState.error),
    },
  );
  const [draftSearch, setDraftSearch] = useState(searchTerm);
  const [draftSearchMode, setDraftSearchMode] = useState(searchMode);
  const [draftFilters, setDraftFilters] = useState(parsedFilterState.filters);
  const [filterError, setFilterError] = useState("");
  const [savedViewName, setSavedViewName] = useState("");
  const [savedViewRecipients, setSavedViewRecipients] = useState("");
  const [savedViewNotice, setSavedViewNotice] = useState("");
  const [savedViewError, setSavedViewError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [viewEdits, setViewEdits] = useState({});
  const [exportError, setExportError] = useState("");
  const canExport = hasPermission(session?.user?.role, "dataset:export");
  const historySignatureRef = useRef("");
  const historyFilters = parsedFilterState.filters.map(serializeFilter);
  const historySignature = JSON.stringify({
    datasetId,
    query: searchTerm,
    searchMode,
    filters: historyFilters,
    sort: sortRules,
  });
  const [visibleFields, setVisibleFields] = useState(null);
  const [columnWidths, setColumnWidths] = useState({});
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const updateTimer = useRef(null);
  const nextFilterId = useRef(0);

  useEffect(() => {
    setDraftSearch(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    setDraftSearchMode(searchMode);
  }, [searchMode]);

  useEffect(() => {
    setDraftFilters(parsedFilterState.filters);
    setFilterError(parsedFilterState.error ?? "");
  }, [parsedFilterState]);

  useEffect(() => {
    if (
      isCheckingSession ||
      !session ||
      recordQuery.isFetching ||
      !recordQuery.isSuccess ||
      !recordQuery.currentData ||
      (!searchTerm && !historyFilters.length) ||
      historySignatureRef.current === historySignature
    ) {
      return;
    }

    historySignatureRef.current = historySignature;
    createSearchHistory({
      datasetId,
      query: searchTerm,
      searchMode,
      filters: historyFilters,
      sort: sortRules,
    }).unwrap().then(() => {
      setHistoryError("");
    }).catch((error) => {
      setHistoryError(getErrorMessage(error, "Could not save this search to history."));
    });
  }, [
    createSearchHistory,
    datasetId,
    historyFilters,
    historySignature,
    isCheckingSession,
    recordQuery.isFetching,
    recordQuery.isSuccess,
    recordQuery.currentData,
    searchMode,
    searchTerm,
    session,
    sortRules,
  ]);

  useEffect(() => {
    setVisibleFields(fields.filter((field) => field.visibleByDefault).map((field) => field.name));
    setSelectedRecordIds([]);
    setColumnWidths({});
  }, [datasetId, fieldKey]);

  useEffect(
    () => () => {
      if (updateTimer.current) clearTimeout(updateTimer.current);
    },
    [],
  );

  const updateUrl = useCallback(
    (updates, { resetPage = false } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.delete(key);
        if (Array.isArray(value)) {
          for (const item of value) params.append(key, item);
        } else if (value !== "" && value !== null && value !== undefined) {
          params.set(key, String(value));
        }
      }
      if (resetPage && !Object.hasOwn(updates, "page")) params.delete("page");
      const query = params.toString();
      router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  function setSearch(value) {
    setDraftSearch(value);
    if (updateTimer.current) clearTimeout(updateTimer.current);
    updateTimer.current = setTimeout(() => {
      updateUrl(
        { q: value.trim(), qMode: value.trim() ? draftSearchMode : null },
        { resetPage: true },
      );
    }, 350);
  }

  function applyFilters() {
    const incomplete = draftFilters.find((filter) => {
      const field = fields.find((item) => item.name === filter.field);
      if (!field) return true;
      if (["isTrue", "isFalse"].includes(filter.operator)) return false;
      return (
        typeof filter.value !== "string" ||
        !filter.value.trim() ||
        (filter.operator === "between" &&
          (typeof filter.valueTo !== "string" || !filter.valueTo.trim()))
      );
    });
    if (incomplete) {
      setFilterError("Complete each filter condition before applying the search.");
      return;
    }
    setFilterError("");
    const filters = draftFilters.map(serializeFilter);
    updateUrl(
      { filters: filters.length ? JSON.stringify(filters) : null },
      { resetPage: true },
    );
  }

  function clearSearchAndFilters() {
    if (updateTimer.current) clearTimeout(updateTimer.current);
    setDraftSearch("");
    setDraftFilters([]);
    setFilterError("");
    updateUrl({ q: null, qMode: null, filters: null }, { resetPage: true });
  }

  function updateDraftFilter(draftId, updates) {
    setDraftFilters((current) =>
      current.map((filter) =>
        filter.draftId === draftId ? { ...filter, ...updates } : filter,
      ),
    );
  }

  function addFilter() {
    const field = filterableFields[0];
    if (!field) return;
    setDraftFilters((current) => [
      ...current,
      {
        draftId: `new-filter-${nextFilterId.current++}`,
        field: field.name,
        operator: defaultOperator(field),
        ...(field.dataType === "boolean" ? {} : { value: "" }),
      },
    ]);
  }

  function handleSort(fieldName, additive) {
    const currentRule = sortRules.find((rule) => rule.startsWith(`${fieldName}:`));
    const nextDirection = currentRule?.endsWith(":asc") ? "desc" : "asc";
    let nextRules;
    if (!additive) {
      nextRules = [`${fieldName}:${nextDirection}`];
    } else {
      nextRules = sortRules.filter((rule) => !rule.startsWith(`${fieldName}:`));
      nextRules.push(`${fieldName}:${nextDirection}`);
      if (nextRules.length > 3) nextRules = nextRules.slice(-3);
    }
    updateUrl({ sort: nextRules }, { resetPage: true });
  }

  function toggleRow(recordId) {
    setSelectedRecordIds((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId],
    );
  }

  const dataset = datasetResult?.dataset;
  const datasets = datasetsResult?.datasets ?? [];
  const pageData = recordQuery.data;
  const visibleColumns = fields.filter(
    (field) => visibleFields === null
      ? field.visibleByDefault
      : visibleFields.includes(field.name),
  );
  const savedViews = savedViewsQuery.data?.views ?? [];
  const searchHistory = searchHistoryQuery.data?.history ?? [];
  const currentPageRecordIds = pageData?.records.map((record) => record.id) ?? [];
  const allCurrentPageSelected = currentPageRecordIds.length > 0 &&
    currentPageRecordIds.every((id) => selectedRecordIds.includes(id));
  const highlightTerms = [
    searchTerm,
    ...parsedFilterState.filters
      .filter((filter) => typeof filter.value === "string")
      .map((filter) => filter.value),
  ];

  function applySearchConfiguration(configuration, targetDatasetId = datasetId) {
    const params = new URLSearchParams();
    if (configuration.query) {
      params.set("q", configuration.query);
      params.set("qMode", configuration.searchMode ?? "partial");
    }
    if (configuration.filters?.length) {
      params.set("filters", JSON.stringify(configuration.filters));
    }
    for (const rule of configuration.sort ?? []) params.append("sort", rule);
    if (targetDatasetId === datasetId) params.set("pageSize", String(pageSize));
    if (Array.isArray(configuration.visibleFields)) {
      setVisibleFields(configuration.visibleFields);
    }
    const query = params.toString();
    router.push(
      `/app/datasets/${targetDatasetId}/explore${query ? `?${query}` : ""}`,
    );
  }

  function currentSearchConfiguration() {
    return {
      datasetId,
      query: searchTerm,
      searchMode,
      filters: historyFilters,
      sort: sortRules,
      visibleFields: visibleColumns.map((field) => field.name),
    };
  }

  function describeFilters(filters) {
    return filters.map((filter) => {
      const field = fields.find((item) => item.name === filter.field);
      const operatorLabel = field
        ? getOperators(field).find(([operator]) => operator === filter.operator)?.[1] ??
          filter.operator
        : filter.operator;
      const fieldLabel = field?.label ?? filter.field;
      if (["isTrue", "isFalse"].includes(filter.operator)) {
        return `${fieldLabel} ${operatorLabel}`;
      }
      const value = filter.operator === "between"
        ? `${filter.value} to ${filter.valueTo}`
        : filter.value;
      return `${fieldLabel} ${operatorLabel} ${value}`;
    }).join(" AND ");
  }

  async function saveCurrentView(event) {
    event.preventDefault();
    setSavedViewNotice("");
    setSavedViewError("");
    const recipients = savedViewRecipients
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean);
    try {
      await createSavedView({
        ...currentSearchConfiguration(),
        name: savedViewName.trim(),
        sharedWith: recipients,
      }).unwrap();
      setSavedViewName("");
      setSavedViewRecipients("");
      setSavedViewNotice("Saved view created.");
    } catch (error) {
      setSavedViewError(getErrorMessage(error, "Could not save this view."));
    }
  }

  async function updateView(view) {
    setSavedViewNotice("");
    setSavedViewError("");
    const edits = viewEdits[view.id] ?? {};
    const sharedWith = (edits.sharedWith ?? view.sharedWith.join(","))
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean);
    try {
      const configuration = currentSearchConfiguration();
      delete configuration.datasetId;
      await updateSavedView({
        viewId: view.id,
        ...configuration,
        name: (edits.name ?? view.name).trim(),
        sharedWith,
      }).unwrap();
      setSavedViewNotice(`“${(edits.name ?? view.name).trim()}” updated.`);
    } catch (error) {
      setSavedViewError(getErrorMessage(error, "Could not update this view."));
    }
  }

  async function removeView(view) {
    if (!window.confirm(`Delete the saved view “${view.name}”?`)) return;
    setSavedViewNotice("");
    setSavedViewError("");
    try {
      await deleteSavedView(view.id).unwrap();
      setSavedViewNotice("Saved view deleted.");
    } catch (error) {
      setSavedViewError(getErrorMessage(error, "Could not delete this view."));
    }
  }

  function toggleCurrentPageSelection() {
    setSelectedRecordIds((current) => {
      if (allCurrentPageSelected) {
        return current.filter((id) => !currentPageRecordIds.includes(id));
      }
      return [...new Set([...current, ...currentPageRecordIds])];
    });
  }

  async function handleExportCsv(mode) {
    setExportError("");
    const exportFields = (visibleColumns.length ? visibleColumns : fields)
      .map((field) => field.name)
      .slice(0, 40);

    if (!exportFields.length) {
      setExportError("At least one field must be selected for export.");
      return;
    }

    try {
      const payload = {
        datasetId,
        mode,
        fields: exportFields,
      };

      if (mode === "selected") {
        if (!selectedRecordIds.length) {
          setExportError("Select at least one record to export.");
          return;
        }
        payload.recordIds = selectedRecordIds;
      } else {
        if (!searchTerm && !historyFilters.length) {
          setExportError("Filtered export requires search text or at least one filter condition.");
          return;
        }
        payload.filters = historyFilters;
        payload.q = searchTerm;
        payload.qMode = searchMode;
      }

      const blob = await exportDatasetCsv(payload).unwrap();
      if (typeof window !== "undefined" && blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${(dataset?.slug || "dataset").replace(/[^a-z0-9-]/gi, "-")}-export.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setExportError(getErrorMessage(error, "Could not export records to CSV."));
    }
  }

  if (isCheckingSession || !session) {
    return <main className="mx-auto max-w-7xl px-6 py-16 text-slate-400">Loading Data Explorer...</main>;
  }

  if (isLoadingDatasets || isLoadingDataset || isLoadingFields) {
    return <main className="mx-auto max-w-7xl px-6 py-16 text-slate-400">Loading dataset and fields...</main>;
  }

  if (datasetsError || datasetError || fieldsError) {
    const error = datasetsError ?? datasetError ?? fieldsError;
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Data Explorer unavailable</h1>
        <p role="alert" className="mt-4 text-rose-300">
          {getErrorMessage(error, "Could not load this dataset.")}
        </p>
        <Link className="mt-5 inline-block text-cyan-300" href="/app/datasets">Back to datasets</Link>
      </main>
    );
  }

  if (!dataset || !datasets.some((item) => item.id === datasetId)) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Dataset unavailable</h1>
        <p className="mt-3 text-slate-400">This dataset is not shared with your account.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <Link className="text-sm text-cyan-300 hover:text-cyan-200" href="/app/datasets">
            Dataset library
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">{dataset.name}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {dataset.category} · {dataset.totalRecords.toLocaleString()} total records
          </p>
          {dataset.description && <p className="mt-2 max-w-3xl text-sm text-slate-400">{dataset.description}</p>}
        </div>
        <label className="text-sm text-slate-300">
          Select dataset
          <select
            className="mt-2 block max-w-xs rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
            onChange={(event) => router.push(`/app/datasets/${event.target.value}/explore`)}
            value={datasetId}
          >
            {datasets.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="mt-7 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="min-w-60 flex-1 text-sm text-slate-300">
            Search this dataset
            <input
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white"
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search searchable fields..."
              type="search"
              value={draftSearch}
            />
          </label>
          <label className="text-sm text-slate-300">
            Search matching
            <select
              className="mt-2 block rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              disabled={!canUseAdvancedSearch}
              onChange={(event) => {
                const mode = event.target.value;
                setDraftSearchMode(mode);
                if (searchTerm) updateUrl({ qMode: mode }, { resetPage: true });
              }}
              value={draftSearchMode}
            >
              <option value="partial">Partial text</option>
              <option value="exact">Exact text</option>
              <option disabled={!canUseMongoTextSearch} value="text">MongoDB text search</option>
            </select>
          </label>
          <details className="relative">
            <summary className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200">
              Columns ({visibleColumns.length}/{fields.length})
            </summary>
            <div className="absolute right-0 z-10 mt-2 max-h-80 w-64 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 shadow-xl">
              {fields.map((field) => (
                <label className="flex items-center gap-2 py-2 text-sm text-slate-200" key={field.id}>
                  <input
                    checked={visibleColumns.some((item) => item.name === field.name)}
                    onChange={() => {
                      setVisibleFields((current) => {
                        const active = current ?? fields.filter((item) => item.visibleByDefault).map((item) => item.name);
                        return active.includes(field.name)
                          ? active.filter((name) => name !== field.name)
                          : [...active, field.name];
                      });
                    }}
                    type="checkbox"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </details>
          <label className="text-sm text-slate-300">
            Rows per page
            <select
              className="mt-2 block rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              onChange={(event) => updateUrl({ pageSize: event.target.value, page: 1 })}
              value={pageSize}
            >
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Click a column heading to sort. Shift-click up to three headings for multi-column sorting.
        </p>
      </section>

      <section className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Advanced filters</h2>
            <p className="mt-1 text-sm text-slate-400">
              All conditions are combined with AND and are saved in the URL when applied.
            </p>
          </div>
          <button
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
            disabled={
              !filterableFields.length ||
              draftFilters.length >= 10 ||
              (!canUseAdvancedSearch && draftFilters.length >= 1)
            }
            onClick={addFilter}
            type="button"
          >
            Add condition
          </button>
        </div>

        {!filterableFields.length && (
          <p className="mt-4 text-sm text-slate-500">This dataset has no filterable fields.</p>
        )}
        <div className="mt-4 space-y-3">
          {draftFilters.map((filter) => {
            const field = fields.find((item) => item.name === filter.field);
            const operators = field ? getOperators(field) : [];
            const isBoolean = field?.dataType === "boolean";
            const valueType = field?.dataType === "date"
              ? "date"
              : ["number", "currency"].includes(field?.dataType)
                ? "number"
                : "text";
            return (
              <div
                className="grid gap-3 rounded-lg border border-white/10 p-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
                key={filter.draftId}
              >
                <label className="text-xs text-slate-400">
                  Field
                  <select
                    className="mt-1 block w-full rounded border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white"
                    onChange={(event) => {
                      const nextField = fields.find((item) => item.name === event.target.value);
                      if (!nextField) return;
                      updateDraftFilter(filter.draftId, {
                        field: nextField.name,
                        operator: defaultOperator(nextField),
                        value: undefined,
                        valueTo: undefined,
                      });
                    }}
                    value={field?.name ?? ""}
                  >
                    {filterableFields.map((item) => (
                      <option key={item.id} value={item.name}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Operator
                  <select
                    className="mt-1 block w-full rounded border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white"
                    onChange={(event) => {
                      const operator = event.target.value;
                      updateDraftFilter(filter.draftId, {
                        operator,
                        value: ["isTrue", "isFalse"].includes(operator) ? undefined : "",
                        valueTo: undefined,
                      });
                    }}
                    value={operators.some(([operator]) => operator === filter.operator)
                      ? filter.operator
                      : operators[0]?.[0] ?? ""}
                  >
                    {operators.map(([operator, label]) => (
                      <option key={operator} value={operator}>{label}</option>
                    ))}
                  </select>
                </label>
                {!isBoolean && (
                  <>
                    <label className="text-xs text-slate-400">
                      {filter.operator === "between" ? "From" : "Value"}
                      <input
                        className="mt-1 block w-full rounded border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white"
                        onChange={(event) =>
                          updateDraftFilter(filter.draftId, { value: event.target.value })
                        }
                        type={valueType}
                        value={filter.value ?? ""}
                      />
                    </label>
                    {filter.operator === "between" ? (
                      <label className="text-xs text-slate-400">
                        To
                        <input
                          className="mt-1 block w-full rounded border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white"
                          onChange={(event) =>
                            updateDraftFilter(filter.draftId, { valueTo: event.target.value })
                          }
                          type={valueType}
                          value={filter.valueTo ?? ""}
                        />
                      </label>
                    ) : <span className="hidden md:block" />}
                  </>
                )}
                <button
                  aria-label="Remove filter condition"
                  className="self-end rounded border border-white/10 px-3 py-2 text-sm text-rose-300 hover:bg-rose-400/10"
                  onClick={() =>
                    setDraftFilters((current) =>
                      current.filter((item) => item.draftId !== filter.draftId),
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        {filterError && <p className="mt-3 text-sm text-rose-300" role="alert">{filterError}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            onClick={applyFilters}
            type="button"
          >
            Apply search
          </button>
          <button
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            onClick={clearSearchAndFilters}
            type="button"
          >
            Clear search and filters
          </button>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-lg font-semibold">Saved views</h2>
          <p className="mt-1 text-sm text-slate-400">
            Save this search, its filters, sorting, and visible columns for reuse.
          </p>
          {canManageSavedViews && (
            <form className="mt-4 space-y-3 rounded-lg border border-white/10 p-3" onSubmit={saveCurrentView}>
              <label className="block text-xs text-slate-400">
                View name
                <input
                  className="mt-1 block w-full rounded border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                  maxLength={120}
                  onChange={(event) => setSavedViewName(event.target.value)}
                  required
                  value={savedViewName}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Share with authorized user IDs (optional, comma-separated)
                <input
                  className="mt-1 block w-full rounded border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                  onChange={(event) => setSavedViewRecipients(event.target.value)}
                  placeholder="User IDs with existing dataset read access"
                  value={savedViewRecipients}
                />
              </label>
              <button
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                disabled={createSavedViewState.isLoading}
                type="submit"
              >
                {createSavedViewState.isLoading ? "Saving..." : "Save current view"}
              </button>
            </form>
          )}
          {savedViewNotice && <p className="mt-3 text-sm text-emerald-300" role="status">{savedViewNotice}</p>}
          {savedViewError && <p className="mt-3 text-sm text-rose-300" role="alert">{savedViewError}</p>}
          {savedViewsQuery.isLoading && <p className="mt-4 text-sm text-slate-400">Loading saved views...</p>}
          {savedViewsQuery.error && (
            <p className="mt-4 text-sm text-rose-300" role="alert">
              {getErrorMessage(savedViewsQuery.error, "Could not load saved views.")}
            </p>
          )}
          {!savedViewsQuery.isLoading && !savedViewsQuery.error && !savedViews.length && (
            <p className="mt-4 text-sm text-slate-500">No saved views are available for this dataset.</p>
          )}
          <ul className="mt-3 space-y-3">
            {savedViews.map((view) => {
              const isOwner = view.ownerId === session.user.id;
              return (
                <li className="rounded-lg border border-white/10 p-3" key={view.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-100">{view.name}</p>
                    {view.isShared && (
                      <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200">Shared</span>
                    )}
                  </div>
                  {view.description && <p className="mt-1 text-sm text-slate-400">{view.description}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    {view.query || "Filters only"} · {dataset.name} · Created {new Date(view.createdAt).toLocaleDateString()}
                  </p>
                  {view.filters.length > 0 && (
                    <p className="mt-2 text-xs text-slate-400">{describeFilters(view.filters)}</p>
                  )}
                  {isOwner && canManageSavedViews && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-slate-400">
                        Edit view name
                        <input
                          className="mt-1 block w-full rounded border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white"
                          maxLength={120}
                          onChange={(event) => setViewEdits((current) => ({
                            ...current,
                            [view.id]: { ...current[view.id], name: event.target.value },
                          }))}
                          value={viewEdits[view.id]?.name ?? view.name}
                        />
                      </label>
                      <label className="text-xs text-slate-400">
                        Shared user IDs
                        <input
                          className="mt-1 block w-full rounded border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white"
                          onChange={(event) => setViewEdits((current) => ({
                            ...current,
                            [view.id]: { ...current[view.id], sharedWith: event.target.value },
                          }))}
                          value={viewEdits[view.id]?.sharedWith ?? view.sharedWith.join(", ")}
                        />
                      </label>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded border border-cyan-400/40 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-400/10"
                      onClick={() => applySearchConfiguration(view)}
                      type="button"
                    >
                      Apply view
                    </button>
                    {isOwner && canManageSavedViews && (
                      <>
                        <button
                          className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
                          onClick={() => updateView(view)}
                          type="button"
                        >
                          Update from current search
                        </button>
                        <button
                          className="rounded border border-rose-400/30 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-400/10"
                          onClick={() => removeView(view)}
                          type="button"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-lg font-semibold">Recent searches</h2>
          <p className="mt-1 text-sm text-slate-400">
            Executed searches are recorded privately and can be applied again.
          </p>
          {historyError && <p className="mt-3 text-sm text-rose-300" role="alert">{historyError}</p>}
          {searchHistoryQuery.isLoading && <p className="mt-4 text-sm text-slate-400">Loading search history...</p>}
          {searchHistoryQuery.error && (
            <p className="mt-4 text-sm text-rose-300" role="alert">
              {getErrorMessage(searchHistoryQuery.error, "Could not load search history.")}
            </p>
          )}
          {!searchHistoryQuery.isLoading && !searchHistoryQuery.error && !searchHistory.length && (
            <p className="mt-4 text-sm text-slate-500">No executed searches yet.</p>
          )}
          <ul className="mt-3 space-y-3">
            {searchHistory.map((item) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{item.description || "Filtered search"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dataset.name} · {new Date(item.searchedAt).toLocaleString()}
                  </p>
                  {item.filters.length > 0 && (
                    <p className="mt-2 text-xs text-slate-400">{describeFilters(item.filters)}</p>
                  )}
                </div>
                <button
                  className="rounded border border-cyan-400/40 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-400/10"
                  onClick={() => applySearchConfiguration(item, item.datasetId)}
                  type="button"
                >
                  Reuse search
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {parsedFilterState.error && (
        <p role="alert" className="mt-5 text-sm text-rose-300">{parsedFilterState.error}</p>
      )}
      {recordQuery.error && (
        <p role="alert" className="mt-5 text-sm text-rose-300">
          {getErrorMessage(recordQuery.error, "Could not load dataset records.")}
        </p>
      )}
      {exportError && (
        <p role="alert" className="mt-5 text-sm text-rose-300">{exportError}</p>
      )}
      {recordQuery.isLoading && (
        <p aria-live="polite" className="mt-5 text-sm text-slate-400">Loading records...</p>
      )}
      {recordQuery.isFetching && !recordQuery.isLoading && (
        <p aria-live="polite" className="mt-3 text-xs text-slate-500">Updating results...</p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <>
              <button
                className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!selectedRecordIds.length || isExporting}
                onClick={() => handleExportCsv("selected")}
                type="button"
              >
                {isExporting ? "Exporting..." : `Export selected (${selectedRecordIds.length})`}
              </button>
              <button
                className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={(!searchTerm && !historyFilters.length) || isExporting}
                onClick={() => handleExportCsv("filtered")}
                title={
                  !searchTerm && !historyFilters.length
                    ? "Apply search or filter conditions to export matching records (up to 5,000)"
                    : "Export records matching current search and filters (up to 5,000)"
                }
                type="button"
              >
                {isExporting ? "Exporting..." : "Export filtered results"}
              </button>
            </>
          )}
        </div>
        {selectedRecordIds.length > 0 && (
          <button
            className="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setSelectedRecordIds([])}
            type="button"
          >
            Clear selection ({selectedRecordIds.length})
          </button>
        )}
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-12 border-b border-white/10 bg-slate-900 px-3 py-3">
                <input
                  aria-label="Select all rows on this page"
                  checked={allCurrentPageSelected}
                  onChange={toggleCurrentPageSelection}
                  type="checkbox"
                />
              </th>
              {visibleColumns.map((field) => (
                <ResizableHeader
                  field={field}
                  key={field.id}
                  onResize={(name, width) => setColumnWidths((current) => ({ ...current, [name]: width }))}
                  onSort={handleSort}
                  sortRules={sortRules}
                  width={columnWidths[field.name] ?? 180}
                />
              ))}
              <th className="w-28 border-b border-white/10 bg-slate-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {(pageData?.records ?? []).map((record) => (
              <tr className="border-b border-white/5 hover:bg-white/[0.03]" key={record.id}>
                <td className="px-3 py-3">
                  <input
                    aria-label={`Select record ${record.id}`}
                    checked={selectedRecordIds.includes(record.id)}
                    onChange={() => toggleRow(record.id)}
                    type="checkbox"
                  />
                </td>
                {visibleColumns.map((field) => (
                  <td className="truncate px-3 py-3 text-slate-300" key={field.id} title={formatValue(record.data[field.name])}>
                    <HighlightedText text={formatValue(record.data[field.name])} terms={highlightTerms} />
                  </td>
                ))}
                <td className="px-3 py-3">
                  <Link
                    className="text-cyan-300 hover:text-cyan-200"
                    href={`/app/datasets/${datasetId}/records/${record.id}${searchParams.size ? `?${searchParams.toString()}` : ""}`}
                  >
                    View record
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!recordQuery.isLoading && !recordQuery.error && !(pageData?.records.length) && (
        <p className="mt-8 rounded-xl border border-dashed border-white/15 p-8 text-center text-slate-400">
          {searchTerm || parsedFilterState.filters.length
            ? "No records matched your search."
            : "This dataset has no records yet."}
        </p>
      )}

      {pageData && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm">
          <p aria-live="polite" className="text-slate-400">
            {pageData.totalMatchingRecords.toLocaleString()} matching records · Page {pageData.page} of {Math.max(pageData.totalPages, 1)}
            {selectedRecordIds.length > 0 && ` · ${selectedRecordIds.length} selected`}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded border border-white/10 px-3 py-2 text-slate-200 disabled:opacity-40"
              disabled={pageData.page <= 1 || recordQuery.isFetching}
              onClick={() => updateUrl({ page: pageData.page - 1 })}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded border border-white/10 px-3 py-2 text-slate-200 disabled:opacity-40"
              disabled={pageData.page >= pageData.totalPages || recordQuery.isFetching}
              onClick={() => updateUrl({ page: pageData.page + 1 })}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
