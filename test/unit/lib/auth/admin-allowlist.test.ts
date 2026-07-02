import { describe, it, expect } from 'vitest';
import { isAllowlistedAdmin } from '@/lib/auth/admin-allowlist';

describe('isAllowlistedAdmin', () => {
  it('returns true when email is in allowlist (exact match)', () => {
    expect(isAllowlistedAdmin('a@b.com', 'a@b.com,c@d.com')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAllowlistedAdmin('A@B.com', 'a@b.com')).toBe(true);
  });

  it('trims whitespace in allowlist entries', () => {
    expect(isAllowlistedAdmin('a@b.com', '  a@b.com , c@d.com  ')).toBe(true);
  });

  it('returns false when not in allowlist', () => {
    expect(isAllowlistedAdmin('x@y.com', 'a@b.com')).toBe(false);
  });

  it('returns false for empty allowlist', () => {
    expect(isAllowlistedAdmin('a@b.com', '')).toBe(false);
  });

  it('returns false for empty email', () => {
    expect(isAllowlistedAdmin('', 'a@b.com')).toBe(false);
  });
});
