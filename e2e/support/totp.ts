import { authenticator } from 'otplib';

// RFC-6238 TOTP. otplib's `authenticator` defaults match Supabase's TOTP factor
// (SHA1, 6 digits, 30s step), so codes generated here clear the MFA challenge.
export function generateTotp(secret: string): string {
  return authenticator.generate(secret);
}
