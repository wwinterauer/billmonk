import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function hasBetaAccess(): boolean {
  if (localStorage.getItem('beta_access') === 'true') return true;
  return document.cookie.split(';').some(c => c.trim().startsWith('beta_access=true'));
}

function grantLocalAccess() {
  localStorage.setItem('beta_access', 'true');
  const expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `beta_access=true; expires=${expires}; path=/; SameSite=Lax`;
}

function revokeLocalAccess() {
  localStorage.removeItem('beta_access');
  document.cookie = 'beta_access=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

const EXEMPT_ROUTES = ['/beta', '/datenschutz', '/unsubscribe', '/share-receive', '/login', '/register', '/reset-password', '/forgot-password'];
const PAID_PLANS = ['starter', 'pro', 'business'];

interface BetaGateProps {
  children: React.ReactNode;
}

export function BetaGate({ children }: BetaGateProps) {
  const location = useLocation();
  const [checked, setChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(hasBetaAccess());

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setChecked(true);
          return;
        }

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

        const profile = profileRes.data as any;
        const isAdmin = !!roleRes.data;
        const plan = profile?.plan as string | undefined;
        const isPaid = plan ? PAID_PLANS.includes(plan) : false;
        const expired = profile?.beta_expires_at && new Date(profile.beta_expires_at) < new Date();
        const isBeta = !!profile?.is_beta_user && !expired;

        if (isAdmin || isPaid || isBeta) {
          if (!hasBetaAccess()) {
            grantLocalAccess();
            setHasAccess(true);
          }
        } else if (expired && hasBetaAccess()) {
          revokeLocalAccess();
          setHasAccess(false);
        }
      } catch {
        // Non-critical
      }
      setChecked(true);
    };

    check();
  }, [location.pathname]);

  if (EXEMPT_ROUTES.some(r => location.pathname.startsWith(r))) {
    return <>{children}</>;
  }

  // Wait for check before redirecting on first render
  if (!checked) {
    return null;
  }

  if (!hasAccess) {
    return <Navigate to="/beta" replace />;
  }

  return <>{children}</>;
}
