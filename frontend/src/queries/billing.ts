import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from './client';
import { qk } from './keys';

export type SubscriptionStatus = 'none' | 'active' | 'trialing' | 'past_due' | 'canceled';
export type SubscriptionTier = 'free' | 'pro';

export interface Subscription {
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
}

export interface Invoice {
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

export function useSubscription() {
  return useQuery({
    queryKey: qk.billing.subscription(),
    queryFn: () => api<Subscription>('/billing/subscription'),
    staleTime: 30 * 1000,
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: qk.billing.invoices(),
    queryFn: () => api<Invoice[]>('/billing/invoices'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: (returnPath?: string) =>
      api<{ url: string }>('/billing/checkout-session', {
        method: 'POST',
        body: returnPath ? { returnPath } : {},
      }),
  });
}

export function useOpenPortal() {
  return useMutation({
    mutationFn: (returnPath?: string) =>
      api<{ url: string }>('/billing/portal-session', {
        method: 'POST',
        body: returnPath ? { returnPath } : {},
      }),
  });
}
