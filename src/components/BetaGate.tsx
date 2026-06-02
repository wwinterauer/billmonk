import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Cookie/localStorage are NOT used for authorization — only as a UX hint so
 * anonymous browsers that already redeemed a beta code don't see the gate
 * again. All real authorization lives in server-side `profiles` fields
 * (plan, is_beta_user, beta_expires_at) and is enforced by RLS + DB trigger.
 */
function hasUxBetaHint(): boolean {
  if (localStorage.getItem('beta_access') === 'true') return true;
  return document.cookie.split(';').some(c => c.trim().startsWith('beta_access=true'));
}

function setUxBetaHint() {
  localStorage.setItem('beta_access', 'true');
  const expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `beta_access=true; expires=${expires}; path=/; SameSite=Lax`;
}

function clearUxBetaHint() {
  localStorage.removeItem('beta_access');
  document.cookie = 'beta_access=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

const EXEMPT_ROUTES = ['/beta', '/datenschutz', '/unsubscribe', '/share-receive', '/login', '/register', '/reset-password', '/forgot-password'];
const PAID_PLANS = ['starter', 'pro', 'business'];

interface BetaGateProps {
  children: React.ReactNode;
}

type GateState =
  | { status: 'loading' }
  | { status: 'allowed' }
  | { status: 'denied' };

export function BetaGate({ children }: BetaGateProps) {
  const location = useLocation();
  const [state, setState] = useState<GateState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Logged-in users: source of truth is the server. Never trust the UX cookie alone.
        if (user) {
          const [profileRes, roleRes] = await Promise.all([
            supabase
              .from('profiles')
              .select('plan, beta_expires_at, is_beta_user')
              .eq('id', user.id)
              .maybeSingle(),
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .eq('role', 'admin')
              .maybeSingle(),
          ]);

          if (cancelled) return;

          const profile = profileRes.data as any;
          const isAdmin = !!roleRes.data;
          const plan = profile?.plan as string | undefined;
          const isPaid = plan ? PAID_PLANS.includes(plan) : false;
          const expired = profile?.beta_expires_at && new Date(profile.beta_expires_at) < new Date();
          const isBeta = !!profile?.is_beta_user && !expired;

          if (isAdmin || isPaid || isBeta) {
            setUxBetaHint();
            setState({ status: 'allowed' });
          } else {
            clearUxBetaHint();
            setState({ status: 'denied' });
          }
          return;
        }

        // Anonymous users: gate is UX-only. Privilege escalation is blocked by DB trigger.
        setState({ status: hasUxBetaHint() ? 'allowed' : 'denied' });
      } catch {
        if (cancelled) return;
        // On error, fail closed for safety
        setState({ status: 'denied' });
      }
    };

    check();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (EXEMPT_ROUTES.some(r => location.pathname.startsWith(r))) {
    return <>{children}</>;
  }

  if (state.status === 'loading') {
    return null;
  }

  if (state.status === 'denied') {
    return <Navigate to="/beta" replace />;
  }

  return <>{children}</>;
}
