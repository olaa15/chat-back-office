// "server-only" makes the build fail if this module is ever imported into a
// client component — a hard guarantee the service-role key can never end up in
// a browser bundle. Ships with Next.js; if missing, run: npm i server-only
import "server-only";
import { createClient } from "@supabase/supabase-js";

export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
