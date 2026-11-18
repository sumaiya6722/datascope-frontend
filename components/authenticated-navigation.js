"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { authClient } from "../lib/auth-client.js";
import { hasPermission } from "../lib/permissions.js";
import { useDataScopeSession } from "../lib/use-data-scope-session.js";
import { dataScopeApi } from "../store/services/data-scope-api.js";
import { clearSafeUser, setSafeUser } from "../store/slices/authentication-slice.js";

export default function AuthenticatedNavigation() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: session, isPending } = useDataScopeSession();
  const [errorMessage, setErrorMessage] = useState("");
  const safeUser = useSelector((state) => state.authentication.user);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      dispatch(clearSafeUser());
      dispatch(dataScopeApi.util.resetApiState());
      return;
    }

    const activeUser = session.user;
    const role = activeUser.role ?? "viewer";
    const permissions = activeUser.permissions ?? [];

    dispatch(
      setSafeUser({
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        role,
        permissions,
      }),
    );
  }, [dispatch, isPending, session]);

  async function handleSignOut() {
    setErrorMessage("");
    let result;

    try {
      result = await authClient.signOut();
    } catch {
      setErrorMessage("Could not reach the authentication server. Please try again.");
      return;
    }

    if (result.error) {
      setErrorMessage(result.error.message ?? "Could not sign out. Please try again.");
      return;
    }

    dispatch(clearSafeUser());
    dispatch(dataScopeApi.util.resetApiState());
    router.replace("/login");
  }

  if (isPending || !session) {
    return null;
  }

  const navigationItems = [
    { href: "/app", label: "Workspace", permission: null },
    { href: "/app/datasets", label: "Datasets", permission: "dataset:read" },
    { href: "/app/analytics", label: "Analytics", permission: "dataset:analyze" },
    { href: "/app/admin", label: "Administration", permission: "analytics:admin" },
  ].filter(
    (item) => item.permission === null || hasPermission(safeUser?.permissions ?? session.user.permissions, item.permission),
  );

  return (
    <header className="border-b border-white/10">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
        <Link className="font-semibold text-white" href="/app">
          DataScope
        </Link>
        {navigationItems.slice(1).map((item) => (
          <Link className="text-sm text-slate-300 hover:text-white" href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
        <span className="ml-auto hidden text-sm text-slate-400 sm:inline">
          {safeUser?.name ?? session.user.name}
        </span>
        <button
          className="text-sm text-cyan-300 hover:text-cyan-200"
          onClick={handleSignOut}
          type="button"
        >
          Sign out
        </button>
      </nav>
      {errorMessage && (
        <p aria-live="polite" className="mx-auto max-w-5xl px-6 pb-3 text-sm text-rose-300">
          {errorMessage}
        </p>
      )}
    </header>
  );
}
