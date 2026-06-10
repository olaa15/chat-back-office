"use client";

import { getBrowserClient } from "@/lib/supabase-client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  const inputCls =
    "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint transition-shadow focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="mb-8">
        <Logo tone="light" />
      </div>

      <div className="w-full max-w-sm">
        {sent ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-ink">Check your email</h2>
            <p className="mt-2 text-sm text-ink-muted">
              We sent a password reset link to <strong>{email}</strong>. Click the link to set a new
              password.
            </p>
            <p className="mt-3 text-xs text-ink-faint">Didn&apos;t receive it? Check your spam folder.</p>
            <Link
              href="/login"
              className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              Reset your password
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="you@example.com"
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
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-muted">
              Remember your password?{" "}
              <Link href="/login" className="font-medium text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
