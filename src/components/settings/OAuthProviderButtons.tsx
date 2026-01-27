import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Loader2, Check, RefreshCw } from "lucide-react";
import { useEmailImport, EmailAccount } from "@/hooks/useEmailImport";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Unlink } from "lucide-react";

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
}

export function OAuthProviderButtons({ existingAccounts }: OAuthProviderButtonsProps) {
  const { startOAuth, disconnectOAuthAccount, syncEmailAccount } = useEmailImport();
  const [loadingProvider, setLoadingProvider] = useState<'gmail' | 'microsoft' | null>(null);

  const handleOAuthClick = async (provider: 'gmail' | 'microsoft') => {
    setLoadingProvider(provider);
    await startOAuth(provider);
    // Note: Page wird redirected, also kein setLoadingProvider(null) nötig
  };

  // Prüfen ob bereits ein Account für den Provider existiert
  const gmailAccount = existingAccounts.find(a => a.oauth_provider === 'gmail');
  const microsoftAccount = existingAccounts.find(a => a.oauth_provider === 'microsoft');

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
                  onClick={() => syncEmailAccount(gmailAccount.id)}
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
                    <DropdownMenuItem onClick={() => handleOAuthClick('gmail')}>
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
              onClick={() => handleOAuthClick('gmail')}
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

      {/* Microsoft Card */}
      <Card className={microsoftAccount ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-background rounded-lg shadow-sm border">
              <MicrosoftIcon />
            </div>
            <div>
              <CardTitle className="text-lg">Microsoft 365</CardTitle>
              <CardDescription>Outlook / Office 365 verbinden</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {microsoftAccount ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">Verbunden</span>
                </div>
                <Badge variant="secondary">{microsoftAccount.email_address}</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => syncEmailAccount(microsoftAccount.id)}
                  disabled={microsoftAccount.last_sync_status === 'running'}
                >
                  {microsoftAccount.last_sync_status === 'running' ? (
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
                    <DropdownMenuItem onClick={() => handleOAuthClick('microsoft')}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Neu verbinden
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => disconnectOAuthAccount(microsoftAccount.id)}
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
              onClick={() => handleOAuthClick('microsoft')}
              disabled={loadingProvider !== null}
              className="w-full"
              variant="outline"
            >
              {loadingProvider === 'microsoft' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verbinde...
                </>
              ) : (
                <>
                  <MicrosoftIcon className="mr-2" />
                  Mit Microsoft verbinden
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
