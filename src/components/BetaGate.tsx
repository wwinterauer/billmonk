import { Navigate, useLocation } from 'react-router-dom';

function hasBetaAccess(): boolean {
  return document.cookie.split(';').some(c => c.trim().startsWith('beta_access=true'));
}

const EXEMPT_ROUTES = ['/beta', '/datenschutz', '/unsubscribe', '/share-receive'];

interface BetaGateProps {
  children: React.ReactNode;
}

export function BetaGate({ children }: BetaGateProps) {
  const location = useLocation();

  if (EXEMPT_ROUTES.some(r => location.pathname.startsWith(r))) {
    return <>{children}</>;
  }

  if (!hasBetaAccess()) {
    return <Navigate to="/beta" replace />;
  }

  return <>{children}</>;
}
