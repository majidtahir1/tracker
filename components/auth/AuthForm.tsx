"use client";

import { useState } from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({
            name: username,
            username,
            email: `${username.toLowerCase()}@tracker.local`,
            password,
          })
        : await authClient.signIn.username({ username, password });
    if (res.error) {
      setError(res.error.message ?? "Something went wrong.");
      setPending(false);
      return;
    }
    // Full navigation so the root layout re-renders with the session.
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Dumbbell className="size-6 text-accent" strokeWidth={2} />
          <span className="font-display text-lg font-semibold text-text tracking-tight">TRACKER</span>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-sm border border-border bg-bg-subtle p-6">
          <h1 className="font-display text-base font-semibold text-text">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-xs font-medium text-text-3">Username</label>
            <input
              id="username" value={username} onChange={(e) => setUsername(e.target.value)}
              required minLength={3} maxLength={30} autoComplete="username"
              pattern="[a-zA-Z0-9_.]+" title="Letters, numbers, underscores and dots only"
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-text-3">Password</label>
            <input
              id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={8} maxLength={128}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="submit" disabled={pending}
            className="w-full rounded-sm bg-accent px-3 py-2 text-sm font-medium text-accent-text disabled:opacity-50"
          >
            {pending ? "…" : mode === "login" ? "Sign in" : "Sign up"}
          </button>
          <p className="text-xs text-text-3">
            {mode === "login" ? (
              <>No account? <Link className="text-accent" href="/signup">Sign up</Link></>
            ) : (
              <>Have an account? <Link className="text-accent" href="/login">Sign in</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
