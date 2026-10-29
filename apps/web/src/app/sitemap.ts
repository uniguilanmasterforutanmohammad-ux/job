import type { MetadataRoute } from 'next';
import type {
  MarketplaceBusiness,
  MarketplacePage,
  MarketplaceProduct,
  MarketplaceService,
} from '@/lib/marketplace';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function list<T>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/public/marketplace${path}`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as {
      data?: MarketplacePage<T> | T[];
    };
    const payload = json.data;
    return Array.isArray(payload) ? payload : (payload?.data ?? []);
  } catch {
    return [];
  }
}

/**
 * Public discovery routes. Account areas (`/admin`, `/dashboard`, `/me`,
 * `/payments`) are intentionally absent — robots.txt also blocks them.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const now = new Date();

  const [products, services, businesses] = await Promise.all([
    list<MarketplaceProduct>('/products?pageSize=48&sort=newest'),
    list<MarketplaceService>('/services?pageSize=48&sort=newest'),
    list<MarketplaceBusiness>('/businesses'),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/marketplace`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${base}/marketplace/products`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/marketplace/services`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/marketplace/businesses`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  return [
    ...staticRoutes,
    ...products.map((product) => ({
      url: `${base}/marketplace/products/${product.id}`,
      lastModified: product.createdAt ? new Date(product.createdAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...services.map((service) => ({
      url: `${base}/marketplace/services/${service.id}`,
      lastModified: service.createdAt ? new Date(service.createdAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...businesses.map((business) => ({
      url: `${base}/marketplace/b/${business.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
