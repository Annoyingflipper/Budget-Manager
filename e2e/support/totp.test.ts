import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import { generateTotp } from './totp';

describe('generateTotp', () => {
  it('produces a 6-digit numeric code', () => {
    const secret = authenticator.generateSecret();
    const code = generateTotp(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('produces a code the same secret verifies', () => {
    const secret = authenticator.generateSecret();
    const code = generateTotp(secret);
    expect(authenticator.verify({ token: code, secret })).toBe(true);
  });
});
