import puppeteer from "puppeteer";
import { getCountryFormat } from "../format/countryFormats";
import { getBusinessById } from "../db/queries";
import { InvoiceFields } from "../llm/tools";
import { InvoiceTotals } from "./calc";
import { buildInvoiceHtml, InvoiceData } from "./template";

export async function generateInvoicePdf(
  fields: InvoiceFields,
  totals: InvoiceTotals,
  invoiceNumber: string,
  businessId: string
): Promise<Buffer> {
  const business = await getBusinessById(businessId);
  const country = business?.country ?? "GB";
  const countryFormat = getCountryFormat(country);

  // Build decrypted bank record for the payment-details block
  const bankRecord: Record<string, string | null> = {
    bank_name: business?.bank_name ?? null,
    bank_account_name: business?.bank_account_name ?? null,
    bank_account_number: business?.bank_account_number ?? null,
    bank_sort_code: business?.bank_sort_code ?? null,
    bank_routing_number: business?.bank_routing_number ?? null,
    bank_account_type: business?.bank_account_type ?? null,
    bank_institution_no: business?.bank_institution_no ?? null,
    bank_transit_no: business?.bank_transit_no ?? null,
    bank_bsb: business?.bank_bsb ?? null,
    bank_branch_code: business?.bank_branch_code ?? null,
    bank_iban: business?.bank_iban ?? null,
    bank_swift_bic: business?.bank_swift_bic ?? null,
    mobile_money_provider: business?.mobile_money_provider ?? null,
    mobile_money_number: business?.mobile_money_number ?? null,
  };

  const payment = countryFormat.formatBankDetails(bankRecord);

  const data: InvoiceData = {
    invoiceNumber,
    issueDate: new Date().toLocaleDateString("en-GB", { dateStyle: "long" }),
    dueDate: fields.due_date
      ? new Date(fields.due_date).toLocaleDateString("en-GB", { dateStyle: "long" })
      : "On receipt",
    business: {
      name: business?.name ?? "My Business",
      address: business?.address ?? "",
      country,
      email: business?.email ?? "",
      logoUrl: business?.logo_url ?? undefined,
    },
    client: { name: fields.client_name },
    lineItems: fields.items.map((item) => ({
      description: item.description,
      amount: item.amount,
      quantity: item.quantity,
    })),
    totals,
    currency: fields.currency,
    payment,
  };

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildInvoiceHtml(data), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "40px", right: "40px", bottom: "40px", left: "40px" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
