import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * Cross-tenant RLS leakage test (skill-up programme, Tier 3 / Phase 2).
 * Seeds two separate tenants (user + business + client + invoice each) via the
 * service role, then signs in as each user with the ANON key and proves that
 * row-level security stops either one reading the other's clients, invoices, or
 * business row. Tears everything down afterwards.
 *
 * SAFETY: this creates and deletes real auth users and rows. Run it against a
 * STAGING Supabase project, and only with RLS_TEST=1 set.
 *
 * Usage:
 *   RLS_TEST=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npm run test:rls
 */

function need(name: string, v: string | undefined): string {
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function main() {
  if (process.env.RLS_TEST !== "1") {
    throw new Error(
      "Refusing to run without RLS_TEST=1. This creates and deletes test users and " +
        "data — run it against a STAGING Supabase project, not production."
    );
  }
  const url = need("SUPABASE_URL", process.env.SUPABASE_URL);
  const serviceKey = need("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = need("SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const tag = randomUUID().slice(0, 8);
  const password = `Test-${randomUUID()}`;
  const createdUsers: string[] = [];
  const createdBusinesses: string[] = [];
  const failures: string[] = [];

  try {
    // ── Seed two independent tenants ────────────────────────────────────────
    const tenants: { who: string; email: string; businessId: string }[] = [];
    for (const who of ["a", "b"]) {
      const email = `rls-test-${who}-${tag}@example.com`;
      const { data: u, error: ue } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (ue || !u?.user) throw new Error(`createUser ${who}: ${ue?.message}`);
      createdUsers.push(u.user.id);

      const { data: biz, error: be } = await admin
        .from("businesses")
        .insert({ name: `RLS ${who} ${tag}` })
        .select("id")
        .single();
      if (be || !biz) throw new Error(`create business ${who}: ${be?.message}`);
      createdBusinesses.push(biz.id);

      const { error: me } = await admin
        .from("business_members")
        .insert({ business_id: biz.id, user_id: u.user.id });
      if (me) throw new Error(`add member ${who}: ${me.message}`);

      const { error: ce } = await admin
        .from("clients")
        .insert({ business_id: biz.id, name: `Client ${who} ${tag}` });
      if (ce) throw new Error(`seed client ${who}: ${ce.message}`);

      const { error: ie } = await admin.from("invoices").insert({
        business_id: biz.id,
        client_name: `Client ${who}`,
        invoice_number: `INV-${who}-${tag}`,
      });
      if (ie) throw new Error(`seed invoice ${who}: ${ie.message}`);

      tenants.push({ who, email, businessId: biz.id });
    }

    // ── Assert isolation from BOTH sides ────────────────────────────────────
    const pairs = [
      [tenants[0], tenants[1]],
      [tenants[1], tenants[0]],
    ] as const;

    for (const [self, other] of pairs) {
      const asUser = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: se } = await asUser.auth.signInWithPassword({
        email: self.email,
        password,
      });
      if (se) throw new Error(`sign in ${self.who}: ${se.message}`);

      const { data: myClients } = await asUser.from("clients").select("business_id");
      if ((myClients ?? []).some((r) => r.business_id === other.businessId))
        failures.push(`LEAK: user ${self.who} can read tenant ${other.who}'s clients`);
      if (!(myClients ?? []).some((r) => r.business_id === self.businessId))
        failures.push(`user ${self.who} cannot read their OWN clients (policy too strict)`);

      const { data: foreignClients } = await asUser
        .from("clients")
        .select("id")
        .eq("business_id", other.businessId);
      if ((foreignClients ?? []).length > 0)
        failures.push(`LEAK: explicit query let ${self.who} read tenant ${other.who}'s clients`);

      const { data: foreignInvoices } = await asUser
        .from("invoices")
        .select("id")
        .eq("business_id", other.businessId);
      if ((foreignInvoices ?? []).length > 0)
        failures.push(`LEAK: explicit query let ${self.who} read tenant ${other.who}'s invoices`);

      const { data: foreignBiz } = await asUser
        .from("businesses")
        .select("id")
        .eq("id", other.businessId);
      if ((foreignBiz ?? []).length > 0)
        failures.push(`LEAK: ${self.who} can read tenant ${other.who}'s business row`);

      await asUser.auth.signOut();
    }
  } finally {
    // ── Teardown (best effort) ──────────────────────────────────────────────
    for (const id of createdBusinesses) await admin.from("businesses").delete().eq("id", id);
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  }

  if (failures.length > 0) {
    console.error("✗ RLS leakage test FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("✓ RLS isolation holds — no cross-tenant reads of clients, invoices, or businesses.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
