"use server";

import { adminClient } from "@/lib/supabase-admin";
import { getServerClient } from "@/lib/supabase-server";
import { encryptField } from "@/lib/crypto";
import { getCountryFormat } from "@/lib/countryFormats";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function requireMembership(): Promise<{ userId: string; businessId: string }> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) throw new Error("No business found");
  return { userId: user.id, businessId: data.business_id };
}

export async function getBusinessSettings(): Promise<ActionResult<{
  businessId: string;
  name: string;
  address: string;
  currency: string;
  vatRate: number;
  country: string;
  bankName: string;
  bankAccountName: string;
  bankAccountType: string;
  bankSwiftBic: string;
  mobileMoneyProvider: string;
}>> {
  try {
    const { businessId } = await requireMembership();
    const { data, error } = await adminClient
      .from("businesses")
      .select("name, address, currency, vat_rate, country, bank_name, bank_account_name, bank_account_type, bank_swift_bic, mobile_money_provider")
      .eq("id", businessId)
      .single();

    if (error || !data) return { ok: false, error: "Could not load settings" };

    return {
      ok: true,
      data: {
        businessId,
        name: data.name ?? "",
        address: data.address ?? "",
        currency: data.currency ?? "GBP",
        vatRate: Number(data.vat_rate ?? 0),
        country: data.country ?? "GB",
        bankName: data.bank_name ?? "",
        bankAccountName: data.bank_account_name ?? "",
        bankAccountType: data.bank_account_type ?? "",
        bankSwiftBic: data.bank_swift_bic ?? "",
        mobileMoneyProvider: data.mobile_money_provider ?? "",
      },
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function saveBusinessSettings(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  try {
    const { businessId } = await requireMembership();

    const country = (formData.get("country") as string) || "GB";
    const countryFormat = getCountryFormat(country);

    const get = (key: string) => (formData.get(key) as string | null) || undefined;

    const bankSortCode = get("bank_sort_code");
    const bankRoutingNumber = get("bank_routing_number");
    const bankAccountNumber = get("bank_account_number");
    const bankBsb = get("bank_bsb");
    const mobileMoneyNumber = get("mobile_money_number");

    // Validate
    if (bankSortCode) {
      const digits = bankSortCode.replace(/\D/g, "");
      if (digits.length !== 6) return { ok: false, error: "Sort code must be 6 digits (e.g. 12-34-56)" };
    }
    if (bankRoutingNumber && !/^\d{9}$/.test(bankRoutingNumber)) {
      return { ok: false, error: "Routing number must be exactly 9 digits" };
    }
    if (bankAccountNumber && country === "NG" && !/^\d{10}$/.test(bankAccountNumber)) {
      return { ok: false, error: "Account number must be 10 digits (NUBAN)" };
    }
    if (bankBsb) {
      const digits = bankBsb.replace(/\D/g, "");
      if (digits.length !== 6) return { ok: false, error: "BSB must be 6 digits (e.g. 123-456)" };
    }
    if (mobileMoneyNumber && country === "GH" && !/^0\d{9}$/.test(mobileMoneyNumber)) {
      return { ok: false, error: "Mobile money number must be 10 digits starting with 0" };
    }

    const vatRateRaw = Number(formData.get("vat_rate"));
    const vatRate = Number.isFinite(vatRateRaw) ? Math.min(Math.max(vatRateRaw, 0), 100) : 0;

    const updates: Record<string, unknown> = {
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      currency: formData.get("currency") as string,
      country,
      vat_rate: vatRate,
      bank_name: get("bank_name") ?? null,
      bank_account_name: get("bank_account_name") ?? null,
      bank_account_type: get("bank_account_type") ?? null,
      bank_swift_bic: get("bank_swift_bic") ?? null,
      mobile_money_provider: get("mobile_money_provider") ?? null,
    };

    // Encrypted fields — only update if a value was provided
    if (bankAccountNumber) updates.bank_account_number = encryptField(bankAccountNumber);
    if (bankSortCode) updates.bank_sort_code = encryptField(bankSortCode.replace(/\D/g, "").replace(/(\d{2})(\d{2})(\d{2})/, "$1-$2-$3"));
    if (bankRoutingNumber) updates.bank_routing_number = encryptField(bankRoutingNumber);
    if (get("bank_institution_no")) updates.bank_institution_no = encryptField(get("bank_institution_no")!);
    if (get("bank_transit_no")) updates.bank_transit_no = encryptField(get("bank_transit_no")!);
    if (bankBsb) updates.bank_bsb = encryptField(bankBsb);
    if (get("bank_branch_code")) updates.bank_branch_code = encryptField(get("bank_branch_code")!);
    if (get("bank_iban")) updates.bank_iban = encryptField(get("bank_iban")!);
    if (mobileMoneyNumber) updates.mobile_money_number = encryptField(mobileMoneyNumber);

    const { error } = await adminClient
      .from("businesses")
      .update(updates)
      .eq("id", businessId);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
