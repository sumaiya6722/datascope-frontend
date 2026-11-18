"use client";

import { useDataScopeSession } from "../../../lib/use-data-scope-session.js";
import { hasPermission } from "../../../lib/permissions.js";
import { useGetAnalyticsQuery } from "../../../store/services/data-scope-api.js";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ChartPanel({
  title,
  data,
  dataKey,
  labelKey,
  trend = false,
  emptyMessage = "No recorded data yet.",
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {data.length ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            {trend ? (
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey={labelKey} stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Line dataKey={dataKey} stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey={labelKey} stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey={dataKey} fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : <p className="mt-8 text-sm text-slate-400">{emptyMessage}</p>}
    </section>
  );
}

export default function AnalyticsPage() {
  const { data: session, isPending } = useDataScopeSession();
  const canAnalyze = hasPermission(session?.user?.permissions, "dataset:analyze");
  const { data, error, isLoading } = useGetAnalyticsQuery(undefined, {
    skip: isPending || !session || !canAnalyze,
  });

  if (isPending || !session) {
    return <main className="mx-auto max-w-7xl px-6 py-12 text-slate-400">Loading analytics...</main>;
  }
  if (!canAnalyze) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Analytics unavailable</h1>
        <p className="mt-3 text-slate-400">Data Analyst or Administrator access is required.</p>
      </main>
    );
  }
  if (isLoading) {
    return <main className="mx-auto max-w-7xl px-6 py-12 text-slate-400">Loading dashboard...</main>;
  }
  if (error || !data) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Analytics unavailable</h1>
        <p className="mt-3 text-rose-300" role="alert">
          {error?.data?.message ?? error?.data?.error ?? "Could not load analytics."}
        </p>
      </main>
    );
  }

  const hasMetrics = data.totalRecords > 0 ||
    data.recordsByCategory.length ||
    data.recordsByStatus.length ||
    data.dataGrowth.length ||
    data.searchActivity.length ||
    data.frequentFilters.length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">DataScope</p>
      <h1 className="mt-3 text-3xl font-semibold">Analytics Dashboard</h1>
      <p className="mt-2 text-sm text-slate-400">
        Aggregated database records and recorded searches for datasets you can access.
      </p>
      {!hasMetrics && (
        <p className="mt-6 rounded-xl border border-dashed border-white/15 p-5 text-slate-400">
          No records or search activity are available for your accessible datasets.
        </p>
      )}
      <section className="mt-7 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm text-slate-400">Total records</p>
        <p className="mt-2 text-4xl font-semibold">{data.totalRecords.toLocaleString()}</p>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartPanel title="Records by category" data={data.recordsByCategory} dataKey="count" labelKey="category" />
        <ChartPanel title="Records by status" data={data.recordsByStatus} dataKey="count" labelKey="status" />
        <ChartPanel title="Data growth by month" data={data.dataGrowth} dataKey="count" labelKey="month" trend />
        <ChartPanel title="Search activity by date" data={data.searchActivity} dataKey="count" labelKey="date" trend />
        <ChartPanel
          title="Most frequently used filters"
          data={data.frequentFilters.map((filter) => ({
            ...filter,
            label: `${filter.field} · ${filter.operator}`,
          }))}
          dataKey="count"
          labelKey="label"
          emptyMessage="No filter usage has been recorded yet."
        />
      </section>
    </main>
  );
}
