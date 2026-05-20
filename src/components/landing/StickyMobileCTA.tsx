import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Slide-up CTA on mobile after 30% scroll. Dismiss persists for session. */
export function StickyMobileCTA() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('billmonk-mobile-cta-dismissed')) {
      setDismissed(true);
      return;
    }
    const onScroll = () => {
      const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setShow(pct > 0.3);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('billmonk-mobile-cta-dismissed', '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {show && !dismissed && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 220 }}
          className="fixed inset-x-0 bottom-0 z-40 md:hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-card/95 backdrop-blur border-t border-border shadow-2xl"
        >
          <div className="flex items-center gap-2">
            <Link to="/register" className="flex-1">
              <Button size="lg" className="w-full gradient-primary shadow-primary h-12 text-base">
                Jetzt kostenlos testen
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <button
              onClick={dismiss}
              aria-label="Schließen"
              className="h-12 w-12 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
