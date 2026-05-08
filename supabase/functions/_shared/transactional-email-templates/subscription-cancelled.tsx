/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'BillMonk'
const SITE_URL = 'https://billmonk.lovable.app'
const LOGO_URL = 'https://nvvssxykygdxjywncvgd.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface SubscriptionCancelledProps {
  name?: string
  plan?: string
  accessUntil?: string
  immediate?: boolean
}

const SubscriptionCancelledEmail = ({ name, plan, accessUntil, immediate }: SubscriptionCancelledProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Deine {SITE_NAME}-Kündigung ist bestätigt</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="BillMonk" height="40" style={logo} />
        <Heading style={h1}>
          {name ? `Schade, dass du gehst, ${name}` : 'Schade, dass du gehst'}
        </Heading>
        <Text style={text}>
          Deine Kündigung des {plan ? <strong>{plan}-Plans</strong> : 'Abos'} bei {SITE_NAME}{' '}
          wurde bestätigt.
        </Text>
        {immediate ? (
          <Text style={text}>
            Dein Abo wurde sofort beendet. Dein Konto bleibt im kostenlosen
            Free-Plan bestehen – deine Daten bleiben erhalten.
          </Text>
        ) : (
          <Text style={text}>
            Du kannst {SITE_NAME} weiterhin im vollen Funktionsumfang nutzen
            {accessUntil ? <> bis <strong>{accessUntil}</strong></> : null}.
            Danach wechselt dein Konto automatisch in den kostenlosen Free-Plan –
            deine Daten bleiben natürlich erhalten.
          </Text>
        )}
        <Text style={text}>
          Hast du es dir anders überlegt? Du kannst dein Abo jederzeit reaktivieren.
        </Text>
        <Button style={button} href={`${SITE_URL}/account`}>
          Abo reaktivieren
        </Button>
        <Text style={footer}>
          Wir würden uns über kurzes Feedback freuen – antworte einfach auf
          diese E-Mail und sag uns, was wir besser machen können.
        </Text>
        <Text style={footer}>Dein {SITE_NAME}-Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionCancelledEmail,
  subject: 'Deine BillMonk-Kündigung ist bestätigt',
  displayName: 'Kündigungs-Bestätigung',
  previewData: { name: 'Max', plan: 'Pro', accessUntil: '30.06.2026', immediate: false },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(222, 47%, 11%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 47%)', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'hsl(175, 84%, 26%)', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(175, 84%, 26%)', color: '#ffffff', fontSize: '14px', borderRadius: '12px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
