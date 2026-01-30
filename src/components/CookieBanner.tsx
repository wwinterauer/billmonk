import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Cookie, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const COOKIE_CONSENT_KEY = 'xpenzai_cookie_consent';

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const hasConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!hasConsent) {
      // Small delay to not show immediately on page load
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setIsVisible(false);
  };

  const handleDismiss = () => {
    // Just dismiss without saving - will show again on next visit
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
        >
          <div className="max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-xl shadow-xl p-4 md:p-6">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Cookie className="h-5 w-5 text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                        <Cookie className="h-4 w-4 sm:hidden text-primary" />
                        Cookie-Hinweis
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Diese Website verwendet nur{' '}
                        <span className="font-medium text-foreground">technisch notwendige Cookies</span>{' '}
                        für Login und Authentifizierung. Wir verwenden{' '}
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                          <Shield className="h-3 w-3" />
                          keine Tracking- oder Werbe-Cookies
                        </span>.
                      </p>
                    </div>
                    
                    {/* Close button (mobile) */}
                    <button
                      onClick={handleDismiss}
                      className="sm:hidden shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Schließen"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <Button onClick={handleAccept} size="sm" className="gap-2">
                      Verstanden
                    </Button>
                    <Link
                      to="/datenschutz"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                    >
                      Mehr erfahren
                    </Link>
                  </div>
                </div>

                {/* Close button (desktop) */}
                <button
                  onClick={handleDismiss}
                  className="hidden sm:block shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Schließen"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
