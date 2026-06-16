/**
 * Lightweight password strength estimator. Returns 0-4 with a label and color.
 * Not zxcvbn-grade — good enough for inline UI feedback.
 */
export function passwordStrength(pwd: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  hint?: string;
} {
  if (!pwd) return { score: 0, label: '—', color: '#d3c2cb' };

  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  const len = pwd.length;

  if (len < 6) {
    return { score: 1, label: 'Too short', color: '#ba1a1a', hint: 'Use at least 6 characters' };
  }
  if (len < 8 || variety < 2) {
    return { score: 2, label: 'Weak', color: '#ffaa3a', hint: 'Add uppercase, numbers, or symbols' };
  }
  if (len < 12 || variety < 3) {
    return { score: 3, label: 'Good', color: '#94f1fb', hint: 'Mix in symbols to make it strong' };
  }
  return { score: 4, label: 'Strong', color: '#b1dd00' };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}
