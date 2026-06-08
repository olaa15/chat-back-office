export interface InvoiceTotals {
  subtotal: number;
  vatRate: number;
  tax: number;
  total: number;
}

export function computeInvoiceTotals(amount: number, vatRatePercent: number): InvoiceTotals {
  const subtotal = Number(amount.toFixed(2));
  const vatRate = Number(vatRatePercent.toFixed(2));
  const tax = Number(((subtotal * vatRate) / 100).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  return { subtotal, vatRate, tax, total };
}
