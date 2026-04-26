// Infer a pricing-kind label from an agent's freeform `pricing` string.
// Returns a stable kind that maps to a CSS class (price-free, price-paid, etc.)
// and a human-readable label for the badge.

export type PricingKind = 'free' | 'freemium' | 'paid' | 'open-source' | 'blueprint';

export interface PricingBadge {
  kind: PricingKind;
  label: string;
  className: string;
}

const PAID_INDICATORS =
  /\b(paid|enterprise|tier|plan|custom|subscription|per-release|add-on|included)\b|\$\d|\/(?:mo|yr|year|month|release|seat)/i;

export function inferPricing(pricing?: string | null): PricingBadge {
  const p = (pricing ?? '').toLowerCase();

  if (p.includes('open source')) {
    return { kind: 'open-source', label: 'Open Source', className: 'price price-open-source' };
  }
  if (p.includes('blueprint')) {
    return { kind: 'blueprint', label: 'Blueprint', className: 'price price-blueprint' };
  }

  const hasFree = /\bfree\b/.test(p);
  const hasPaid = PAID_INDICATORS.test(p);

  if (hasFree && hasPaid) {
    return { kind: 'freemium', label: 'Freemium', className: 'price price-freemium' };
  }
  if (hasFree) {
    return { kind: 'free', label: 'Free', className: 'price price-free' };
  }
  return { kind: 'paid', label: 'Paid', className: 'price price-paid' };
}
