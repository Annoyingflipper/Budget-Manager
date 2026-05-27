import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import MFAEnroll from './MFAEnroll';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      mfa: {
        enroll: vi.fn(),
      },
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_APP_URL', 'https://budget-manager-qa.vercel.app');
  vi.mocked(supabase.auth.mfa.enroll).mockResolvedValue({
    data: {
      id: 'factor-id',
      type: 'totp',
      totp: { qr_code: 'data:image/png;base64,zz', secret: 'ABCD', uri: 'otpauth://totp/x' },
      friendly_name: 'Authenticator',
    },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabase.auth.mfa.enroll>>);
});

describe('MFAEnroll', () => {
  it('enrolls TOTP with issuer derived from VITE_APP_URL host', async () => {
    render(<MFAEnroll />);
    await waitFor(() => {
      expect(supabase.auth.mfa.enroll).toHaveBeenCalledWith(
        expect.objectContaining({
          factorType: 'totp',
          issuer: 'budget-manager-qa.vercel.app',
        }),
      );
    });
  });
});
