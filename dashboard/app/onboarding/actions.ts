"use server";

import { adminClient } from "@/lib/supabase-admin";

export async function createBusiness(
  userId: string,
  data: { name: string; currency: string; address: string; vatRate?: number }
): Promise<string> {
  const { data: business, error } = await adminClient
    .from("businesses")
    .insert({
      name: data.name,
      currency: data.currency,
      address: data.address,
      vat_rate: data.vatRate ?? 0,
    })
    .select("id")
    .single();

  if (error || !business) throw new Error(`Failed to create business: ${error?.message}`);

  await adminClient.from("business_members").insert({
    business_id: business.id,
    user_id: userId,
    role: "owner",
  });

  return business.id as string;
}

export async function updateBusinessProfile(
  businessId: string,
  data: {
    bankName?: string;
    bankAccountName?: string;
    bankAccountNumber?: string;
    logoUrl?: string;
  }
): Promise<void> {
  await adminClient
    .from("businesses")
    .update({
      bank_name: data.bankName || null,
      bank_account_name: data.bankAccountName || null,
      bank_account_number: data.bankAccountNumber || null,
      logo_url: data.logoUrl || null,
    })
    .eq("id", businessId);
}

export async function uploadLogo(
  businessId: string,
  formData: FormData
): Promise<string | null> {
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return null;

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${businessId}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await adminClient.storage
    .from("logos")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (error) return null;

  const { data } = adminClient.storage.from("logos").getPublicUrl(path);
  return data.publicUrl;
}

export async function generateConnectCode(
  businessId: string,
  _userId: string
): Promise<string> {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  await adminClient
    .from("businesses")
    .update({ connect_code: code })
    .eq("id", businessId);

  return code;
}

export async function checkTelegramLinked(businessId: string): Promise<boolean> {
  const { data } = await adminClient
    .from("telegram_links")
    .select("linked_at")
    .eq("business_id", businessId)
    .maybeSingle();

  return !!data?.linked_at;
}
