import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export default function MFAChallenge() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (error) { setError(error.message); return; }
      const totp = data.totp.find((f) => f.status === 'verified');
      if (!totp) { setError('No verified TOTP factor found.'); return; }
      setFactorId(totp.id);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function submit(e: FormEvent) {
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
    <div className="mx-auto max-w-md p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Authenticator code</h1>
      <p className="text-sm text-gray-600">
        Enter the 6-digit code from your authenticator app.
      </p>
      <form onSubmit={submit} className="space-y-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
          autoFocus
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Continue'}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="w-full text-sm text-gray-500 underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
