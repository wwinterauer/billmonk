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

    const record: any = {
      path,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      session_id: getSessionId(),
    };

    // Try to get country from cached value or geo API
    const cachedCountry = sessionStorage.getItem('pv_country');
    if (cachedCountry) {
      record.country = cachedCountry;
      supabase.from('page_views').insert(record).then();
    } else {
      fetch('https://ip-api.com/json/?fields=countryCode')
        .then(r => r.json())
        .then(data => {
          if (data?.countryCode) {
            sessionStorage.setItem('pv_country', data.countryCode);
            record.country = data.countryCode;
          }
        })
        .catch(() => {})
        .finally(() => {
          supabase.from('page_views').insert(record).then();
        });
    }
  }, [location.pathname]);
}
