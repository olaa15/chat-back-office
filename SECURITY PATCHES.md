# Security patches — supporting changes

Two files are provided in full alongside this doc: `actions.ts` (dashboard server actions) and `index.ts` (server entry / webhook auth). This file covers the smaller cross-file edits that complete the fixes.

---

## 1. Enforce connect-code expiry (`src/db/queries.ts`)

Replace `linkTelegramAccount` and `linkWhatsAppAccount` with the versions below. The only change is that an **expired** code is now rejected. (Codes are left in place rather than cleared on first use, so the same code can link both Telegram and WhatsApp within its 15-minute window — the bot's `/mycode` flow keeps working. If you don't need multi-channel linking, you can instead null the code after the first successful link to make it strictly single-use.)

```ts
export async function linkTelegramAccount(
  code: string,
  telegramUserId: number
): Promise<boolean> {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, connect_code_expires_at")
    .eq("connect_code", code.toUpperCase())
    .single();

  if (error || !business) return false;

  // Reject expired or never-set codes
  const expiresAt = business.connect_code_expires_at as string | null;
  if (!expiresAt || new Date(expiresAt) < new Date()) return false;

  const businessId = business.id as string;

  const { error: upsertError } = await supabase
    .from("telegram_links")
    .upsert({
      telegram_user_id: telegramUserId,
      business_id: businessId,
      linked_at: new Date().toISOString(),
    });

  return !upsertError;
}

export async function linkWhatsAppAccount(code: string, phone: string): Promise<boolean> {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, connect_code_expires_at")
    .eq("connect_code", code.toUpperCase())
    .single();

  if (error || !business) return false;

  const expiresAt = business.connect_code_expires_at as string | null;
  if (!expiresAt || new Date(expiresAt) < new Date()) return false;

  const { error: upsertError } = await supabase
    .from("whatsapp_links")
    .upsert({
      whatsapp_phone: phone,
      business_id: business.id,
      linked_at: new Date().toISOString(),
    });

  return !upsertError;
}
```

---

## 2. Schema additions (run in Supabase)

Your committed `db/schema.sql` doesn't define `connect_code` (the live DB has it, but the file has drifted). Add both the code and its new expiry column, and reconcile `schema.sql` with the live database so they no longer diverge:

```sql
alter table public.businesses
  add column if not exists connect_code text,
  add column if not exists connect_code_expires_at timestamptz;
```

---

## 3. Environment variables (`.env.example` and `.env`)

```bash
# A random secret you choose — allowed chars: A–Z a–z 0–9 _ - (1–256 chars).
# Generate one with:  openssl rand -hex 32   (or node: crypto.randomBytes(32).toString('hex'))
TELEGRAM_WEBHOOK_SECRET=

# WhatsApp App Secret — developers.facebook.com → Your App → Settings → Basic → App Secret
WHATSAPP_APP_SECRET=
```

---

## 4. Caller changes (`dashboard/app/onboarding/page.tsx`)

The two actions no longer accept a client-supplied `userId`:

- Line ~90: `await createBusiness(userId, { ... })` → `await createBusiness({ ... })`
- Line ~123: `await generateConnectCode(businessId, userId)` → `await generateConnectCode(businessId)`

The `userId` state in the page is now unused for these calls — you can remove it if nothing else relies on it.

---

## What each change fixes

| Change | Closes |
|---|---|
| `assertMember()` + session-derived identity in every action | The IDOR / broken-access-control hole — a user could previously edit any business's bank details or mint a connect code for a business they didn't own, via the RLS-bypassing admin client. |
| Crypto-random connect code + 15-min expiry | Guessable, permanent join codes (was `Math.random`, never expiring). |
| Expiry check in the link functions | Enforces the TTL at the point the code is consumed. |
| Telegram secret-token middleware + `setWebhook({ secret_token })` | Forged updates to an open `/webhook` endpoint. |
| WhatsApp `X-Hub-Signature-256` HMAC verification | Forged updates to an open `/whatsapp-webhook` endpoint. |
| Logo upload type/size limits | Unbounded/arbitrary file uploads via the admin client. |

## Still open (not in these patches)

These were in the review and remain worth doing, but touch other files:

- **Idempotency** on the confirmation flow (`src/bot/handlers.ts`) — reset state synchronously before any `await`, or hold a per-user lock, so a double "yes" can't create two invoices.
- **Durable conversation state** (`src/bot/state.ts`) — the in-memory `Map` won't survive a restart or scale past one instance; move to a table/Redis with a TTL.
- **Rename `dashboard/proxy.ts` → `dashboard/middleware.ts`** so the route-protection actually runs.
- **An extraction eval/regression set** — the Track-F discipline that's your differentiator.
- Add `import "server-only";` at the top of `dashboard/lib/supabase-admin.ts` as a build-time guarantee the service-role client can never be bundled into client code.