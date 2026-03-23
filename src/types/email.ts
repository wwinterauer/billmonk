// OAuth Types for Email Import

export type OAuthProvider = 'gmail' | 'microsoft';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface OAuthState {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  state_token: string;
  redirect_after: string | null;
  created_at: string;
  expires_at: string;
}

// Gmail API Scopes
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Microsoft Graph API Scopes
export const MICROSOFT_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
];

// OAuth Configuration
export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

// Gmail specific IMAP settings (for XOAUTH2)
export const GMAIL_IMAP_CONFIG = {
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
};

// Microsoft specific IMAP settings (for XOAUTH2)
export const MICROSOFT_IMAP_CONFIG = {
  host: 'outlook.office365.com',
  port: 993,
  secure: true,
};

// Check if an OAuth token is expired or expiring soon
export function isTokenExpired(expiresAt: string | null, bufferMinutes = 5): boolean {
  if (!expiresAt) return true;
  
  const expiryTime = new Date(expiresAt).getTime();
  const bufferMs = bufferMinutes * 60 * 1000;
  
  return Date.now() >= expiryTime - bufferMs;
}

// Calculate token expiry timestamp from expires_in seconds
export function calculateTokenExpiry(expiresIn: number): string {
  const expiryTime = Date.now() + expiresIn * 1000;
  return new Date(expiryTime).toISOString();
}
