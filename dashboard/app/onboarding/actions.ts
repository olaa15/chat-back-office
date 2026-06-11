"use server";

import crypto from "node:crypto";
import { adminClient } from "@/lib/supabase-admin";
import { getServerClient } from "@/lib/supabase-server";
import { encryptField } from "@/lib/crypto";

// ── Connect-code settings ────────────────────────────────────────────────
// 32-char alphabet excluding ambiguous 0/O and 1/I. 32^6 ≈ 1.07e9 combinations,
// short-lived and only meaningful for ~15 minutes, so brute force is infeasible.
const CONNECT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CONNECT_CODE_LENGTH = 6;
const CONNECT_CODE_TTL_MINUTES = 15;

/** Resolve the authenticated user from the session cookie, or throw. */
async function requireUser() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { user, supabase };
}

/**
 * Assert the current session user is a member of `businessId`, and return their id.
 * Reads via the user's RLS-backed client, so the membership row is only visible
 * when they genuinely belong to the business — defence in depth on top of the
 * explicit user_id filter. Every action that takes a businessId calls this first.
 */
async function assertMember(businessId: string): Promise<string> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized for this business");
  return user.id;
}

function generateConnectCodeString(): string {
  let code = "";
  for (let i = 0; i < CONNECT_CODE_LENGTH; i++) {
    code += CONNECT_CODE_ALPHABET[crypto.randomInt(CONNECT_CODE_ALPHABET.length)];
  }
  return code;
}

// NOTE: identity now comes from the session — `userId` is no longer a parameter.
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type ProfileData = {
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
  bankRoutingNumber?: string;
  bankAccountType?: string;
  bankInstitutionNo?: string;
  bankTransitNo?: string;
  bankBsb?: string;
  bankBranchCode?: string;
  bankIban?: string;
  bankSwiftBic?: string;
  mobileMoneyProvider?: string;
  mobileMoneyNumber?: string;
  logoUrl?: string;
};

function validateBankFields(country: string, data: ProfileData): string | null {
  if (data.bankSortCode) {
    const digits = data.bankSortCode.replace(/\D/g, "");
    if (digits.length !== 6) return "Sort code must be 6 digits (e.g. 12-34-56)";
  }
  if (data.bankRoutingNumber && !/^\d{9}$/.test(data.bankRoutingNumber)) {
    return "Routing number must be exactly 9 digits";
  }
  if (data.bankAccountNumber && country === "NG" && !/^\d{10}$/.test(data.bankAccountNumber)) {
    return "Account number must be 10 digits (NUBAN)";
  }
  if (data.bankBsb) {
    const digits = data.bankBsb.replace(/\D/g, "");
    if (digits.length !== 6) return "BSB must be 6 digits (e.g. 123-456)";
  }
  if (data.mobileMoneyNumber && country === "GH" && !/^0\d{9}$/.test(data.mobileMoneyNumber)) {
    return "Mobile money number must be 10 digits starting with 0";
  }
  if (data.bankIban) {
    const iban = data.bankIban.replace(/\s/g, "").toUpperCase();
    if (iban.length < 15 || iban.length > 34) return "IBAN length is invalid";
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let remainder = BigInt(0);
    for (const chunk of numeric.match(/.{1,9}/g) ?? []) {
      remainder = (BigInt(remainder.toString() + chunk)) % BigInt(97);
    }
    if (remainder !== BigInt(1)) return "IBAN checksum is invalid — please double-check";
  }
  return null;
}

export async function createBusiness(data: {
  name: string;
  currency: string;
  address: string;
  country: string;
  vatRate?: number;
}): Promise<ActionResult<string>> {
  try {
    const { user } = await requireUser();

    // RLS intentionally has no INSERT policy on businesses/business_members, so
    // self-service creation uses the admin client — but it can ONLY ever create a
    // business owned by the current session user, never an arbitrary one.
    const { data: business, error } = await adminClient
      .from("businesses")
      .insert({
        name: data.name,
        currency: data.currency,
        address: data.address,
        country: data.country || "GB",
        vat_rate: data.vatRate ?? 0,
      })
      .select("id")
      .single();

    if (error || !business)
      return { ok: false, error: `Failed to create business: ${error?.message}` };

    const { error: memberError } = await adminClient.from("business_members").insert({
      business_id: business.id,
      user_id: user.id,
      role: "owner",
    });
    if (memberError) return { ok: false, error: `Failed to link owner: ${memberError.message}` };

    return { ok: true, data: business.id as string };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateBusinessProfile(
  businessId: string,
  country: string,
  data: ProfileData
): Promise<ActionResult<null>> {
  try {
    await assertMember(businessId);

    const validationError = validateBankFields(country, data);
    if (validationError) return { ok: false, error: validationError };

    const enc = (v: string | undefined) => (v ? encryptField(v) : null);

    const { error } = await adminClient
      .from("businesses")
      .update({
        bank_name: data.bankName || null,
        bank_account_name: data.bankAccountName || null,
        bank_account_number: enc(data.bankAccountNumber),
        bank_sort_code: enc(data.bankSortCode),
        bank_routing_number: enc(data.bankRoutingNumber),
        bank_account_type: data.bankAccountType || null,
        bank_institution_no: enc(data.bankInstitutionNo),
        bank_transit_no: enc(data.bankTransitNo),
        bank_bsb: enc(data.bankBsb),
        bank_branch_code: enc(data.bankBranchCode),
        bank_iban: enc(data.bankIban),
        bank_swift_bic: data.bankSwiftBic || null,
        mobile_money_provider: data.mobileMoneyProvider || null,
        mobile_money_number: enc(data.mobileMoneyNumber),
        logo_url: data.logoUrl || null,
      })
      .eq("id", businessId);
    if (error) return { ok: false, error: `Failed to update profile: ${error.message}` };
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function uploadLogo(
  businessId: string,
  formData: FormData
): Promise<ActionResult<string | null>> {
  try {
    await assertMember(businessId);

    const file = formData.get("logo") as File | null;
    if (!file || file.size === 0) return { ok: true, data: null };

    // Basic upload hardening — constrain type and size before touching storage.
    const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!ALLOWED.includes(file.type)) return { ok: false, error: "Unsupported logo file type" };
    if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Logo must be under 2MB" };

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${businessId}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await adminClient.storage
      .from("logos")
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (error) return { ok: true, data: null };

    const { data } = adminClient.storage.from("logos").getPublicUrl(path);
    return { ok: true, data: data.publicUrl };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// NOTE: `userId` removed — derived from the session via assertMember.
export async function generateConnectCode(businessId: string): Promise<ActionResult<string>> {
  try {
    await assertMember(businessId);

    const code = generateConnectCodeString();
    const expiresAt = new Date(Date.now() + CONNECT_CODE_TTL_MINUTES * 60_000).toISOString();

    const { error } = await adminClient
      .from("businesses")
      .update({ connect_code: code, connect_code_expires_at: expiresAt })
      .eq("id", businessId);
    if (error) return { ok: false, error: `Failed to generate connect code: ${error.message}` };

    return { ok: true, data: code };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function checkTelegramLinked(businessId: string): Promise<boolean> {
  await assertMember(businessId);

  const { data } = await adminClient
    .from("telegram_links")
    .select("linked_at")
    .eq("business_id", businessId)
    .maybeSingle();

  return !!data?.linked_at;
}
