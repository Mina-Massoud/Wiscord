export interface SubscriptionResponse {
  status: 'none' | 'active' | 'trialing' | 'past_due' | 'canceled';
  tier: 'free' | 'pro';
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
}

export interface CheckoutSessionResponse {
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

export interface InvoiceItem {
  id: string;
  amountPaid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  createdAt: string;
}
