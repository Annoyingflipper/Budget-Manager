import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export default function MFAEnroll() {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function enroll() {
      setBusy(true);
      const appUrl = import.meta.env.VITE_APP_URL;
      const issuer = appUrl ? new URL(appUrl).host : window.location.host;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer,
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (cancelled) return;
      setBusy(false);
      if (error) { setError(error.message); return; }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    enroll();
    return () => { cancelled = true; };
  }, []);

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setBusy(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setError(challenge.error.message);
      setBusy(false);
      return;
    }
    const result = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    setBusy(false);
    if (result.error) setError(result.error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="mx-auto max-w-sm p-8 space-y-4">
      <div className="text-center">
        <div className="text-4xl mb-1">🔐</div>
        <h1 className="text-xl font-extrabold">Set up two-factor authentication</h1>
      </div>
      <p className="text-sm text-muted">
        Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy, etc.),
        then enter the 6-digit code to confirm.
      </p>
      {qr && (
        <img
          src={qr}
          alt="TOTP QR code"
          className="border border-highlight rounded-lg mx-auto bg-card p-2"
          width={200}
          height={200}
        />
      )}
      {secret && (
        <p className="text-xs text-muted break-all">
          Or enter this secret manually:{' '}
          <code className="bg-bg px-1 rounded-sm">{secret}</code>
        </p>
      )}
      <form onSubmit={verify} className="space-y-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full border border-highlight bg-card rounded-lg px-3 py-2 text-center text-lg tracking-widest"
          required
        />
        {error && <p className="text-negative text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full bg-hero-bg text-hero-text rounded-lg py-2 font-bold disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Verify and continue'}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="w-full text-sm text-muted underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
