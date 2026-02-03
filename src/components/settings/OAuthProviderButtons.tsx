import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Loader2, Check, RefreshCw, ExternalLink, MoreHorizontal, Unlink } from "lucide-react";
import { useEmailImport, EmailAccount } from "@/hooks/useEmailImport";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Google Icon SVG
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Microsoft Icon SVG
const MicrosoftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="20" height="20">
    <path fill="#F25022" d="M1 1h10v10H1z"/>
    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
    <path fill="#FFB900" d="M13 13h10v10H13z"/>
  </svg>
);

interface OAuthProviderButtonsProps {
  existingAccounts: EmailAccount[];
  onSwitchToImap?: () => void;
}

export function OAuthProviderButtons({ existingAccounts, onSwitchToImap }: OAuthProviderButtonsProps) {
  const { startOAuth, disconnectOAuthAccount, syncEmailAccount } = useEmailImport();
  const [loadingProvider, setLoadingProvider] = useState<'gmail' | null>(null);

  const handleOAuthClick = async () => {
    setLoadingProvider('gmail');
    await startOAuth('gmail');
    // Note: Page wird redirected, also kein setLoadingProvider(null) nötig
  };

  // Prüfen ob bereits ein Gmail Account existiert
  const gmailAccount = existingAccounts.find(a => a.oauth_provider === 'gmail');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Gmail Card */}
      <Card className={gmailAccount ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-background rounded-lg shadow-sm border">
              <GoogleIcon />
            </div>
            <div>
              <CardTitle className="text-lg">Gmail</CardTitle>
              <CardDescription>Google Mail verbinden</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {gmailAccount ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">Verbunden</span>
                </div>
                <Badge variant="secondary">{gmailAccount.email_address}</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => syncEmailAccount({ accountId: gmailAccount.id })}
                  disabled={gmailAccount.last_sync_status === 'running'}
                >
                  {gmailAccount.last_sync_status === 'running' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleOAuthClick}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Neu verbinden
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => disconnectOAuthAccount(gmailAccount.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Trennen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleOAuthClick}
              disabled={loadingProvider !== null}
              className="w-full"
              variant="outline"
            >
              {loadingProvider === 'gmail' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verbinde...
                </>
              ) : (
                <>
                  <GoogleIcon className="mr-2" />
                  Mit Gmail verbinden
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Outlook Card - IMAP Hinweis */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-background rounded-lg shadow-sm border">
              <MicrosoftIcon />
            </div>
            <div>
              <CardTitle className="text-lg">Outlook / Hotmail</CardTitle>
              <CardDescription>Microsoft E-Mail-Konten</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verwende IMAP für Outlook/Hotmail-Konten:
            </p>
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md space-y-1">
              <p><span className="font-medium">Server:</span> outlook.office365.com</p>
              <p><span className="font-medium">Port:</span> 993 (SSL)</p>
              <p><span className="font-medium">Passwort:</span> App-Kennwort erstellen</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={onSwitchToImap}
              >
                <Mail className="h-4 w-4 mr-2" />
                IMAP einrichten
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
              >
                <a 
                  href="https://account.microsoft.com/security" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  title="App-Kennwort erstellen"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* iCloud Card - IMAP Hinweis */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-background rounded-lg shadow-sm border">
              <AppleIcon />
            </div>
            <div>
              <CardTitle className="text-lg">iCloud Mail</CardTitle>
              <CardDescription>Apple E-Mail-Konten</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verwende IMAP für iCloud-Konten:
            </p>
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md space-y-1">
              <p><span className="font-medium">Server:</span> imap.mail.me.com</p>
              <p><span className="font-medium">Port:</span> 993 (SSL)</p>
              <p><span className="font-medium">Passwort:</span> App-spezifisches Passwort</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={onSwitchToImap}
              >
                <Mail className="h-4 w-4 mr-2" />
                IMAP einrichten
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
              >
                <a 
                  href="https://appleid.apple.com/account/manage" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  title="App-spezifisches Passwort erstellen"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Apple Icon SVG
const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);
