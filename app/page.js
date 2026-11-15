"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [connection, setConnection] = useState({
    status: "checking",
    message: "Checking the Express API and database...",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function checkBackend() {
      try {
        const response = await fetch(`${apiUrl}/api/health`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            `API returned ${response.status}: ${result.database ?? "health check failed"}.`,
          );
        }

        setConnection({
          status: "connected",
          message: `API connected · MongoDB ${result.database}.`,
        });
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setConnection({
          status: "error",
          message: `Could not connect to the backend: ${error.message}`,
        });
      }
    }

    checkBackend();

    return () => controller.abort();
  }, []);

  const isConnected = connection.status === "connected";
  const isChecking = connection.status === "checking";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-3xl">
        <div className="mb-16 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-300 font-bold text-slate-950">
            D
          </div>
          <span className="text-lg font-semibold tracking-wide">DataScope</span>
          <div className="ml-auto flex items-center gap-4">
            <Link className="text-sm text-slate-300 hover:text-white" href="/login">
              Sign in
            </Link>
            <Link
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              href="/register"
            >
              Create account
            </Link>
          </div>
        </div>

        <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">
          Enterprise data discovery
        </p>
        <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Your data, brought into focus.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
          Discover and understand your enterprise data. Sign in to your
          DataScope workspace or create an account to get started.
        </p>

        <div
          aria-live="polite"
          className="mt-10 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4"
        >
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full ${
              isChecking
                ? "animate-pulse bg-amber-300"
                : isConnected
                  ? "bg-emerald-400"
                  : "bg-rose-400"
            }`}
          />
          <p className="text-sm text-slate-300">{connection.message}</p>
        </div>

        <p className="mt-5 text-xs text-slate-500">
          Backend endpoint: {apiUrl}/api/health
        </p>
      </section>
    </main>
  );
}
