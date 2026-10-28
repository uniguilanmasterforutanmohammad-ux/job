/**
 * Slug helpers shared by the self-service signup flow and the platform admin
 * console, so a tenant created from either path gets the same `biz-*` slug.
 */
export function slugifyBusinessName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, '')
    .slice(0, 40);
  return base || 'business';
}

/**
 * Returns a free tenant slug derived from `name`. `exists` is injected so the
 * caller decides how to query (Prisma client, transaction, …).
 */
export async function uniqueTenantSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugifyBusinessName(name);
  let candidate = base.startsWith('biz-') ? base : `biz-${base}`;
  let suffix = 1;
  while (await exists(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}
