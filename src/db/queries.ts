import { supabase } from "./client";
import { InvoiceTotals } from "../invoices/calc";
import { ExpenseFields, InvoiceFields, PaymentFields } from "../llm/tools";

export interface BusinessProfile {
  name: string;
  address: string | null;
  email: string | null;
  logo_url: string | null;
  currency: string;
  vat_rate: number;
}

export async function getConnectCode(businessId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("connect_code")
    .eq("id", businessId)
    .single();
  if (error || !data?.connect_code) return null;
  return data.connect_code as string;
}

export async function getBusinessById(
  businessId: string
): Promise<BusinessProfile | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("name, address, logo_url, currency, vat_rate")
    .eq("id", businessId)
    .single();

  if (error || !data) return null;
  return { ...data, email: null, vat_rate: Number(data.vat_rate) } as BusinessProfile;
}

export async function linkTelegramAccount(
  code: string,
  telegramUserId: number
): Promise<boolean> {
  // Look up business by connect code stored on the businesses table
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("connect_code", code.toUpperCase())
    .single();

  if (error || !business) return false;

  const businessId = business.id as string;

  // Upsert by primary key — handles both new and existing telegram_user_id rows
  const { error: upsertError } = await supabase
    .from("telegram_links")
    .upsert({
      telegram_user_id: telegramUserId,
      business_id: businessId,
      linked_at: new Date().toISOString(),
    });

  return !upsertError;
}

export async function getBusinessForTelegramUser(
  telegramUserId: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from("telegram_links")
    .select("business_id")
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (error || !data?.business_id) return null;
  return data.business_id as string;
}

export async function getBusinessForWhatsAppUser(phone: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("whatsapp_links")
    .select("business_id")
    .eq("whatsapp_phone", phone)
    .single();

  if (error || !data?.business_id) return null;
  return data.business_id as string;
}

export async function linkWhatsAppAccount(code: string, phone: string): Promise<boolean> {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("connect_code", code.toUpperCase())
    .single();

  if (error || !business) return false;

  const { error: upsertError } = await supabase
    .from("whatsapp_links")
    .upsert({
      whatsapp_phone: phone,
      business_id: business.id,
      linked_at: new Date().toISOString(),
    });

  return !upsertError;
}

export async function getSignedPdfUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("invoices")
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function getNextInvoiceNumber(businessId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_invoice_number", {
    b_id: businessId,
  });
  if (error || !data) throw new Error(`Failed to get invoice number: ${error?.message}`);
  return data as string;
}

export async function saveInvoice(params: {
  businessId: string;
  fields: InvoiceFields;
  totals: InvoiceTotals;
  invoiceNumber: string;
  pdfBuffer: Buffer;
}): Promise<string> {
  const { businessId, fields, totals, invoiceNumber, pdfBuffer } = params;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      business_id: businessId,
      client_name: fields.client_name,
      invoice_number: invoiceNumber,
      status: "sent",
      currency: fields.currency,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      issue_date: new Date().toISOString().split("T")[0],
      due_date: fields.due_date ?? null,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    throw new Error(`Failed to insert invoice: ${invoiceError?.message}`);
  }

  const invoiceId = invoice.id as string;

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    description: fields.description,
    quantity: 1,
    unit_price: totals.subtotal,
    amount: totals.subtotal,
  });

  if (itemError) throw new Error(`Failed to insert invoice item: ${itemError.message}`);

  const storagePath = `${businessId}/${invoiceId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) throw new Error(`Failed to upload PDF: ${uploadError.message}`);

  await supabase
    .from("invoices")
    .update({ pdf_path: storagePath })
    .eq("id", invoiceId);

  return invoiceId;
}

export async function updateInvoiceStripeData(
  invoiceId: string,
  paymentLinkUrl: string,
  stripeSessionId: string
): Promise<void> {
  await supabase
    .from("invoices")
    .update({ payment_link_url: paymentLinkUrl, stripe_session_id: stripeSessionId })
    .eq("id", invoiceId);
}

export async function markInvoicePaidBySession(sessionId: string): Promise<{
  invoiceId: string;
  businessId: string;
  telegramUserId: number | null;
  invoiceNumber: string;
} | null> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, business_id, invoice_number, total")
    .eq("stripe_session_id", sessionId)
    .single();

  if (error || !invoice) return null;

  const invoiceId = invoice.id as string;
  const businessId = invoice.business_id as string;
  const invoiceNumber = invoice.invoice_number as string;
  const total = Number(invoice.total);

  await supabase
    .from("invoices")
    .update({ status: "paid" })
    .eq("id", invoiceId);

  await supabase.from("payments").insert({
    business_id: businessId,
    invoice_id: invoiceId,
    amount: total,
    method: "stripe",
    reference: sessionId,
  });

  await supabase.from("audit_log").insert({
    business_id: businessId,
    actor: "stripe",
    action: "payment.stripe",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: { sessionId, invoiceNumber, amount: total },
  });

  const { data: link } = await supabase
    .from("telegram_links")
    .select("telegram_user_id")
    .eq("business_id", businessId)
    .single();

  return {
    invoiceId,
    businessId,
    invoiceNumber,
    telegramUserId: link?.telegram_user_id ?? null,
  };
}

export async function findInvoiceByNumber(
  businessId: string,
  invoiceNumber: string
): Promise<{ id: string; total: number; status: string; client_name: string; currency: string } | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, total, status, client_name, currency")
    .eq("business_id", businessId)
    .eq("invoice_number", invoiceNumber.toUpperCase())
    .single();

  if (error || !data) return null;
  return data as { id: string; total: number; status: string; client_name: string; currency: string };
}

export async function recordPayment(params: {
  businessId: string;
  invoiceId: string;
  invoiceTotal: number;
  payment: PaymentFields;
}): Promise<string> {
  const { businessId, invoiceId, invoiceTotal, payment } = params;
  const amount = Number(payment.amount.toFixed(2));

  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .insert({
      business_id: businessId,
      invoice_id: invoiceId,
      amount,
      method: payment.method as "transfer" | "cash" | "card" | "other",
      reference: payment.reference ?? null,
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (paymentError || !paymentRow) {
    throw new Error(`Failed to record payment: ${paymentError?.message}`);
  }

  if (amount >= invoiceTotal) {
    await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoiceId);
  }

  return paymentRow.id as string;
}

export async function listInvoices(
  businessId: string,
  status?: string
): Promise<Array<{ invoice_number: string; client_name: string; total: number; currency: string; status: string; issue_date: string }>> {
  let query = supabase
    .from("invoices")
    .select("invoice_number, client_name, total, currency, status, issue_date")
    .eq("business_id", businessId)
    .order("issue_date", { ascending: false })
    .limit(10);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list invoices: ${error.message}`);
  return (data ?? []) as Array<{ invoice_number: string; client_name: string; total: number; currency: string; status: string; issue_date: string }>;
}

export async function getOutstandingBalance(
  businessId: string
): Promise<{ outstanding: number; currency: string; count: number }> {
  const { data, error } = await supabase
    .from("invoices")
    .select("total, currency")
    .eq("business_id", businessId)
    .in("status", ["sent", "overdue"]);

  if (error) throw new Error(`Failed to get balance: ${error.message}`);

  const rows = (data ?? []) as Array<{ total: number; currency: string }>;
  const outstanding = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const currency = rows[0]?.currency ?? "GBP";

  return { outstanding, currency, count: rows.length };
}

export async function writeAuditLog(params: {
  businessId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from("audit_log").insert({
    business_id: params.businessId,
    actor: "bot",
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  });
}

const RECEIPT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function saveExpense(params: {
  businessId: string;
  expense: ExpenseFields;
  imageBuffer: Buffer;
  mimeType: string;
}): Promise<string> {
  const { businessId, expense, imageBuffer, mimeType } = params;
  const amount = Number(expense.amount.toFixed(2));

  const { data: row, error: insertError } = await supabase
    .from("expenses")
    .insert({
      business_id: businessId,
      vendor: expense.vendor,
      amount,
      currency: expense.currency,
      category: expense.category ?? null,
      description: expense.description ?? null,
      expense_date: expense.expense_date ?? new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (insertError || !row) {
    throw new Error(`Failed to insert expense: ${insertError?.message}`);
  }

  const expenseId = row.id as string;
  const ext = RECEIPT_EXTENSIONS[mimeType] ?? "jpg";
  const storagePath = `${businessId}/${expenseId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(storagePath, imageBuffer, { contentType: mimeType, upsert: true });

  if (uploadError) throw new Error(`Failed to upload receipt: ${uploadError.message}`);

  await supabase
    .from("expenses")
    .update({ receipt_path: storagePath })
    .eq("id", expenseId);

  return expenseId;
}

export async function listExpenses(
  businessId: string,
  category?: string
): Promise<Array<{ vendor: string; amount: number; currency: string; category: string | null; expense_date: string }>> {
  let query = supabase
    .from("expenses")
    .select("vendor, amount, currency, category, expense_date")
    .eq("business_id", businessId)
    .order("expense_date", { ascending: false })
    .limit(10);

  if (category) query = query.ilike("category", category);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list expenses: ${error.message}`);
  return (data ?? []) as Array<{ vendor: string; amount: number; currency: string; category: string | null; expense_date: string }>;
}

export async function getExpenseSummary(
  businessId: string
): Promise<Array<{ total: number; currency: string; count: number }>> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, currency")
    .eq("business_id", businessId)
    .gte("expense_date", monthStart);

  if (error) throw new Error(`Failed to get expense summary: ${error.message}`);

  const rows = (data ?? []) as Array<{ amount: number; currency: string }>;
  const byCurrency = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const entry = byCurrency.get(row.currency) ?? { total: 0, count: 0 };
    entry.total += Number(row.amount);
    entry.count += 1;
    byCurrency.set(row.currency, entry);
  }

  return [...byCurrency.entries()].map(([currency, { total, count }]) => ({ total, currency, count }));
}
