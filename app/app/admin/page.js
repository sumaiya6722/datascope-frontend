"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useGetAdminAnalyticsQuery, useGetAdminUsersQuery, useUpdateUserRoleMutation } from "../../../store/services/data-scope-api.js";
import { useDataScopeSession } from "../../../lib/use-data-scope-session.js";
import { hasPermission } from "../../../lib/permissions.js";

export default function AdministrationPage() {
  const router = useRouter();
  const { data: session, isPending } = useDataScopeSession();
  const canManageUsers = hasPermission(session?.user.permissions, "user:manage");
  const {
    data: analytics,
    error: analyticsError,
    isLoading: isLoadingAnalytics,
  } = useGetAdminAnalyticsQuery(undefined, { skip: isPending || !session || !canManageUsers });
  const {
    data: usersResult,
    error: usersError,
    isLoading: isLoadingUsers,
  } = useGetAdminUsersQuery(undefined, { skip: isPending || !session || !canManageUsers });
  const [updateUserRole, { error: roleUpdateError, isLoading: isUpdatingRole }] =
    useUpdateUserRoleMutation();
  const users = usersResult?.users ?? [];
  const errorMessage =
    roleUpdateError?.data?.message ??
    roleUpdateError?.data?.error ??
    analyticsError?.data?.message ??
    analyticsError?.data?.error ??
    usersError?.data?.message ??
    usersError?.data?.error;

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, router, session]);

  if (isPending || !session) {
    return <main className="mx-auto max-w-5xl px-6 py-16 text-slate-400">Loading...</main>;
  }

  if (!hasPermission(session.user.permissions, "user:manage")) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Forbidden</h1>
        <p className="mt-3 text-slate-400">Administrator permission is required.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
        Administrator
      </p>
      <h1 className="mt-4 text-4xl font-semibold">Administration</h1>

      {errorMessage && (
        <p aria-live="polite" className="mt-6 text-sm text-rose-300">
          {errorMessage}
        </p>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {analytics
          ? Object.entries(analytics).map(([label, count]) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5" key={label}>
                <p className="text-sm capitalize text-slate-400">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{count}</p>
              </div>
            ))
          : <p className="text-sm text-slate-400">
              {isLoadingAnalytics ? "Loading administrative analytics..." : "No analytics available."}
            </p>}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">User access</h2>
        {isLoadingUsers && <p className="mt-4 text-sm text-slate-400">Loading users...</p>}
        <ul className="mt-5 divide-y divide-white/10">
          {users.map((user) => (
            <li className="flex flex-wrap items-center gap-4 py-4" key={user.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-white">{user.name}</p>
                <p className="truncate text-sm text-slate-400">{user.email}</p>
              </div>
              {user.role === "administrator" ? (
                <span className="text-sm text-slate-400">
                  Administrator (bootstrap-managed)
                </span>
              ) : (
                <select
                  aria-label={`Role for ${user.email}`}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  disabled={isUpdatingRole}
                  onChange={(event) =>
                    updateUserRole({ userId: user.id, role: event.target.value })
                  }
                  value={user.role}
                >
                  <option value="dataAnalyst">Data Analyst</option>
                  <option value="viewer">Viewer</option>
                </select>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
