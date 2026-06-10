"use client";

import { getBrowserClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase puts the recovery token in the URL hash. We wait for it to be
  // exchanged for a session before allowing the form to submit.
  useEffect(() => {
    const supabase = getBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = getBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  const inputCls =
    "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint transition-shadow focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="mb-8">
        <Logo tone="light" />
      </div>

      <div className="w-full max-w-sm">
        {done ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="m5 12 4.5 4.5L19 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-ink">Password updated</h2>
            <p className="mt-2 text-sm text-ink-muted">Redirecting you to the dashboard…</p>
          </div>
        ) : !ready ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <p className="text-sm text-ink-muted">
              This link is invalid or has expired.{" "}
              <Link href="/forgot-password" className="font-medium text-brand hover:underline">
                Request a new one.
              </Link>
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              Set a new password
            </h1>
            <p className="mt-1 text-sm text-ink-muted">Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-overdue-bg px-3 py-2 text-sm text-overdue-fg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgba(4,120,87,0.7)] transition-colors hover:bg-brand-strong disabled:opacity-50"
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
