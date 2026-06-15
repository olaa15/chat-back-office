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

  // Items table — show Qty / Unit price columns only if any line uses a quantity
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

  const tableBody = data.lineItems
    .map((item) => {
      const qty = item.quantity ?? 1;
      const lineAmount = item.amount * qty;
      if (hasQty) {
        return `<tr>
        <td class="desc">${item.description}</td>
        <td class="right num">${qty}</td>
        <td class="right num">${formatCurrency(item.amount, data.currency)}</td>
        <td class="right num">${formatCurrency(lineAmount, data.currency)}</td>
      </tr>`;
      }
      return `<tr>
      <td class="desc">${item.description}</td>
      <td class="right num">${formatCurrency(lineAmount, data.currency)}</td>
    </tr>`;
    })
    .join("");

  const totalsRows =
    vatRate > 0
      ? `<div class="totals-row">
          <span>Subtotal</span>
          <span class="num">${formatCurrency(data.totals.subtotal, data.currency)}</span>
        </div>
        <div class="totals-row">
          <span>VAT (${vatRate}%)</span>
          <span class="num">${formatCurrency(data.totals.tax, data.currency)}</span>
        </div>
        <div class="totals-row grand">
          <span>Total</span>
          <span class="num">${formatCurrency(data.totals.total, data.currency)}</span>
        </div>`
      : `<div class="totals-row grand">
          <span>Total</span>
          <span class="num">${formatCurrency(data.totals.total, data.currency)}</span>
        </div>`;

  const paymentBlock =
    data.payment.length > 0
      ? `<div class="payment">
        <div class="eyebrow">Payment details</div>
        ${data.payment
          .map(
            (p) => `
        <div class="payment-row">
          <span class="payment-label">${p.label}</span>
          <span class="payment-value">${p.value}</span>
        </div>`
          )
          .join("")}
      </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600&display=swap');

    :root {
      --ink: #1b1a17;
      --taupe: #6b675f;
      --faint: #9b968c;
      --hair: #e8e4dc;
      --panel: #faf8f4;
      --accent: #1b1a17;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 13.5px;
      color: var(--ink);
      background: #fff;
      line-height: 1.5;
    }
    .serif { font-family: "Fraunces", Georgia, "Times New Roman", serif; }
    .num { font-variant-numeric: tabular-nums; }
    .eyebrow { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.6px; color: var(--faint); }

    .sheet { max-width: 760px; margin: 0 auto; padding: 56px 56px 40px; }
    .topbar { height: 3px; background: var(--accent); width: 100%; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-bottom: 40px; }
    .logo { height: 52px; object-fit: contain; display: block; margin-bottom: 14px; }
    .biz-name { font-family: "Fraunces", Georgia, serif; font-size: 25px; font-weight: 500; letter-spacing: -0.2px; color: var(--ink); }
    .biz-meta { color: var(--taupe); margin-top: 8px; line-height: 1.7; font-size: 12.5px; }

    .invoice-title { font-family: "Fraunces", Georgia, serif; font-size: 32px; font-weight: 500; letter-spacing: 4px; color: var(--ink); text-align: right; }
    .meta { margin-top: 18px; display: grid; grid-template-columns: auto auto; gap: 5px 18px; justify-content: end; text-align: right; }
    .meta dt { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--faint); align-self: center; }
    .meta dd { font-size: 13px; color: var(--ink); }

    .rule { border: none; border-top: 1px solid var(--hair); margin: 28px 0; }

    /* Bill to */
    .bill-to { margin: 4px 0 34px; }
    .bill-to .client { font-family: "Fraunces", Georgia, serif; font-size: 19px; font-weight: 500; color: var(--ink); margin-top: 8px; }

    /* Items */
    table { width: 100%; border-collapse: collapse; }
    thead th { text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--faint); padding: 0 0 12px; border-bottom: 1.5px solid var(--ink); }
    thead th.right { text-align: right; }
    tbody td { padding: 15px 0; border-bottom: 1px solid var(--hair); vertical-align: top; }
    tbody td.desc { font-weight: 500; color: var(--ink); padding-right: 20px; }
    tbody td.right { text-align: right; color: var(--taupe); }
    tbody tr:last-child td { border-bottom: none; }

    /* Totals */
    .totals { display: flex; justify-content: flex-end; margin-top: 8px; }
    .totals-inner { width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 7px 0; color: var(--taupe); font-size: 13px; }
    .totals-row.grand { margin-top: 6px; padding-top: 14px; border-top: 1px solid var(--ink); color: var(--ink); }
    .totals-row.grand span:first-child { font-family: "Fraunces", Georgia, serif; font-size: 16px; font-weight: 500; }
    .totals-row.grand span:last-child { font-family: "Fraunces", Georgia, serif; font-size: 19px; font-weight: 600; }

    /* Payment */
    .payment { margin-top: 44px; background: var(--panel); border: 1px solid var(--hair); border-radius: 12px; padding: 22px 26px; }
    .payment .eyebrow { margin-bottom: 14px; }
    .payment-row { display: flex; gap: 16px; padding: 4px 0; font-size: 13px; }
    .payment-label { color: var(--taupe); min-width: 170px; }
    .payment-value { color: var(--ink); font-weight: 500; }

    /* Footer */
    .footer { margin-top: 48px; padding-top: 22px; border-top: 1px solid var(--hair); text-align: center; }
    .footer span { font-family: "Fraunces", Georgia, serif; font-style: italic; font-size: 13px; color: var(--faint); }
  </style>
</head>
<body>
  <div class="topbar"></div>
  <div class="sheet">

    <div class="header">
      <div>
        ${data.business.logoUrl
          ? `<img class="logo" src="${data.business.logoUrl}" alt="${data.business.name}" />`
          : ""}
        <div class="biz-name">${data.business.name}</div>
        <div class="biz-meta">
          ${addressHtml}${data.business.email ? `<br/>${data.business.email}` : ""}
        </div>
      </div>
      <div>
        <div class="invoice-title">INVOICE</div>
        <dl class="meta">
          <dt>No.</dt><dd>${data.invoiceNumber}</dd>
          <dt>Issued</dt><dd>${data.issueDate}</dd>
          <dt>Due</dt><dd>${data.dueDate}</dd>
        </dl>
      </div>
    </div>

    <hr class="rule" />

    <div class="bill-to">
      <div class="eyebrow">Billed to</div>
      <div class="client">${data.client.name}</div>
    </div>

    <table>
      <thead>${tableHead}</thead>
      <tbody>${tableBody}</tbody>
    </table>

    <div class="totals">
      <div class="totals-inner">
        ${totalsRows}
      </div>
    </div>

    ${paymentBlock}

    <div class="footer"><span>Thank you for your business.</span></div>

  </div>
</body>
</html>`;
}
