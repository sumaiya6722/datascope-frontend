"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDeleteDatasetMutation, useGetDatasetsQuery } from "../../../store/services/data-scope-api.js";
import { useDataScopeSession } from "../../../lib/use-data-scope-session.js";
import { hasPermission } from "../../../lib/permissions.js";

function getErrorMessage(error, fallback) {
  return error?.data?.message ?? error?.data?.error ?? fallback;
}

export default function DatasetsPage() {
  const router = useRouter();
  const { data: session, isPending } = useDataScopeSession();
  const canManage = hasPermission(session?.user.permissions, "dataset:manage");
  const {
    data: datasetsResult,
    error,
    isLoading,
    isFetching,
  } = useGetDatasetsQuery(undefined, { skip: isPending || !session });
  const [deleteDataset, { isLoading: isDeleting }] = useDeleteDatasetMutation();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const datasets = datasetsResult?.datasets ?? [];

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, router, session]);

  async function handleDelete(dataset) {
    if (!window.confirm(`Permanently delete "${dataset.name}" and all of its records and settings?`)) {
      return;
    }

    setMessage("");
    setErrorMessage("");
    try {
      await deleteDataset(dataset.id).unwrap();
      setMessage(`"${dataset.name}" and its associated data were deleted.`);
    } catch (deleteError) {
      setErrorMessage(getErrorMessage(deleteError, "Could not delete the dataset."));
    }
  }

  if (isPending || !session) {
    return <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">Loading datasets...</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
            Authorized data
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Dataset library</h1>
          <p className="mt-3 text-slate-400">
            Browse datasets shared with your account. Access is checked again by the API.
          </p>
        </div>
        {canManage && (
          <Link
            className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
            href="/app/datasets/new"
          >
            Create dataset
          </Link>
        )}
      </div>

      {message && <p role="status" className="mt-6 text-sm text-emerald-300">{message}</p>}
      {errorMessage && <p role="alert" className="mt-6 text-sm text-rose-300">{errorMessage}</p>}
      {error && <p role="alert" className="mt-6 text-sm text-rose-300">{getErrorMessage(error, "Could not load datasets.")}</p>}
      {(isLoading || isFetching) && (
        <p aria-live="polite" className="mt-8 text-sm text-slate-400">Loading datasets...</p>
      )}
      {!isLoading && !error && !datasets.length && (
        <section className="mt-8 rounded-xl border border-dashed border-white/15 p-8 text-center">
          <p className="text-slate-300">No datasets are available to your account yet.</p>
          {canManage && (
            <Link className="mt-4 inline-block text-cyan-300 hover:text-cyan-200" href="/app/datasets/new">
              Create your first dataset
            </Link>
          )}
        </section>
      )}
      <ul className="mt-8 space-y-4">
        {datasets.map((dataset) => (
          <li className="rounded-xl border border-white/10 bg-white/[0.03] p-5" key={dataset.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <Link className="min-w-0 flex-1" href={`/app/datasets/${dataset.id}`}>
                <span className="text-lg font-medium text-white">{dataset.name}</span>
                <span className="mt-1 block text-sm text-slate-400">
                  {dataset.description || "No description"}
                </span>
              </Link>
              {canManage && (
                <div className="flex items-center gap-4">
                  <Link className="text-sm text-cyan-300 hover:text-cyan-200" href={`/app/datasets/${dataset.id}/edit`}>
                    Edit
                  </Link>
                  <button
                    className="text-sm text-rose-300 hover:text-rose-200 disabled:opacity-50"
                    disabled={isDeleting}
                    onClick={() => handleDelete(dataset)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <dl className="mt-5 grid gap-3 text-sm text-slate-400 sm:grid-cols-4">
              <div><dt className="text-slate-500">Category</dt><dd className="mt-1 text-slate-200">{dataset.category}</dd></div>
              <div><dt className="text-slate-500">Records</dt><dd className="mt-1 text-slate-200">{dataset.totalRecords.toLocaleString()}</dd></div>
              <div><dt className="text-slate-500">Created</dt><dd className="mt-1 text-slate-200">{dataset.createdAt ? new Date(dataset.createdAt).toLocaleDateString() : "—"}</dd></div>
              <div><dt className="text-slate-500">Updated</dt><dd className="mt-1 text-slate-200">{dataset.updatedAt ? new Date(dataset.updatedAt).toLocaleDateString() : "—"}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}
