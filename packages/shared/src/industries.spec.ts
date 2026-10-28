// TaskForMyAgent — صنف زبان‌آموز و صنف‌های آموزشی باید «آموزشگاه» تعریف کنند (نام شعبه‌ها)
import { describe, expect, it } from 'vitest';
import {
  BRANCH_NOUNS,
  DEFAULT_BRANCH_NOUN,
  DEFAULT_BRANCH_NOUN_PLURAL,
  INDUSTRY_CATEGORIES,
  branchNoun,
  endUserNoun,
} from './industries.js';

describe('branchNoun', () => {
  it('calls a language school location «آموزشگاه»', () => {
    expect(branchNoun('LANGUAGE_SCHOOL')).toBe('آموزشگاه');
    expect(branchNoun('LANGUAGE_SCHOOL', true)).toBe('آموزشگاه‌ها');
    expect(branchNoun('ART_MUSIC')).toBe('آموزشگاه');
  });

  it('falls back to «شعبه» for industries without their own word', () => {
    expect(branchNoun('RETAIL')).toBe(DEFAULT_BRANCH_NOUN);
    expect(branchNoun('RETAIL', true)).toBe(DEFAULT_BRANCH_NOUN_PLURAL);
    expect(branchNoun('custom_unknown')).toBe(DEFAULT_BRANCH_NOUN);
    expect(branchNoun(null, true)).toBe(DEFAULT_BRANCH_NOUN_PLURAL);
  });

  it('never leaks an education word into another industry', () => {
    const withOverrides = INDUSTRY_CATEGORIES.filter((key) => BRANCH_NOUNS[key]);
    expect(withOverrides.sort()).toEqual(['ART_MUSIC', 'EARLY_CHILD', 'LANGUAGE_SCHOOL']);
  });

  it('keeps the end-user noun independent from the location noun', () => {
    // A language school has «زبان‌آموز»s spread over several «آموزشگاه»s.
    expect(endUserNoun('LANGUAGE_SCHOOL')).toBe('زبان‌آموز');
    expect(branchNoun('LANGUAGE_SCHOOL')).toBe('آموزشگاه');
  });
});
