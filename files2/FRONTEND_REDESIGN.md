# Frontend redesign — "Operations Console"

A production-grade restyle of the dashboard. **No data logic changed** — every Supabase query, signed-URL call, and auth flow is byte-for-byte the same as yours. Only presentation changed. **No new npm dependencies** — fonts load via `next/font`, icons are inline SVG.

## Aesthetic direction
A calm, precise operations tool that reads as trustworthy fintech rather than a generic admin panel:

- **Layout:** a fixed near-black sidebar (brand, nav, user) + a warm paper canvas. Collapses to a top bar on mobile.
- **Type:** Fraunces (a premium optical serif) for page titles and figures, Hanken Grotesk for UI text, mono for invoice numbers — deliberately *not* Arial/Inter/Geist-default.
- **Colour:** dominant warm neutral (paper + ink) with one confident emerald accent; semantic status colours for paid / sent / overdue / draft.
- **Detail:** hairline borders, soft layered shadows, rounded cards, status pills with a dot, tabular figures, a subtle staggered fade-in on load, and a brand-lit split-screen on the auth pages.

## Files

**New** (create these):
- `components/brand.tsx` — logo lockup
- `components/icons.tsx` — inline SVG icon set
- `app/dashboard/Nav.tsx` — client nav with active-state highlighting

**Replace** (overwrite existing):
- `app/globals.css` — the design system (Tailwind v4 `@theme` tokens, fonts, animations)
- `app/layout.tsx` — loads the three fonts
- `app/dashboard/layout.tsx` — sidebar shell
- `app/dashboard/SignOutButton.tsx`
- `app/dashboard/page.tsx` — overview (stats + recent invoices)
- `app/dashboard/invoices/page.tsx` — invoices + segmented filter
- `app/login/page.tsx` and `app/signup/page.tsx` — split-screen auth

**Not touched:** `app/onboarding/page.tsx` is still functional but keeps its old styling — I can restyle it to match next (it's a longer multi-step form).

## Apply with Claude Code

Drop the `frontend/dashboard/` tree into the repo (it mirrors your paths), then:

> The files under `frontend/dashboard/` are a redesigned UI for the dashboard. The data-fetching and auth logic in them is identical to my current code — only styling changed. In plan mode, copy each file to its matching path under `dashboard/` (new files: `components/brand.tsx`, `components/icons.tsx`, `app/dashboard/Nav.tsx`; the rest overwrite existing files). Do NOT change any Supabase query or auth call. After copying, run `npm run dev` and report any TypeScript or build errors. Show me the file list and wait for approval before copying.

Then run `npm run dev` and open the dashboard. Fonts download automatically on first build.

## Notes
- Tailwind v4 reads the design tokens straight from `@theme` in `globals.css` — no `tailwind.config` needed. Utilities like `bg-paper`, `text-ink-muted`, `bg-brand`, `rounded-card`, `shadow-card` come from those tokens.
- Want a different accent? Change `--color-brand` / `--color-brand-strong` / `--color-brand-soft` in `globals.css` and the whole UI re-themes. Swap the fonts in `layout.tsx` if you'd rather a different personality.
- The brand name is "Back Office" in `components/brand.tsx` and `app/layout.tsx` metadata — change in those two places when you settle on the product name.
