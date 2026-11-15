"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { authClient } from "../../lib/auth-client.js";
import { hasPermission } from "../../lib/permissions.js";

export default function ApplicationPage() {
  const router = useRouter();
  const { data: session, error, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, router, session]);

  if (isPending || !session) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p aria-live="polite" className="text-slate-400">
          {error ? "Checking your sign-in..." : "Loading your workspace..."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
        Protected workspace
      </p>
      <h1 className="mt-4 text-4xl font-semibold">
        Welcome, {session.user.name}.
      </h1>
      <p className="mt-4 text-slate-400">
        You are signed in as a {session.user.role ?? "viewer"}. Your authenticated
        workspace navigation reflects your current permissions.
      </p>
      {hasPermission(session.user.role, "dataset:read") && (
        <p className="mt-4 text-sm text-slate-300">
          You can browse datasets you are authorized to access.
        </p>
      )}
      {hasPermission(session.user.role, "dataset:search:advanced") && (
        <p className="mt-2 text-sm text-slate-300">
          Advanced search and multi-filter analysis are available to your role.
        </p>
      )}
    </main>
  );
}
