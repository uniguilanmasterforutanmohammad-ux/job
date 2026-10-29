import { API_BASE } from './api-client';

export type MarketplaceTenant = {
  slug: string;
  name: string;
  industry: string;
  logoUrl: string | null;
  tagline: string | null;
  city: string | null;
};

export type MarketplaceProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  salePrice: string;
  imageUrl: string | null;
  stock: string;
  createdAt: string;
  tenant: MarketplaceTenant;
  rating?: MarketplaceRating;
};

export type MarketplaceRating = {
  average: number;
  count: number;
  distribution: { rating: number; count: number }[];
};

export type MarketplaceReview = {
  id: string;
  rating: number;
  comment: string | null;
  isVerified: boolean;
  createdAt: string;
  authorName: string;
};

export type MarketplaceService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  price: string;
  createdAt: string;
  tenant: MarketplaceTenant;
  rating?: MarketplaceRating;
};

export type MarketplaceBusiness = MarketplaceTenant & {
  productCount: number;
  serviceCount: number;
};

export type MarketplaceMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MarketplacePage<T> = { data: T[]; meta: MarketplaceMeta };

export type MarketplaceStorefront = {
  tenant: MarketplaceTenant & { address: string | null; phone: string | null };
  products: MarketplaceProduct[];
  services: MarketplaceService[];
};

export type MarketplaceFacets = {
  productCategories: string[];
  serviceCategories: string[];
  industries: string[];
};

export type MarketplaceTrackedOrder = {
  id: string;
  number: string;
  status: string;
  items: Array<{ title: string; quantity: number; unitPrice: number }>;
  subtotal: string;
  shippingCost: string;
  total: string;
  trackingCode: string | null;
  shippingMethod: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: { slug: string; name: string };
};

/** Server-side fetch with a short revalidation window (SEO-friendly pages). */
export async function marketplaceGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/public/marketplace${path}`, {
    next: { revalidate: 60 },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message ?? 'خطا در دریافت دادهٔ بازارگاه');
  }
  return json.data as T;
}

/** Client-side fetch (cart / tracking) without Next-specific options. */
export async function marketplaceFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/public/marketplace${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message ?? 'خطا در ارتباط با بازارگاه');
  }
  return json.data as T;
}

export function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
