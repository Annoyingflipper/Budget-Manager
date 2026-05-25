import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type Props = { onSwitch: () => void };

export default function Login({ onSwitch }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <div className="mx-auto max-w-sm p-8 space-y-4">
      <div className="text-center mb-2">
        <div className="text-4xl mb-1">🍑</div>
        <h1 className="text-2xl font-extrabold">Budget</h1>
      </div>
      <form onSubmit={submit} className="space-y-2">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-highlight bg-card rounded-lg px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-highlight bg-card rounded-lg px-3 py-2"
          required
        />
        {error && <p className="text-negative text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-hero-bg text-hero-text rounded-lg py-2 font-bold disabled:opacity-50"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <button
        type="button"
        onClick={onSwitch}
        className="text-sm text-muted underline"
      >
        Need an account? Sign up
      </button>
    </div>
  );
}
