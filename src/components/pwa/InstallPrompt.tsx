import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Show prompt when conditions are met
  useEffect(() => {
    if (isStandalone) return;
    if (!isMobile) return;
    if (!user) return;
    if (localStorage.getItem('pwa-install-dismissed')) return;
    if (location.pathname === '/') return;

    // Show on iOS even without installPrompt event
    if (isIOS() || installPrompt) {
      setShowPrompt(true);
    }
  }, [isMobile, user, isStandalone, installPrompt, location.pathname]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt) return null;

  const showIOSInstructions = isIOS() && !installPrompt;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <Card className="border-primary/20 bg-card shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>

            <div className="flex-1 space-y-2">
              <p className="font-medium text-foreground">
                BillMonk als App installieren
              </p>
              <p className="text-sm text-muted-foreground">
                Für schnelleren Zugriff und Beleg-Import per Teilen-Funktion
              </p>

              {showIOSInstructions ? (
                <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                  <Share className="h-4 w-4 shrink-0" />
                  <span>Tippe auf das Teilen-Symbol und dann „Zum Home-Bildschirm"</span>
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleInstall}>
                    <Download className="mr-1 h-4 w-4" />
                    Installieren
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss}>
                    Später
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
