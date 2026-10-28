import { describe, expect, it } from 'vitest';
import {
  INDUSTRY_DEFAULT_MODULES,
  MODULE_DEPENDENCIES,
  MODULE_KEYS,
  MODULE_LABELS,
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
