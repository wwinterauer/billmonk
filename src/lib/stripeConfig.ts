import { PlanType } from './planConfig';

export interface StripeTier {
  productId: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
}

export const STRIPE_TIERS: Record<Exclude<PlanType, 'free'>, StripeTier> = {
  starter: {
    productId: 'prod_UAKsQZUmnXhFJi',
    monthlyPriceId: 'price_1TC0Cm1lIffwSHcfSGaHWJwm',
    yearlyPriceId: 'price_1TC0JQ1lIffwSHcfQJV16UzW',
  },
  pro: {
    productId: 'prod_UBNbFH4F60Dh7H',
    monthlyPriceId: 'price_1TD0qD1lIffwSHcfJS4eRofs',
    yearlyPriceId: 'price_1TC0Oj1lIffwSHcfpURB4LEk',
  },
  business: {
    productId: 'prod_UAKwFsOsukVbz4',
    monthlyPriceId: 'price_1TC0Go1lIffwSHcfAGnAso6b',
    yearlyPriceId: 'price_1TC0sy1lIffwSHcfNYG6ZXrm',
  },
};

// Map Stripe product IDs back to plan types
export const PRODUCT_TO_PLAN: Record<string, PlanType> = {
  'prod_UAKsQZUmnXhFJi': 'starter',
  'prod_UAKtEUTzqyQ44I': 'pro',
  'prod_UBNbFH4F60Dh7H': 'pro',
  'prod_UAKwFsOsukVbz4': 'business',
  // Yearly products map to same plans
  'prod_UAKzP7PQ5abo5z': 'starter',
  'prod_UAL40QoQd3uz1M': 'pro',
  'prod_UALa7l2kwi1LnO': 'business',
};
