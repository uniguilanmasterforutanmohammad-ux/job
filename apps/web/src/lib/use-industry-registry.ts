'use client';

import { useQuery } from '@tanstack/react-query';
import {
  endUserNoun as fallbackEndUserNoun,
  industryLabel as fallbackIndustryLabel,
  type ModuleKey,
} from '@repo/shared';
import { api } from './api-client';

/** One row of the public industry registry (`GET /industries`). */
export type IndustryRegistryEntry = {
  industry: string;
  label: string;
  description: string | null;
  endUserNoun: string | null;
  endUserNounPlural: string | null;
  isRegistrationEnabled: boolean;
  defaultModules: ModuleKey[];
};

/**
 * Public industry registry, shared by every screen that has to name an
 * industry or its end-users. Labels and nouns come from the platform registry
 * (so custom industries work too) and fall back to the PRD reference data in
 * `@repo/shared` while the request is in flight.
 */
export function useIndustryRegistry() {
  const query = useQuery({
    queryKey: ['public-industries'],
    queryFn: () => api.get<IndustryRegistryEntry[]>('/industries'),
  });
  const byKey = new Map((query.data ?? []).map((item) => [item.industry, item]));

  return {
    ...query,
    entries: query.data ?? [],
    label: (key?: string | null) => (key && byKey.get(key)?.label) || fallbackIndustryLabel(key ?? ''),
    noun: (key?: string | null, plural = false) => {
      const row = key ? byKey.get(key) : undefined;
      const value = plural ? row?.endUserNounPlural : row?.endUserNoun;
      return value || fallbackEndUserNoun(key, plural);
    },
  };
}
