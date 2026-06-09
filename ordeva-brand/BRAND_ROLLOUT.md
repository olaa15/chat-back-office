# Ordeva — brand rollout (Claude Code prompt)

We are renaming the product from **"Back Office"** to **"Ordeva"** and dropping in a new
logo suite. New brand assets are in a folder named `ordeva-brand/` at the **repo root**
(download it and place it there before running this).

**Hard rules**
- Only branding changes: wordmark, icons, metadata title, footer credits.
- Do **not** touch any data, auth, payment, or bot logic. No new npm dependencies.
- Keep the `Logo` component's public API identical (`tone`, `showWord`) — call sites must not change.
- Run in plan mode first; show me the plan and the diff before applying.

---

## 1. Logo component
Replace `dashboard/components/brand.tsx` entirely with `ordeva-brand/brand.tsx`.
(The wrapper classes, sizing, `tone`/`showWord` props are unchanged — only the glyph
becomes the three-line "order" mark and the word becomes "Ordeva".)

## 2. Icons (Next.js App Router auto-detects these — no <link> tags needed)
- Move `ordeva-brand/icon.svg` → `dashboard/app/icon.svg`
- Move `ordeva-brand/apple-icon.png` → `dashboard/app/apple-icon.png`
- Delete `dashboard/app/favicon.ico` (the SVG icon takes over; remove the stale default).
- Move `ordeva-brand/ordeva-og.png` → `dashboard/public/ordeva-og.png`
- Optional (only if a PWA manifest gets added later): move `icon-192.png` and
  `icon-512.png` → `dashboard/public/`.

## 3. Metadata — `dashboard/app/layout.tsx`
Replace the existing `metadata` export with:

```ts
export const metadata: Metadata = {
  metadataBase: new URL("https://ordeva.co.uk"),
  title: { default: "Ordeva", template: "%s · Ordeva" },
  description: "Run your business from chat — invoices, payments, and records.",
  openGraph: {
    title: "Ordeva",
    description: "Run your business from chat — invoices, payments, and records.",
    images: ["/ordeva-og.png"],
    type: "website",
  },
};
```

## 4. Footer credits (brand name only)
- `dashboard/app/login/page.tsx` — change `© {new Date().getFullYear()} Back Office`
  to `© {new Date().getFullYear()} Ordeva`.
- `dashboard/app/signup/page.tsx` — same change to the `© … Back Office` footer line.
  **Leave the line "Your back office, set up in minutes." exactly as is** — that's
  descriptive copy (the product *is* a back office), not the brand name.

## 5. Invoice fallback — `src/invoices/generate.ts` (line ~22)
Change the fallback `name: business?.name ?? "My Back Office"` to
`name: business?.name ?? "My Business"`.
This is the **customer's** business name fallback printed on their invoice — it must be
neutral and must **never** say "Ordeva".

## 6. Leave alone
- `package.json` `name` field (internal, not user-facing) — no change.
- Any other lowercase "back office" used as a plain description.

---

## Verify after applying
1. `grep -rni "back office" dashboard src --include='*.tsx' --include='*.ts'`
   → should return **only** the descriptive signup line ("Your back office, set up in minutes.").
2. `cd dashboard && npm run build` (or `npx tsc --noEmit`) passes with no new errors.
3. Dev server: the sidebar, login, and signup all show the Ordeva mark + wordmark;
   the browser tab shows the emerald icon; `/ordeva-og.png` loads.
