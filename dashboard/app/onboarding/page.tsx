"use client";

import { getBrowserClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  checkTelegramLinked,
  createBusiness,
  generateConnectCode,
  updateBusinessProfile,
  uploadLogo,
} from "./actions";

const STAGES = [
  "Account created",
  "Set up business",
  "Complete profile",
  "Connect Telegram",
  "You're live!",
];

function StageIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STAGES.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              i < current
                ? "bg-gray-900 text-white"
                : i === current
                ? "bg-gray-900 text-white"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </div>
          {i < STAGES.length - 1 && (
            <div className={`h-0.5 w-8 ${i < current ? "bg-gray-900" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string>("");
  const [businessId, setBusinessId] = useState<string>("");
  const [connectCode, setConnectCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) setUserId(data.user.id);
      });
    // Auto-advance past stage 1 after 1.5s
    const t = setTimeout(() => setStep(1), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (step === 3 && businessId) {
      pollRef.current = setInterval(async () => {
        const linked = await checkTelegramLinked(businessId);
        if (linked) {
          clearInterval(pollRef.current!);
          setStep(4);
        }
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, businessId]);

  async function handleBusinessSetup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const vatRateRaw = Number(fd.get("vatRate"));
      const id = await createBusiness(userId, {
        name: fd.get("name") as string,
        currency: fd.get("currency") as string,
        address: fd.get("address") as string,
        vatRate: Number.isFinite(vatRateRaw) ? Math.min(Math.max(vatRateRaw, 0), 100) : 0,
      });
      setBusinessId(id);
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  async function handleProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      let logoUrl: string | null = null;
      const logoFile = fd.get("logo") as File | null;
      if (logoFile && logoFile.size > 0) {
        const logoForm = new FormData();
        logoForm.append("logo", logoFile);
        logoUrl = await uploadLogo(businessId, logoForm);
      }
      await updateBusinessProfile(businessId, {
        bankName: fd.get("bankName") as string,
        bankAccountName: fd.get("bankAccountName") as string,
        bankAccountNumber: fd.get("bankAccountNumber") as string,
        logoUrl: logoUrl ?? undefined,
      });
      const code = await generateConnectCode(businessId, userId);
      setConnectCode(code);
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";
  const btnCls =
    "w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Set up your business
        </p>
        <StageIndicator current={step} />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        {/* Stage 1 — account created */}
        {step === 0 && (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-xl font-bold text-gray-900">Account created!</h2>
            <p className="text-gray-500 text-sm mt-1">Setting up your workspace…</p>
          </div>
        )}

        {/* Stage 2 — business setup */}
        {step === 1 && (
          <form onSubmit={handleBusinessSetup} className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Set up your business</h2>
            <div>
              <label className={labelCls}>Business name</label>
              <input name="name" required className={inputCls} placeholder="Acme Ltd" />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select name="currency" defaultValue="GBP" className={inputCls}>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="NGN">NGN — Nigerian Naira (₦)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>VAT / tax rate (%)</label>
              <input
                name="vatRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue="0"
                className={inputCls}
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Applied by default to invoices you create — you can override it per invoice.
              </p>
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input name="address" required className={inputCls} placeholder="London, United Kingdom" />
            </div>
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? "Saving…" : "Continue →"}
            </button>
          </form>
        )}

        {/* Stage 3 — profile */}
        {step === 2 && (
          <form onSubmit={handleProfile} className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Complete your profile</h2>
            <div>
              <label className={labelCls}>Logo (optional)</label>
              <input name="logo" type="file" accept="image/*" className="w-full text-sm text-gray-600" />
            </div>
            <div>
              <label className={labelCls}>Bank name</label>
              <input name="bankName" className={inputCls} placeholder="Barclays" />
            </div>
            <div>
              <label className={labelCls}>Account name</label>
              <input name="bankAccountName" className={inputCls} placeholder="Acme Ltd" />
            </div>
            <div>
              <label className={labelCls}>Account number</label>
              <input name="bankAccountNumber" className={inputCls} placeholder="12345678" />
            </div>
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? "Saving…" : "Continue →"}
            </button>
          </form>
        )}

        {/* Stage 4 — connect Telegram */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Telegram</h2>
            <p className="text-sm text-gray-500 mb-6">
              Open Telegram, find your bot, and send this code:
            </p>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center mb-6">
              <p className="text-4xl font-mono font-bold tracking-widest text-gray-900">
                {connectCode}
              </p>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Waiting for you to send the code in Telegram…
            </p>
            <div className="mt-4 flex justify-center">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stage 5 — live */}
        {step === 4 && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re live!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Your bot is connected and ready. Open Telegram and send your first invoice request.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className={btnCls}
            >
              Go to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
