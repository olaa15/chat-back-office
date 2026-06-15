import puppeteer from "puppeteer";
import { getBusinessById } from "../db/queries";
import { getBusinessPaymentInfo } from "../payments/details";
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

  const { payment } = await getBusinessPaymentInfo(businessId);
  payment.push({ label: "Reference", value: invoiceNumber });

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
    // Wait for webfonts (Fraunces / Hanken Grotesk) to finish loading before
    // capturing the PDF. document.fonts.ready always resolves — even when the
    // network is unavailable — so this degrades cleanly to Georgia/system fonts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => (globalThis as any).document.fonts.ready);
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
