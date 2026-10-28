// TaskForMyAgent — پنل ادمین: ماژول‌های پیش‌فرض هر کسب‌وکار (defaultModulesForIndustry)
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_DEFAULT_MODULES,
  INDUSTRY_DEFAULT_MODULES,
  MODULE_DEPENDENCIES,
  MODULE_KEYS,
  MODULE_LABELS,
  defaultModulesForIndustry,
  resolveModuleDependencies,
  type ModuleKey,
} from './modules.js';

describe('module registry', () => {
  it('has a label for every module key', () => {
    for (const key of MODULE_KEYS) {
      expect(MODULE_LABELS[key]).toBeTruthy();
    }
  });

  it('only depends on known module keys', () => {
    const known = new Set<string>(MODULE_KEYS);
    for (const deps of Object.values(MODULE_DEPENDENCIES)) {
      for (const dep of deps) expect(known.has(dep)).toBe(true);
    }
  });

  it('only references known modules in industry defaults', () => {
    const known = new Set<string>(MODULE_KEYS);
    for (const modules of Object.values(INDUSTRY_DEFAULT_MODULES)) {
      for (const key of modules) expect(known.has(key)).toBe(true);
    }
  });

  it('returns the industry default set when one is defined', () => {
    expect(defaultModulesForIndustry('SPORTS_COACHING')).toEqual(
      INDUSTRY_DEFAULT_MODULES.SPORTS_COACHING,
    );
  });

  it('falls back for unknown or missing industries', () => {
    expect(defaultModulesForIndustry('NOT_A_VERTICAL')).toEqual(FALLBACK_DEFAULT_MODULES);
    expect(defaultModulesForIndustry(null)).toEqual(FALLBACK_DEFAULT_MODULES);
    expect(defaultModulesForIndustry(undefined)).toEqual(FALLBACK_DEFAULT_MODULES);
  });

  it('returns a copy so callers cannot mutate the registry', () => {
    const first = defaultModulesForIndustry('BEAUTY');
    first.push('HR');
    expect(defaultModulesForIndustry('BEAUTY')).toEqual(INDUSTRY_DEFAULT_MODULES.BEAUTY);
  });

  // The education verticals used to fall back to CRM/SCH/FIN/RPT, which left
  // their زبان‌آموز/هنرجو without a customer portal (`/app/*` → MODULE_DISABLED).
  it('gives every education vertical the end-user portal', () => {
    for (const industry of ['LANGUAGE_SCHOOL', 'ART_MUSIC', 'EARLY_CHILD', 'SPORTS_COACHING']) {
      expect(defaultModulesForIndustry(industry)).toContain('APP');
    }
  });
});

describe('resolveModuleDependencies', () => {
  it('returns the module itself when it has no dependencies', () => {
    expect(resolveModuleDependencies(['INV'])).toEqual(['INV']);
  });

  it('pulls in a single level of dependencies', () => {
    const resolved = new Set(resolveModuleDependencies(['SCH']));
    expect(resolved).toEqual(new Set<ModuleKey>(['CRM', 'SCH']));
  });

  it('resolves transitively (SUB -> FIN -> CRM)', () => {
    const resolved = resolveModuleDependencies(['SUB']);
    expect(new Set(resolved)).toEqual(new Set<ModuleKey>(['CRM', 'FIN', 'SUB']));
  });

  it('deduplicates shared dependencies across requested modules', () => {
    const resolved = resolveModuleDependencies(['SCH', 'FIN', 'MSG']);
    expect(new Set(resolved)).toEqual(new Set<ModuleKey>(['CRM', 'SCH', 'FIN', 'MSG']));
    expect(resolved.filter((k) => k === 'CRM')).toHaveLength(1);
  });

  it('orders dependencies before dependents', () => {
    const resolved = resolveModuleDependencies(['SUB']);
    expect(resolved.indexOf('CRM')).toBeLessThan(resolved.indexOf('FIN'));
    expect(resolved.indexOf('FIN')).toBeLessThan(resolved.indexOf('SUB'));
  });
});
