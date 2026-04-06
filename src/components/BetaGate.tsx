import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function hasBetaAccess(): boolean {
  if (localStorage.getItem('beta_access') === 'true') return true;
  return document.cookie.split(';').some(c => c.trim().startsWith('beta_access=true'));
}

const EXEMPT_ROUTES = ['/beta', '/datenschutz', '/unsubscribe', '/share-receive'];

interface BetaGateProps {
  children: React.ReactNode;
}

export function BetaGate({ children }: BetaGateProps) {
  const location = useLocation();
  const [checked, setChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(hasBetaAccess());

  // Check beta_expires_at for logged-in users
  useEffect(() => {
    const checkExpiry = async () => {
      if (!hasBetaAccess()) {
        setChecked(true);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setChecked(true);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('beta_expires_at, is_beta_user')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.beta_expires_at && new Date(profile.beta_expires_at) < new Date()) {
          // Beta expired — revoke access
          localStorage.removeItem('beta_access');
          document.cookie = 'beta_access=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          setHasAccess(false);
        }
      } catch {
        // Non-critical
      }
      setChecked(true);
    };

    checkExpiry();
  }, [location.pathname]);

  if (EXEMPT_ROUTES.some(r => location.pathname.startsWith(r))) {
    return <>{children}</>;
  }

  // Wait for expiry check on first render
  if (!checked && hasBetaAccess()) {
    return null; // brief loading
  }

  if (!hasAccess) {
    return <Navigate to="/beta" replace />;
  }

  return <>{children}</>;
}
