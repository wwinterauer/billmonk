/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'BillMonk'
const SITE_URL = 'https://billmonk.lovable.app'
const LOGO_URL = 'https://nvvssxykygdxjywncvgd.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface SubscriptionConfirmedProps {
  name?: string
  plan?: string
}

const SubscriptionConfirmedEmail = ({ name, plan }: SubscriptionConfirmedProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Dein {SITE_NAME}-Abo ist jetzt aktiv!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="BillMonk" height="40" style={logo} />
        <Heading style={h1}>
          {name ? `Danke, ${name}!` : 'Vielen Dank!'} 🎉
        </Heading>
        <Text style={text}>
          Dein <strong>{plan ? `${plan}-` : ''}Abo</strong> bei {SITE_NAME} ist
          jetzt aktiv. Du hast ab sofort vollen Zugriff auf alle Funktionen
          deines Plans.
        </Text>
        <Text style={text}>
          Deine Rechnung findest du jederzeit in deinen Kontoeinstellungen.
          Bei Fragen zu deinem Abo stehen wir dir gerne zur Verfügung.
        </Text>
        <Button style={button} href={`${SITE_URL}/dashboard`}>
          Zum Dashboard
        </Button>
        <Text style={footer}>
          Du hast Fragen? Antworte einfach auf diese E-Mail oder besuche{' '}
          <Link href={SITE_URL} style={link}>
            billmonk.ai
          </Link>
          .
        </Text>
        <Text style={footer}>
          Dein {SITE_NAME}-Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionConfirmedEmail,
  subject: 'Dein BillMonk-Abo ist aktiv!',
  displayName: 'Abo-Bestätigung',
  previewData: { name: 'Max', plan: 'Pro' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(222, 47%, 11%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(215, 16%, 47%)',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: 'hsl(175, 84%, 26%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(175, 84%, 26%)',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '12px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
