"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "../../../../lib/auth-client.js";
import { hasPermission } from "../../../../lib/permissions.js";
import {
  useCreateDatasetFieldMutation,
  useDeleteDatasetFieldMutation,
  useGetAdminUsersQuery,
  useGetDatasetFieldsQuery,
  useGetDatasetPermissionsQuery,
  useGetDatasetQuery,
  useRevokeDatasetPermissionMutation,
  useSetDatasetPermissionMutation,
  useUpdateDatasetFieldMutation,
} from "../../../../store/services/data-scope-api.js";

const initialField = {
  name: "",
  label: "",
  dataType: "string",
  searchable: false,
  filterable: false,
  sortable: false,
  visibleByDefault: true,
};

function getErrorMessage(error, fallback) {
  return error?.data?.message ?? error?.data?.error ?? fallback;
}

function FieldOptions({ value, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        ["searchable", "Searchable"],
        ["filterable", "Filterable"],
        ["sortable", "Sortable"],
        ["visibleByDefault", "Visible by default"],
      ].map(([key, label]) => (
        <label className="flex items-center gap-2 text-sm text-slate-300" key={key}>
          <input
            checked={value[key]}
            onChange={(event) => onChange(key, event.target.checked)}
            type="checkbox"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export default function DatasetDetailsPage() {
  const { datasetId } = useParams();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const canManage = hasPermission(session?.user.role, "dataset:manage");
  const {
    data: datasetResult,
    error: datasetError,
    isLoading: isLoadingDataset,
  } = useGetDatasetQuery(datasetId, { skip: isPending || !session });
  const {
    data: fieldsResult,
    error: fieldsError,
    isLoading: isLoadingFields,
  } = useGetDatasetFieldsQuery(datasetId, { skip: isPending || !session });
  const {
    data: usersResult,
    error: usersError,
    isLoading: isLoadingUsers,
  } = useGetAdminUsersQuery(undefined, { skip: !canManage });
  const {
    data: permissionsResult,
    error: permissionsError,
    isLoading: isLoadingPermissions,
  } = useGetDatasetPermissionsQuery(datasetId, { skip: !canManage });
  const [createField, { isLoading: isCreatingField }] = useCreateDatasetFieldMutation();
  const [updateField, { isLoading: isUpdatingField }] = useUpdateDatasetFieldMutation();
  const [deleteField] = useDeleteDatasetFieldMutation();
  const [setPermission, { isLoading: isSavingPermission }] = useSetDatasetPermissionMutation();
  const [revokePermission] = useRevokeDatasetPermissionMutation();
  const [newField, setNewField] = useState(initialField);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newPermissions, setNewPermissions] = useState(["read"]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, router, session]);

  const dataset = datasetResult?.dataset;
  const fields = fieldsResult?.fields ?? [];
  const users = usersResult?.users ?? [];
  const grants = permissionsResult?.permissions ?? [];

  function updateNewField(key, value) {
    setNewField((current) => ({ ...current, [key]: value }));
  }

  function togglePermission(value) {
    setNewPermissions((current) =>
      current.includes(value)
        ? current.filter((permission) => permission !== value)
        : [...current, value],
    );
  }

  async function handleCreateField(event) {
    event.preventDefault();
    setErrorMessage("");
    setMessage("");
    try {
      await createField({ datasetId, ...newField }).unwrap();
      setNewField(initialField);
      setMessage("Dataset field added.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not add the dataset field."));
    }
  }

  async function handleUpdateField(event, field) {
    event.preventDefault();
    setErrorMessage("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const updates = {
      name: formData.get("name"),
      label: formData.get("label"),
      dataType: formData.get("dataType"),
      searchable: formData.get("searchable") === "on",
      filterable: formData.get("filterable") === "on",
      sortable: formData.get("sortable") === "on",
      visibleByDefault: formData.get("visibleByDefault") === "on",
    };
    try {
      await updateField({ datasetId, fieldId: field.id, ...updates }).unwrap();
      setMessage(`Field "${updates.label}" updated.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not update the dataset field."));
    }
  }

  async function handleDeleteField(field) {
    if (!window.confirm(`Delete the "${field.label}" field definition?`)) return;
    setErrorMessage("");
    setMessage("");
    try {
      await deleteField({ datasetId, fieldId: field.id }).unwrap();
      setMessage(`Field "${field.label}" deleted.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not delete the dataset field."));
    }
  }

  async function handleSavePermission(event) {
    event.preventDefault();
    if (!selectedUserId || newPermissions.length === 0) {
      setErrorMessage("Select a user and at least one permission.");
      return;
    }
    setErrorMessage("");
    setMessage("");
    try {
      await setPermission({
        datasetId,
        userId: selectedUserId,
        permissions: newPermissions,
      }).unwrap();
      setMessage("Dataset access permissions saved.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not save dataset permissions."));
    }
  }

  async function handleRevokePermission(grant) {
    if (!window.confirm(`Revoke dataset access for ${grant.email || grant.name}?`)) return;
    setErrorMessage("");
    setMessage("");
    try {
      await revokePermission({ datasetId, userId: grant.userId }).unwrap();
      setMessage(`Access revoked for ${grant.email || grant.name}.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not revoke dataset access."));
    }
  }

  if (isPending || !session || isLoadingDataset) {
    return <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">Loading dataset...</main>;
  }

  if (datasetError || !dataset) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Dataset unavailable</h1>
        <p role="alert" className="mt-4 text-rose-300">
          {getErrorMessage(datasetError, "Dataset not found or you are not authorized to view it.")}
        </p>
        <Link className="mt-6 inline-block text-cyan-300" href="/app/datasets">Back to datasets</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link className="text-sm text-cyan-300 hover:text-cyan-200" href="/app/datasets">
        Back to dataset library
      </Link>
      <div className="mt-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">{dataset.category}</p>
          <h1 className="mt-3 text-4xl font-semibold">{dataset.name}</h1>
          <p className="mt-3 max-w-3xl text-slate-400">{dataset.description || "No description provided."}</p>
        </div>
        {canManage && (
          <div className="flex gap-3">
            <Link
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
              href={`/app/datasets/${datasetId}/explore`}
            >
              Open Data Explorer
            </Link>
            <Link
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              href={`/app/datasets/${datasetId}/edit`}
            >
              Edit details
            </Link>
          </div>
        )}
        {!canManage && (
          <Link
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            href={`/app/datasets/${datasetId}/explore`}
          >
            Open Data Explorer
          </Link>
        )}
      </div>

      {message && <p role="status" className="mt-6 text-sm text-emerald-300">{message}</p>}
      {errorMessage && <p role="alert" className="mt-6 text-sm text-rose-300">{errorMessage}</p>}
      {datasetError && <p role="alert" className="mt-6 text-sm text-rose-300">{getErrorMessage(datasetError, "Could not refresh dataset details.")}</p>}

      <section className="mt-8 grid gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-sm text-slate-500">Records</p><p className="mt-1 text-xl font-semibold">{dataset.totalRecords.toLocaleString()}</p></div>
        <div><p className="text-sm text-slate-500">Data source</p><p className="mt-1 font-medium">{dataset.dataSource?.name} ({dataset.dataSource?.type})</p></div>
        <div><p className="text-sm text-slate-500">Created</p><p className="mt-1 font-medium">{dataset.createdAt ? new Date(dataset.createdAt).toLocaleString() : "—"}</p></div>
        <div><p className="text-sm text-slate-500">Last updated</p><p className="mt-1 font-medium">{dataset.updatedAt ? new Date(dataset.updatedAt).toLocaleString() : "—"}</p></div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Dataset fields</h2>
        <p className="mt-2 text-sm text-slate-400">Field definitions describe available columns. Record exploration will be added separately.</p>
        {fieldsError && <p role="alert" className="mt-4 text-sm text-rose-300">{getErrorMessage(fieldsError, "Could not load fields.")}</p>}
        {isLoadingFields && <p className="mt-4 text-sm text-slate-400">Loading fields...</p>}
        {!isLoadingFields && !fields.length && !fieldsError && (
          <p className="mt-4 rounded-lg border border-dashed border-white/15 p-5 text-sm text-slate-400">No fields have been defined for this dataset.</p>
        )}

        <ul className="mt-4 space-y-3">
          {fields.map((field) => (
            <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={field.id}>
              {canManage ? (
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                    <span className="font-medium">{field.label} <span className="ml-2 text-sm font-normal text-slate-400">({field.name} · {field.dataType})</span></span>
                    <span className="text-xs text-slate-500">
                      {[field.searchable && "search", field.filterable && "filter", field.sortable && "sort"].filter(Boolean).join(" · ") || "no explorer options"}
                    </span>
                  </summary>
                  <form className="mt-5 space-y-4 border-t border-white/10 pt-4" onSubmit={(event) => handleUpdateField(event, field)}>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="text-sm text-slate-300">Field name<input className="mt-1 w-full rounded border border-white/10 bg-slate-950 p-2" defaultValue={field.name} maxLength={80} name="name" pattern="[A-Za-z][A-Za-z0-9_]{0,79}" required /></label>
                      <label className="text-sm text-slate-300">Label<input className="mt-1 w-full rounded border border-white/10 bg-slate-950 p-2" defaultValue={field.label} maxLength={80} name="label" required /></label>
                      <label className="text-sm text-slate-300">Data type<select className="mt-1 w-full rounded border border-white/10 bg-slate-950 p-2" defaultValue={field.dataType} name="dataType">{["string", "number", "date", "boolean", "email", "phone", "currency", "object"].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["searchable", "Searchable", field.searchable],
                        ["filterable", "Filterable", field.filterable],
                        ["sortable", "Sortable", field.sortable],
                        ["visibleByDefault", "Visible by default", field.visibleByDefault],
                      ].map(([name, label, checked]) => (
                        <label className="flex items-center gap-2 text-sm text-slate-300" key={name}>
                          <input defaultChecked={checked} name={name} type="checkbox" />{label}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-4">
                      <button className="rounded bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={isUpdatingField} type="submit">Save field</button>
                      <button className="text-sm text-rose-300" onClick={() => handleDeleteField(field)} type="button">Delete field</button>
                    </div>
                  </form>
                </details>
              ) : (
                <div className="flex flex-wrap justify-between gap-3">
                  <span className="font-medium">{field.label} <span className="ml-2 text-sm font-normal text-slate-400">({field.name})</span></span>
                  <span className="text-sm text-slate-400">{field.dataType}</span>
                </div>
              )}
            </li>
          ))}
        </ul>

        {canManage && (
          <form className="mt-6 space-y-4 rounded-xl border border-white/10 p-5" onSubmit={handleCreateField}>
            <h3 className="font-semibold">Add a field</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm text-slate-300">Field name<input className="mt-1 w-full rounded border border-white/10 bg-slate-950 p-2" maxLength={80} onChange={(event) => updateNewField("name", event.target.value)} pattern="[A-Za-z][A-Za-z0-9_]{0,79}" required value={newField.name} /></label>
              <label className="text-sm text-slate-300">Label<input className="mt-1 w-full rounded border border-white/10 bg-slate-950 p-2" maxLength={80} onChange={(event) => updateNewField("label", event.target.value)} required value={newField.label} /></label>
              <label className="text-sm text-slate-300">Data type<select className="mt-1 w-full rounded border border-white/10 bg-slate-950 p-2" onChange={(event) => updateNewField("dataType", event.target.value)} value={newField.dataType}>{["string", "number", "date", "boolean", "email", "phone", "currency", "object"].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            </div>
            <FieldOptions value={newField} onChange={updateNewField} />
            <button className="rounded bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={isCreatingField} type="submit">{isCreatingField ? "Adding..." : "Add field"}</button>
          </form>
        )}
      </section>

      {canManage && (
        <section className="mt-14 border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold">Dataset access</h2>
          <p className="mt-2 text-sm text-slate-400">Grant read and export access to registered users. The backend checks each grant on every request.</p>
          {permissionsError && <p role="alert" className="mt-4 text-sm text-rose-300">{getErrorMessage(permissionsError, "Could not load access permissions.")}</p>}
          {isLoadingPermissions && <p className="mt-4 text-sm text-slate-400">Loading permissions...</p>}
          {!isLoadingPermissions && !grants.length && !permissionsError && (
            <p className="mt-4 text-sm text-slate-400">No users have explicit access grants. Administrators can still access all datasets.</p>
          )}
          <ul className="mt-4 space-y-3">
            {grants.map((grant) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-4" key={grant.userId}>
                <div>
                  <p className="font-medium">{grant.name}</p>
                  <p className="text-sm text-slate-400">{grant.email} · {grant.role}</p>
                  <p className="mt-1 text-xs text-cyan-300">{grant.permissions.join(", ")}</p>
                </div>
                <button className="text-sm text-rose-300 disabled:opacity-50" disabled={isSavingPermission} onClick={() => handleRevokePermission(grant)} type="button">Revoke</button>
              </li>
            ))}
          </ul>

          <form className="mt-6 space-y-4 rounded-xl border border-white/10 p-5" onSubmit={handleSavePermission}>
            <h3 className="font-semibold">Grant or update access</h3>
            {usersError && <p role="alert" className="text-sm text-rose-300">{getErrorMessage(usersError, "Could not load users.")}</p>}
            <label className="block text-sm text-slate-300">
              User
              <select
                className="mt-2 w-full rounded border border-white/10 bg-slate-950 p-2"
                disabled={isLoadingUsers}
                onChange={(event) => {
                  const userId = event.target.value;
                  setSelectedUserId(userId);
                  const existingGrant = grants.find((grant) => grant.userId === userId);
                  setNewPermissions(existingGrant?.permissions ?? ["read"]);
                }}
                required
                value={selectedUserId}
              >
                <option value="">Select a registered user</option>
                {users.filter((user) => user.role !== "administrator").map((user) => (
                  <option key={user.id} value={user.id}>{user.name} — {user.email} ({user.role})</option>
                ))}
              </select>
            </label>
            <div className="flex gap-6">
              {["read", "export"].map((permission) => (
                <label className="flex items-center gap-2 text-sm text-slate-300" key={permission}>
                  <input checked={newPermissions.includes(permission)} onChange={() => togglePermission(permission)} type="checkbox" />
                  {permission === "read" ? "Read dataset" : "Export records"}
                </label>
              ))}
            </div>
            <button className="rounded bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={isSavingPermission || !selectedUserId || !newPermissions.length} type="submit">{isSavingPermission ? "Saving..." : "Save access"}</button>
          </form>
        </section>
      )}
    </main>
  );
}
