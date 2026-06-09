import puppeteer from "puppeteer";
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
    lineItem: { description: fields.description, amount: totals.subtotal },
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
