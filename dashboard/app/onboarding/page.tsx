"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand";
import { COUNTRY_LIST, getCountryFormat } from "@/lib/countryFormats";
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

const CURRENCY_OPTIONS = [
  { value: "GBP", label: "GBP — British Pound (£)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "NGN", label: "NGN — Nigerian Naira (₦)" },
  { value: "GHS", label: "GHS — Ghanaian Cedi (₵)" },
  { value: "CAD", label: "CAD — Canadian Dollar (CA$)" },
  { value: "AUD", label: "AUD — Australian Dollar (A$)" },
];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StageIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STAGES.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              i < current
                ? "bg-brand text-white"
                : i === current
                ? "bg-brand text-white"
                : "bg-line text-ink-faint"
            }`}
          >
            {i < current ? <CheckIcon /> : i + 1}
          </div>
          {i < STAGES.length - 1 && (
            <div
              className={`h-0.5 w-8 transition-colors ${i < current ? "bg-brand" : "bg-line"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [businessId, setBusinessId] = useState<string>("");
  const [country, setCountry] = useState<string>("GB");
  const [connectCode, setConnectCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const countryFormat = getCountryFormat(country);

  useEffect(() => {
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
    const vatRateRaw = Number(fd.get("vatRate"));
    const selectedCountry = fd.get("country") as string;
    const result = await createBusiness({
      name: fd.get("name") as string,
      currency: fd.get("currency") as string,
      address: fd.get("address") as string,
      country: selectedCountry || "GB",
      vatRate: Number.isFinite(vatRateRaw) ? Math.min(Math.max(vatRateRaw, 0), 100) : 0,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setBusinessId(result.data);
      setStep(2);
    }
    setLoading(false);
  }

  async function handleProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    let logoUrl: string | null = null;
    const logoFile = fd.get("logo") as File | null;
    if (logoFile && logoFile.size > 0) {
      const logoForm = new FormData();
      logoForm.append("logo", logoFile);
      const logoResult = await uploadLogo(businessId, logoForm);
      if (!logoResult.ok) {
        setError(logoResult.error);
        setLoading(false);
        return;
      }
      logoUrl = logoResult.data;
    }

    const profileResult = await updateBusinessProfile(businessId, country, {
      bankName: (fd.get("bank_name") as string) || undefined,
      bankAccountName: (fd.get("bank_account_name") as string) || undefined,
      bankAccountNumber: (fd.get("bank_account_number") as string) || undefined,
      bankSortCode: (fd.get("bank_sort_code") as string) || undefined,
      bankRoutingNumber: (fd.get("bank_routing_number") as string) || undefined,
      bankAccountType: (fd.get("bank_account_type") as string) || undefined,
      bankInstitutionNo: (fd.get("bank_institution_no") as string) || undefined,
      bankTransitNo: (fd.get("bank_transit_no") as string) || undefined,
      bankBsb: (fd.get("bank_bsb") as string) || undefined,
      bankBranchCode: (fd.get("bank_branch_code") as string) || undefined,
      bankIban: (fd.get("bank_iban") as string) || undefined,
      bankSwiftBic: (fd.get("bank_swift_bic") as string) || undefined,
      mobileMoneyProvider: (fd.get("mobile_money_provider") as string) || undefined,
      mobileMoneyNumber: (fd.get("mobile_money_number") as string) || undefined,
      logoUrl: logoUrl ?? undefined,
    });
    if (!profileResult.ok) {
      setError(profileResult.error);
      setLoading(false);
      return;
    }

    const codeResult = await generateConnectCode(businessId);
    if (!codeResult.ok) {
      setError(codeResult.error);
    } else {
      setConnectCode(codeResult.data);
      setStep(3);
    }
    setLoading(false);
  }

  const inputCls =
    "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint transition-shadow focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";
  const labelCls = "mb-1.5 block text-sm font-medium text-ink";
  const btnCls =
    "w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgba(4,120,87,0.7)] transition-colors hover:bg-brand-strong disabled:opacity-50";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo tone="light" />
      </div>

      <div
        className="w-full max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-8"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-2">
          Set up your business
        </p>
        <StageIndicator current={step} />

        {error && (
          <p className="rounded-lg bg-overdue-bg px-3 py-2 text-sm text-overdue-fg mb-4">
            {error}
          </p>
        )}

        {/* Stage 1 — account created */}
        {step === 0 && (
          <div className="text-center py-6">
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
            <h2 className="font-display text-xl font-semibold text-ink">Account created!</h2>
            <p className="mt-1 text-sm text-ink-muted">Setting up your workspace…</p>
          </div>
        )}

        {/* Stage 2 — business setup */}
        {step === 1 && (
          <form onSubmit={handleBusinessSetup} className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-ink mb-4">
              Set up your business
            </h2>
            <div>
              <label className={labelCls}>Business name</label>
              <input name="name" required className={inputCls} placeholder="Acme Ltd" />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <select
                name="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputCls}
              >
                {COUNTRY_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select
                name="currency"
                defaultValue={countryFormat.defaultCurrency}
                className={inputCls}
                key={countryFormat.defaultCurrency}
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
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
              <p className="mt-1 text-xs text-ink-faint">
                Applied by default to invoices you create — you can override it per invoice.
              </p>
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input
                name="address"
                required
                className={inputCls}
                placeholder="London, United Kingdom"
              />
            </div>
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? "Saving…" : "Continue →"}
            </button>
          </form>
        )}

        {/* Stage 3 — profile */}
        {step === 2 && (
          <form onSubmit={handleProfile} className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-ink mb-4">
              Complete your profile
            </h2>
            <div>
              <label className={labelCls}>Logo (optional)</label>
              <input
                name="logo"
                type="file"
                accept="image/*"
                className="w-full text-sm text-ink-muted"
              />
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint pt-2">
              Bank details (optional)
            </p>
            {countryFormat.bankFields.map((field) => (
              <div key={field.key}>
                <label className={labelCls}>{field.label}</label>
                {field.type === "select" && field.options ? (
                  <select name={field.key} className={inputCls}>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt || "— none —"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input name={field.key} className={inputCls} placeholder="" />
                )}
              </div>
            ))}

            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? "Saving…" : "Continue →"}
            </button>
          </form>
        )}

        {/* Stage 4 — connect Telegram */}
        {step === 3 && (
          <div>
            <h2 className="font-display text-xl font-semibold text-ink mb-2">
              Connect Telegram
            </h2>
            <p className="text-sm text-ink-muted mb-6">
              Open Telegram, find your bot, and send this code:
            </p>
            <div className="rounded-xl border border-brand/20 bg-brand-soft p-6 text-center mb-6">
              <p className="font-mono text-4xl font-bold tracking-widest text-brand-ink">
                {connectCode}
              </p>
            </div>
            <p className="text-xs text-ink-faint text-center">
              Waiting for you to send the code in Telegram…
            </p>
            <div className="mt-4 flex justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-brand animate-bounce"
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
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="m5 12 4.5 4.5L19 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-semibold text-ink mb-2">
              You&apos;re live!
            </h2>
            <p className="text-sm text-ink-muted mb-6">
              Your bot is connected and ready. Open Telegram and send your first invoice request.
            </p>
            <button onClick={() => router.push("/dashboard")} className={btnCls}>
              Go to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
