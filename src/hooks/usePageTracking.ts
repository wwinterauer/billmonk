import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function getSessionId(): string {
  let id = sessionStorage.getItem('pv_session');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('pv_session', id);
  }
  return id;
}

export function usePageTracking() {
  const location = useLocation();
  const lastPath = useRef('');

  useEffect(() => {
    const path = location.pathname;
    if (path === lastPath.current) return;
    lastPath.current = path;

    // Don't track admin pages
    if (path.startsWith('/admin')) return;

    supabase.from('page_views').insert({
      path,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      session_id: getSessionId(),
    } as any).then(); // fire and forget
  }, [location.pathname]);
}
