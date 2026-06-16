import { describe, expect, it } from 'vitest';
import { isValidEmail, passwordStrength } from '../validation';

describe('isValidEmail', () => {
  it('accepts a standard email', () => {
    expect(isValidEmail('raisha@winx.dev')).toBe(true);
  });

  it('accepts subdomains and plus tags', () => {
    expect(isValidEmail('user+tag@mail.example.co')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects missing @', () => {
    expect(isValidEmail('raisha.winx.dev')).toBe(false);
  });

  it('rejects missing local part', () => {
    expect(isValidEmail('@winx.dev')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(isValidEmail('raisha@')).toBe(false);
  });

  it('rejects missing TLD', () => {
    expect(isValidEmail('raisha@winx')).toBe(false);
  });

  it('rejects spaces in local part', () => {
    expect(isValidEmail('ra isha@winx.dev')).toBe(false);
  });

  it('trims whitespace before validating', () => {
    expect(isValidEmail('  raisha@winx.dev  ')).toBe(true);
  });
});

describe('passwordStrength', () => {
  it('returns score 0 for empty password', () => {
    const r = passwordStrength('');
    expect(r.score).toBe(0);
    expect(r.label).toBe('—');
  });

  it('flags passwords under 6 chars as Too short (score 1)', () => {
    const r = passwordStrength('abc');
    expect(r.score).toBe(1);
    expect(r.label).toBe('Too short');
    expect(r.hint).toBeDefined();
  });

  it('rates 6-7 chars with no variety as Weak (score 2)', () => {
    const r = passwordStrength('abcdef');
    expect(r.score).toBe(2);
    expect(r.label).toBe('Weak');
  });

  it('rates 8+ chars with 2 varieties as Good (score 3)', () => {
    const r = passwordStrength('abcdef12');
    expect(r.score).toBe(3);
    expect(r.label).toBe('Good');
  });

  it('rates 12+ chars with 3+ varieties as Strong (score 4)', () => {
    const r = passwordStrength('Abcdef123!@#');
    expect(r.score).toBe(4);
    expect(r.label).toBe('Strong');
  });

  it('rates 14+ mixed-case + symbol as Strong', () => {
    const r = passwordStrength('SuperSecretP@ss123');
    expect(r.score).toBe(4);
  });

  it('returns a color for every score', () => {
    for (const pwd of ['', 'a', 'abcdef', 'Abcdef12', 'Abcdef123!@#']) {
      const r = passwordStrength(pwd);
      expect(r.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
