import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Login from './Login';
import Signup from './Signup';
import MFAEnroll from './MFAEnroll';
import MFAChallenge from './MFAChallenge';

type GateState =
  | { kind: 'loading' }
  | { kind: 'unauthed-login' }
  | { kind: 'unauthed-signup' }
  | { kind: 'needs-enroll' }
  | { kind: 'needs-challenge' }
  | { kind: 'authed' };

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: 'loading' });

  useEffect(() => {
    let mounted = true;

    async function evaluate(session: Session | null) {
      if (!session) {
        if (mounted) setState({ kind: 'unauthed-login' });
        return;
      }
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        if (mounted) setState({ kind: 'unauthed-login' });
        return;
      }
      // currentLevel: aal user has right now in this session
      // nextLevel:    the highest aal they could reach with their enrolled factors
      if (data.currentLevel === 'aal2') {
        if (mounted) setState({ kind: 'authed' });
      } else if (data.nextLevel === 'aal2') {
        if (mounted) setState({ kind: 'needs-challenge' });
      } else {
        if (mounted) setState({ kind: 'needs-enroll' });
      }
    }

    supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      evaluate(session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state.kind === 'loading') return <div className="p-8">Loading…</div>;
  if (state.kind === 'unauthed-login')
    return <Login onSwitch={() => setState({ kind: 'unauthed-signup' })} />;
  if (state.kind === 'unauthed-signup')
    return <Signup onSwitch={() => setState({ kind: 'unauthed-login' })} />;
  if (state.kind === 'needs-enroll') return <MFAEnroll />;
  if (state.kind === 'needs-challenge') return <MFAChallenge />;
  return <>{children}</>;
}
