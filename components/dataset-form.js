"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDataScopeSession } from "../lib/use-data-scope-session.js";
import {
  useCreateDatasetMutation,
  useGetDatasetQuery,
  useUpdateDatasetMutation,
} from "../store/services/data-scope-api.js";
import { hasPermission } from "../lib/permissions.js";

const blankDataset = {
  name: "",
  slug: "",
  description: "",
  category: "",
  dataSource: { name: "", type: "", description: "" },
};

function getErrorMessage(error, fallback) {
  return error?.data?.message ?? error?.data?.error ?? fallback;
}

function slugFromName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function DatasetForm({ datasetId = null }) {
  const router = useRouter();
  const { data: session, isPending: isCheckingSession } = useDataScopeSession();
  const isEditing = Boolean(datasetId);
  const {
    data: datasetResult,
    error: datasetError,
    isLoading: isLoadingDataset,
  } = useGetDatasetQuery(datasetId, { skip: !isEditing || !session });
  const [createDataset, { isLoading: isCreating }] = useCreateDatasetMutation();
  const [updateDataset, { isLoading: isUpdating }] = useUpdateDatasetMutation();
  const [form, setForm] = useState(blankDataset);
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [createdDatasetId, setCreatedDatasetId] = useState(null);
  const canManage = hasPermission(session?.user.permissions, "dataset:manage");

  useEffect(() => {
    if (!isCheckingSession && !session) {
      router.replace("/login");
    }
  }, [isCheckingSession, router, session]);

  useEffect(() => {
    if (datasetResult?.dataset) {
      const { name, slug, description, category, dataSource } = datasetResult.dataset;
      setForm({
        name,
        slug,
        description,
        category,
        dataSource: {
          name: dataSource?.name ?? "",
          type: dataSource?.type ?? "",
          description: dataSource?.description ?? "",
        },
      });
      setSlugWasEdited(true);
    }
  }, [datasetResult]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateDataSource(key, value) {
    setForm((current) => ({
      ...current,
      dataSource: { ...current.dataSource, [key]: value },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    const payload = {
      ...form,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      dataSource: {
        name: form.dataSource.name.trim(),
        type: form.dataSource.type.trim(),
        description: form.dataSource.description.trim(),
      },
    };

    try {
      if (isEditing) {
        await updateDataset({ datasetId, ...payload }).unwrap();
        setSuccessMessage("Dataset details saved successfully.");
      } else {
        const result = await createDataset(payload).unwrap();
        setCreatedDatasetId(result.dataset.id);
        setSuccessMessage("Dataset created successfully.");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not save this dataset."));
    }
  }

  if (isCheckingSession || !session || (isEditing && isLoadingDataset)) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-slate-400">Loading dataset form...</main>;
  }

  if (!canManage) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Forbidden</h1>
        <p className="mt-3 text-slate-400">Administrator permission is required to manage datasets.</p>
      </main>
    );
  }

  if (isEditing && (datasetError || !datasetResult?.dataset)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Could not load dataset</h1>
        <p role="alert" className="mt-3 text-rose-300">
          {getErrorMessage(datasetError, "Dataset not found or you do not have access.")}
        </p>
        <Link className="mt-6 inline-block text-cyan-300" href="/app/datasets">Back to datasets</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link className="text-sm text-cyan-300 hover:text-cyan-200" href="/app/datasets">
        Back to datasets
      </Link>
      <p className="mt-8 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
        {isEditing ? "Dataset settings" : "New dataset"}
      </p>
      <h1 className="mt-3 text-4xl font-semibold">{isEditing ? "Edit dataset" : "Create dataset"}</h1>

      {errorMessage && <p role="alert" className="mt-6 text-sm text-rose-300">{errorMessage}</p>}
      {successMessage && (
        <div role="status" className="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
          {successMessage}
          {createdDatasetId && (
            <Link className="ml-2 underline" href={`/app/datasets/${createdDatasetId}`}>Open dataset</Link>
          )}
        </div>
      )}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block text-sm text-slate-300">
          Dataset name
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
            maxLength={160}
            minLength={2}
            onChange={(event) => {
              const name = event.target.value;
              setForm((current) => ({
                ...current,
                name,
                slug: slugWasEdited ? current.slug : slugFromName(name),
              }));
            }}
            required
            value={form.name}
          />
        </label>

        <label className="block text-sm text-slate-300">
          URL slug
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
            maxLength={180}
            onChange={(event) => {
              setSlugWasEdited(true);
              updateForm("slug", event.target.value.toLowerCase());
            }}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
            value={form.slug}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Category
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
            maxLength={100}
            onChange={(event) => updateForm("category", event.target.value)}
            required
            value={form.category}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Description
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
            maxLength={2000}
            onChange={(event) => updateForm("description", event.target.value)}
            value={form.description}
          />
        </label>

        <fieldset className="space-y-4 rounded-xl border border-white/10 p-5">
          <legend className="px-2 font-medium text-white">Data source</legend>
          <label className="block text-sm text-slate-300">
            Source name
            <input
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
              maxLength={120}
              onChange={(event) => updateDataSource("name", event.target.value)}
              required
              value={form.dataSource.name}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Source type
            <input
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
              maxLength={80}
              onChange={(event) => updateDataSource("type", event.target.value)}
              placeholder="For example: CSV, MongoDB, CRM"
              required
              value={form.dataSource.type}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Source description
            <textarea
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white"
              maxLength={500}
              onChange={(event) => updateDataSource("description", event.target.value)}
              value={form.dataSource.description}
            />
          </label>
        </fieldset>

        <button
          className="rounded-lg bg-cyan-400 px-5 py-2 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
          disabled={isCreating || isUpdating}
          type="submit"
        >
          {isCreating || isUpdating ? "Saving..." : isEditing ? "Save changes" : "Create dataset"}
        </button>
      </form>
    </main>
  );
}
