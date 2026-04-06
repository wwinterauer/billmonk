/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeEmail } from './welcome-email.tsx'
import { template as trialExpiry } from './trial-expiry.tsx'
import { template as subscriptionConfirmed } from './subscription-confirmed.tsx'
import { template as betaApplicationNotification } from './beta-application-notification.tsx'
import { template as betaApproval } from './beta-approval.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-email': welcomeEmail,
  'trial-expiry': trialExpiry,
  'subscription-confirmed': subscriptionConfirmed,
  'beta-application-notification': betaApplicationNotification,
  'beta-approval': betaApproval,
}
