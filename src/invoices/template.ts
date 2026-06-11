import { getCountryFormat } from "../format/countryFormats";

export interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  business: {
    name: string;
    address: string;
    country: string;
    email: string;
    logoUrl?: string;
  };
  client: { name: string };
  lineItems: LineItem[];
  totals: { subtotal: number; vatRate: number; tax: number; total: number };
  currency: string;
  payment: { label: string; value: string }[];
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

export function buildInvoiceHtml(data: InvoiceData): string {
  const { vatRate } = data.totals;

  // Country-formatted address
  const countryFormat = getCountryFormat(data.business.country);
  const addressLines = countryFormat.formatAddress(
    data.business.address.split(/\n|,\s*/)
  );
  const addressHtml = addressLines.join("<br/>");

  // Items table — use 4 columns if any item has quantity > 1
  const hasQty = data.lineItems.some((i) => i.quantity != null && i.quantity !== 1);
  const tableHead = hasQty
    ? `<tr>
        <th>Description</th>
        <th class="right">Qty</th>
        <th class="right">Unit price</th>
        <th class="right">Amount</th>
      </tr>`
    : `<tr>
        <th>Description</th>
        <th class="right">Amount</th>
      </tr>`;

  const tableBody = data.lineItems.map((item) => {
    const qty = item.quantity ?? 1;
    const lineAmount = item.amount * qty;
    if (hasQty) {
      return `<tr>
        <td>${item.description}</td>
        <td class="right">${qty}</td>
        <td class="right">${formatCurrency(item.amount, data.currency)}</td>
        <td class="right">${formatCurrency(lineAmount, data.currency)}</td>
      </tr>`;
    }
    return `<tr>
      <td>${item.description}</td>
      <td class="right">${formatCurrency(lineAmount, data.currency)}</td>
    </tr>`;
  }).join("");

  const totalsRows = vatRate > 0
    ? `<tr>
        <td>Subtotal</td>
        <td class="right">${formatCurrency(data.totals.subtotal, data.currency)}</td>
      </tr>
      <tr>
        <td>VAT (${vatRate}%)</td>
        <td class="right">${formatCurrency(data.totals.tax, data.currency)}</td>
      </tr>
      <tr class="total-row">
        <td>Total</td>
        <td class="right">${formatCurrency(data.totals.total, data.currency)}</td>
      </tr>`
    : `<tr class="total-row">
        <td>Total</td>
        <td class="right">${formatCurrency(data.totals.total, data.currency)}</td>
      </tr>`;

  const paymentBlock = data.payment.length > 0
    ? `<div class="payment-details">
        <div class="payment-heading">Payment details</div>
        ${data.payment.map((p) => `
        <div class="payment-row">
          <span class="payment-label">${p.label}</span>
          <span class="payment-value">${p.value}</span>
        </div>`).join("")}
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      color: #1a1a1a;
      background: #fff;
    }
    .page { padding: 48px; max-width: 740px; margin: 0 auto; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
    .business-name { font-size: 22px; font-weight: 700; color: #111; }
    .business-meta { color: #555; margin-top: 6px; line-height: 1.6; }
    .invoice-label { text-align: right; }
    .invoice-label h1 { font-size: 28px; font-weight: 800; color: #111; letter-spacing: 1px; }
    .invoice-label p { color: #555; margin-top: 4px; line-height: 1.8; }

    /* Divider */
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }

    /* Bill To */
    .bill-to { margin-bottom: 36px; }
    .bill-to .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 6px; }
    .bill-to .client-name { font-size: 16px; font-weight: 600; color: #111; }

    /* Table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #f5f5f5; }
    thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #888; }
    thead th.right { text-align: right; }
    tbody td { padding: 14px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tbody td.right { text-align: right; }

    /* Totals */
    .totals { display: flex; justify-content: flex-end; }
    .totals table { width: 260px; }
    .totals td { padding: 6px 14px; }
    .totals .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #111; padding-top: 10px; }

    /* Payment details */
    .payment-details { margin-top: 36px; border-top: 1px solid #e5e5e5; padding-top: 20px; }
    .payment-heading { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 12px; }
    .payment-row { display: flex; gap: 12px; margin-bottom: 6px; font-size: 13px; }
    .payment-label { color: #555; min-width: 180px; }
    .payment-value { color: #111; font-weight: 500; }

    /* Footer */
    .footer { margin-top: 56px; font-size: 12px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      ${data.business.logoUrl
        ? `<img src="${data.business.logoUrl}" alt="${data.business.name}" style="height:48px;object-fit:contain;margin-bottom:6px;display:block;" />`
        : ""}
      <div class="business-name">${data.business.name}</div>
      <div class="business-meta">
        ${addressHtml}${data.business.email ? `<br/>${data.business.email}` : ""}
      </div>
    </div>
    <div class="invoice-label">
      <h1>INVOICE</h1>
      <p>
        <strong>${data.invoiceNumber}</strong><br/>
        Issued: ${data.issueDate}<br/>
        Due: ${data.dueDate}
      </p>
    </div>
  </div>

  <hr/>

  <div class="bill-to">
    <div class="label">Bill To</div>
    <div class="client-name">${data.client.name}</div>
  </div>

  <table>
    <thead>
      ${tableHead}
    </thead>
    <tbody>
      ${tableBody}
    </tbody>
  </table>

  <div class="totals">
    <table>
      ${totalsRows}
    </table>
  </div>

  ${paymentBlock}

  <div class="footer">Thank you for your business.</div>

</div>
</body>
</html>`;
}
