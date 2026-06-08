export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  business: {
    name: string;
    address: string;
    email: string;
    logoUrl?: string;
  };
  client: { name: string };
  lineItem: { description: string; amount: number };
  totals: { subtotal: number; vatRate: number; tax: number; total: number };
  currency: string;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

export function buildInvoiceHtml(data: InvoiceData): string {
  const amount = formatCurrency(data.lineItem.amount, data.currency);
  const { vatRate } = data.totals;
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

    /* Footer */
    .footer { margin-top: 56px; font-size: 12px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      ${data.business.logoUrl
        ? `<img src="${data.business.logoUrl}" alt="${data.business.name}" style="height:48px;object-fit:contain;margin-bottom:8px;display:block;" />`
        : `<div class="business-name">${data.business.name}</div>`}
      <div class="business-meta">
        ${data.business.address}<br/>
        ${data.business.email}
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
      <tr>
        <th>Description</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${data.lineItem.description}</td>
        <td class="right">${amount}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <table>
      ${totalsRows}
    </table>
  </div>

  <div class="footer">Thank you for your business.</div>

</div>
</body>
</html>`;
}
