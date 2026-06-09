# Ordeva — landing page rollout (Claude Code prompt)

Replace the placeholder root route (currently a redirect to `/dashboard`) with the real
marketing landing page. The new file is at `ordeva-brand/page.tsx` (repo root).

**Hard rules**
- Only the root route changes. Do not touch `/dashboard`, auth, payments, or the bot.
- No new npm dependencies — it uses the existing `Logo` component and the design tokens
  already in `globals.css` (`bg-brand`, `text-ink`, `font-display`, `rounded-card`,
  `shadow-card`, the status pills, `animate-rise`, etc.).
- Run in plan mode first; show me the plan and diff before applying.

## Steps
1. Replace `dashboard/app/page.tsx` entirely with `ordeva-brand/page.tsx`.
   (The old file is just `redirect("/dashboard")` — it goes away; `/` is now the landing.)
2. Leave everything else untouched. `/dashboard` stays protected by its existing layout
   auth check; the landing simply links to `/login` and `/signup`.

## Optional (only if you want signed-in users to skip the landing)
Make the root a server component that checks the Supabase session and, if a user is
already signed in, `redirect("/dashboard")` — otherwise render the landing. Keep it
optional; the default (landing for everyone, with a Sign in link) is fine for launch.

## Verify after applying
1. `cd dashboard && npm run build` — compiles with no new errors.
2. Dev server: visiting `/` shows the landing (hero with the message → invoice demo,
   how-it-works, features, the dark "trusted with your money" band, CTA, footer).
3. The Ordeva logo appears in the nav and footer; "Get early access" → `/signup`,
   "Sign in" → `/login`.
4. `/dashboard` still redirects to login when signed out (unchanged).
