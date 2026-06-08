import Stripe from "stripe";

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

export async function createCheckoutSession(params: {
  invoiceId: string;
  businessId: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  currency: string;
}): Promise<CheckoutResult> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const baseUrl = process.env.WEBHOOK_URL ?? "https://example.com";
  const expiresAt = Math.floor(Date.now() / 1000) + 23 * 60 * 60; // 23 hours (Stripe max is 24h)

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: Math.round(params.amount * 100), // Stripe uses smallest currency unit
          product_data: {
            name: params.invoiceNumber,
            description: params.description,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: params.invoiceId,
      business_id: params.businessId,
    },
    success_url: `${baseUrl}/payment-success`,
    cancel_url: `${baseUrl}/payment-cancel`,
    expires_at: expiresAt,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  return { url: session.url, sessionId: session.id };
}
