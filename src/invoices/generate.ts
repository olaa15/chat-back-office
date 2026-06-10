import puppeteer from "puppeteer";
import { getBusinessById } from "../db/queries";
import { InvoiceFields } from "../llm/tools";
import { InvoiceTotals } from "./calc";
import { buildInvoiceHtml, InvoiceData, LineItem } from "./template";

function parseLineItems(description: string, currency: string, totalAmount: number): LineItem[] {
  // Match patterns like "1. Service Name – £500" or "1. Service Name - $500"
  const currencySymbols: Record<string, string> = {
    GBP: "£", USD: "\\$", EUR: "€", NGN: "₦",
  };
  const symbol = (currencySymbols[currency] ?? "[£$€₦]").replace("$", "\\$");
  const pattern = new RegExp(
    `\\d+\\.\\s+([^\\-–]+?)\\s*[\\-–]+\\s*${symbol}([\\d,]+(?:\\.\\d{1,2})?)`,
    "gi"
  );

  const matches = [...description.matchAll(pattern)];
  if (matches.length > 1) {
    return matches.map(m => ({
      description: m[1].trim(),
      amount: parseFloat(m[2].replace(/,/g, "")),
    }));
  }

  // Single item — use total subtotal as amount
  return [{ description, amount: totalAmount }];
}

export async function generateInvoicePdf(
  fields: InvoiceFields,
  totals: InvoiceTotals,
  invoiceNumber: string,
  businessId: string
): Promise<Buffer> {
  const business = await getBusinessById(businessId);

  const data: InvoiceData = {
    invoiceNumber,
    issueDate: new Date().toLocaleDateString("en-GB", { dateStyle: "long" }),
    dueDate: fields.due_date
      ? new Date(fields.due_date).toLocaleDateString("en-GB", { dateStyle: "long" })
      : "On receipt",
    business: {
      name: business?.name ?? "My Business",
      address: business?.address ?? "London, United Kingdom",
      email: business?.email ?? "",
      logoUrl: business?.logo_url ?? undefined,
    },
    client: { name: fields.client_name },
    lineItems: parseLineItems(fields.description, fields.currency ?? "GBP", totals.subtotal),
    totals,
    currency: fields.currency,
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
