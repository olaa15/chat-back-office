"use client";

import { useActionState, useRef, useState } from "react";
import { COUNTRY_LIST, getCountryFormat } from "@/lib/countryFormats";
import { saveBusinessSettings, uploadSettingsLogo, generateTelegramCode } from "./actions";

const CURRENCY_OPTIONS = [
  { value: "GBP", label: "GBP — British Pound (£)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "NGN", label: "NGN — Nigerian Naira (₦)" },
  { value: "GHS", label: "GHS — Ghanaian Cedi (₵)" },
  { value: "CAD", label: "CAD — Canadian Dollar (CA$)" },
  { value: "AUD", label: "AUD — Australian Dollar (A$)" },
];

interface Settings {
  businessId: string;
  name: string;
  address: string;
  currency: string;
  vatRate: number;
  country: string;
  logoUrl: string;
  bankName: string;
  bankAccountName: string;
  bankAccountType: string;
  bankSwiftBic: string;
  mobileMoneyProvider: string;
}

export default function SettingsForm({ settings }: { settings: Settings }) {
  const [country, setCountry] = useState(settings.country);
  const [state, action, pending] = useActionState(saveBusinessSettings, null);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const countryFormat = getCountryFormat(country);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoError(null);
    const fd = new FormData();
    fd.append("logo", file);
    const result = await uploadSettingsLogo(fd);
    if (result.ok) {
      setLogoUrl(result.data);
    } else {
      setLogoError(result.error);
    }
    setLogoUploading(false);
  }

  const inputCls =
    "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint transition-shadow focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";
  const labelCls = "mb-1.5 block text-sm font-medium text-ink";

  // Plain (non-encrypted) field default values keyed by field name
  const plainDefaults: Record<string, string> = {
    bank_name: settings.bankName,
    bank_account_name: settings.bankAccountName,
    bank_account_type: settings.bankAccountType,
    bank_swift_bic: settings.bankSwiftBic,
    mobile_money_provider: settings.mobileMoneyProvider,
  };

  const encryptedKeys = new Set([
    "bank_sort_code",
    "bank_account_number",
    "bank_routing_number",
    "bank_institution_no",
    "bank_transit_no",
    "bank_bsb",
    "bank_branch_code",
    "bank_iban",
    "mobile_money_number",
  ]);

  return (
    <form action={action} className="space-y-8">
      {/* Logo */}
      <section className="rounded-xl border border-line bg-surface p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-faint">Logo</h2>
        <div className="flex items-center gap-5">
          {logoUrl ? (
            <img src={logoUrl} alt="Business logo" className="h-16 w-16 rounded-lg object-contain border border-line bg-white p-1" />
          ) : (
            <div className="h-16 w-16 rounded-lg border border-line bg-ink-faint/10 flex items-center justify-center text-xs text-ink-faint">No logo</div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-ink-faint/5 disabled:opacity-50 transition-colors"
            >
              {logoUploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
            </button>
            <p className="text-xs text-ink-faint">PNG, JPG, WebP or SVG · max 2 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
        {logoError && <p className="text-sm text-overdue-fg">{logoError}</p>}
      </section>

      {/* Business details */}
      <section className="rounded-xl border border-line bg-surface p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-faint">Business</h2>

        <div>
          <label className={labelCls}>Business name</label>
          <input name="name" required defaultValue={settings.name} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Address</label>
          <input name="address" defaultValue={settings.address} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Country</label>
            <select
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputCls}
            >
              {COUNTRY_LIST.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select name="currency" defaultValue={settings.currency} className={inputCls} key={settings.currency}>
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>VAT / tax rate (%)</label>
          <input
            name="vat_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={settings.vatRate}
            className={inputCls}
          />
        </div>
      </section>

      {/* Bank details */}
      <section className="rounded-xl border border-line bg-surface p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-faint">Bank details</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Sensitive fields are re-encrypted when you save. Leave a field blank to keep the existing value.
          </p>
        </div>

        {countryFormat.bankFields.map((field) => (
          <div key={field.key}>
            <label className={labelCls}>
              {field.label}
              {encryptedKeys.has(field.key) && (
                <span className="ml-1.5 text-xs font-normal text-ink-faint">(leave blank to keep current)</span>
              )}
            </label>
            {field.type === "select" && field.options ? (
              <select
                name={field.key}
                defaultValue={plainDefaults[field.key] ?? ""}
                className={inputCls}
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt || "— none —"}</option>
                ))}
              </select>
            ) : (
              <input
                name={field.key}
                defaultValue={encryptedKeys.has(field.key) ? "" : (plainDefaults[field.key] ?? "")}
                placeholder={encryptedKeys.has(field.key) ? "••••••••" : ""}
                className={inputCls}
              />
            )}
          </div>
        ))}
      </section>

      {/* Telegram reconnect */}
      <section className="rounded-xl border border-line bg-surface p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-faint">Telegram</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Need to reconnect or link a new Telegram account? Generate a fresh code and send it to{" "}
            <a href="https://t.me/mybackofficeuk_bot" target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">@mybackofficeuk_bot</a>.
          </p>
        </div>
        {telegramCode ? (
          <div className="rounded-xl border border-brand/20 bg-brand-soft p-4 text-center">
            <p className="font-mono text-3xl font-bold tracking-widest text-brand-ink">{telegramCode}</p>
            <p className="mt-1 text-xs text-ink-faint">Send this to @mybackofficeuk_bot · expires in 15 minutes</p>
          </div>
        ) : null}
        {telegramError && <p className="text-sm text-overdue-fg">{telegramError}</p>}
        <button
          type="button"
          disabled={telegramLoading}
          onClick={async () => {
            setTelegramLoading(true);
            setTelegramError(null);
            const result = await generateTelegramCode();
            if (result.ok) setTelegramCode(result.data);
            else setTelegramError(result.error);
            setTelegramLoading(false);
          }}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-ink-faint/5 disabled:opacity-50 transition-colors"
        >
          {telegramLoading ? "Generating…" : telegramCode ? "Generate new code" : "Generate connect code"}
        </button>
      </section>

      {state && !state.ok && (
        <p className="rounded-lg bg-overdue-bg px-3 py-2 text-sm text-overdue-fg">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-paid-bg px-3 py-2 text-sm text-paid-fg">Settings saved successfully.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgba(4,120,87,0.7)] transition-colors hover:bg-brand-strong disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
