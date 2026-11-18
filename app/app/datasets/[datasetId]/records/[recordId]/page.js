"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useDataScopeSession } from "../../../../../../lib/use-data-scope-session.js";
import {
  useGetDatasetFieldsQuery,
  useGetDatasetQuery,
  useGetDatasetRecordQuery,
} from "../../../../../../store/services/data-scope-api.js";

function getErrorMessage(error) {
  return error?.data?.message ?? error?.data?.error ?? "Could not load this record.";
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function RecordDetailsContent() {
  const { datasetId, recordId } = useParams();
  const searchParams = useSearchParams();
  const explorerHref = `/app/datasets/${datasetId}/explore${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const { data: session, isPending } = useDataScopeSession();
  const {
    data: datasetResult,
    error: datasetError,
    isLoading: isLoadingDataset,
  } = useGetDatasetQuery(datasetId, { skip: isPending || !session });
  const { data: fieldsResult } = useGetDatasetFieldsQuery(datasetId, {
    skip: isPending || !session,
  });
  const {
    data: recordResult,
    error: recordError,
    isLoading: isLoadingRecord,
  } = useGetDatasetRecordQuery(
    { datasetId, recordId },
    { skip: isPending || !session },
  );
  const dataset = datasetResult?.dataset;
  const record = recordResult?.record;

  if (isPending || !session || isLoadingDataset || isLoadingRecord) {
    return <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">Loading record...</main>;
  }

  if (datasetError || recordError || !dataset || !record) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Record unavailable</h1>
        <p role="alert" className="mt-4 text-rose-300">
          {getErrorMessage(recordError ?? datasetError)}
        </p>
        <Link className="mt-6 inline-block text-cyan-300" href={explorerHref}>
          Back to Data Explorer
        </Link>
      </main>
    );
  }

  const fieldLabels = new Map(
    (fieldsResult?.fields ?? []).map((field) => [field.name, field.label]),
  );
  const rows = Object.entries(record.data);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link className="text-sm text-cyan-300 hover:text-cyan-200" href={explorerHref}>
        Back to {dataset.name}
      </Link>
      <p className="mt-8 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Record details</p>
      <h1 className="mt-3 break-all text-3xl font-semibold">{record.id}</h1>
      <dl className="mt-7 grid gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
        <div><dt className="text-sm text-slate-500">Created</dt><dd className="mt-1">{record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}</dd></div>
        <div><dt className="text-sm text-slate-500">Updated</dt><dd className="mt-1">{record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "—"}</dd></div>
      </dl>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Dataset fields</h2>
        <dl className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10">
          {rows.map(([name, value]) => (
            <div className="grid gap-2 p-4 sm:grid-cols-[minmax(12rem,1fr)_2fr]" key={name}>
              <dt className="text-sm text-slate-400">{fieldLabels.get(name) ?? name}</dt>
              <dd className="break-words whitespace-pre-wrap text-sm text-slate-100">{displayValue(value)}</dd>
            </div>
          ))}
          {!rows.length && <p className="p-5 text-sm text-slate-400">This record has no configured fields.</p>}
        </dl>
      </section>
    </main>
  );
}

export default function RecordDetailsPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">Loading record...</main>}>
      <RecordDetailsContent />
    </Suspense>
  );
}
