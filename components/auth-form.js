"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "../lib/auth-client.js";

export default function AuthForm({ mode }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegistration = mode === "register";

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const credentials = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const result = isRegistration
        ? await authClient.signUp.email({
            ...credentials,
            name: formData.get("name"),
          })
        : await authClient.signIn.email(credentials);

      if (result.error) {
        setErrorMessage(result.error.message ?? "Authentication failed. Please try again.");
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setErrorMessage("Could not reach the authentication server. Check that the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <Link className="text-sm text-cyan-300 hover:text-cyan-200" href="/">
          ← DataScope
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">
          {isRegistration ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {isRegistration
            ? "Sign up to access the DataScope workspace."
            : "Sign in to continue to your workspace."}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {isRegistration && (
            <label className="block text-sm text-slate-300">
              Name
              <input
                autoComplete="name"
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
                maxLength={100}
                name="name"
                required
              />
            </label>
          )}
          <label className="block text-sm text-slate-300">
            Email
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input
              autoComplete={isRegistration ? "new-password" : "current-password"}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>

          {errorMessage && (
            <p aria-live="polite" className="text-sm text-rose-300">
              {errorMessage}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? "Please wait..."
              : isRegistration
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          {isRegistration ? "Already have an account?" : "New to DataScope?"}{" "}
          <Link
            className="text-cyan-300 hover:text-cyan-200"
            href={isRegistration ? "/login" : "/register"}
          >
            {isRegistration ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
