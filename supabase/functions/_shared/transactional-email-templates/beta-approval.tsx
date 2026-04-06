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

const SITE_URL = 'https://billmonk.lovable.app'
const LOGO_URL = 'https://nvvssxykygdxjywncvgd.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface Props {
  name?: string
  beta_code?: string
  expires_at?: string
  duration_days?: number
}

const BetaApproval = ({
  name = '',
  beta_code = '',
  expires_at = '',
  duration_days,
}: Props) => {
  const durationText = duration_days
    ? `${duration_days} Tage`
    : expires_at
      ? `bis ${new Date(expires_at).toLocaleDateString('de-AT')}`
      : 'unbegrenzt'

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Dein BillMonk Beta-Zugang ist freigeschaltet!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} alt="BillMonk" height="40" style={logo} />
          <Heading style={h1}>
            {name ? `Hallo ${name}!` : 'Dein Beta-Zugang ist da!'}
          </Heading>
          <Text style={text}>
            Gute Neuigkeiten — deine Beta-Bewerbung wurde freigegeben! Du hast jetzt
            vollen Zugang zu allen BillMonk-Business-Funktionen.
          </Text>

          <div style={codeBox}>
            <Text style={codeLabel}>Dein Beta-Code</Text>
            <Text style={codeValue}>{beta_code}</Text>
          </div>

          <Text style={text}>
            <strong>Zugangszeitraum:</strong> {durationText}
          </Text>
          <Text style={text}>
            Gehe auf die Beta-Seite und gib deinen Code ein, um loszulegen:
          </Text>

          <Button style={button} href={`${SITE_URL}/beta`}>
            Beta-Code eingeben
          </Button>

          <Text style={footer}>
            Du hast Fragen? Antworte einfach auf diese E-Mail oder schreib an{' '}
            <Link href="mailto:hello@billmonk.ai" style={link}>hello@billmonk.ai</Link>.
          </Text>
          <Text style={footer}>
            Dein BillMonk-Team
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BetaApproval,
  subject: 'Dein BillMonk Beta-Zugang ist freigeschaltet!',
  displayName: 'Beta-Freigabe',
  previewData: {
    name: 'Max',
    beta_code: 'BETA-MAX-2026',
    duration_days: 30,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(222, 47%, 11%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 47%)', lineHeight: '1.5', margin: '0 0 20px' }
const link = { color: 'hsl(175, 84%, 26%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(175, 84%, 26%)',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '12px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const codeBox = {
  backgroundColor: '#f4f4f5',
  borderRadius: '12px',
  padding: '16px 20px',
  textAlign: 'center' as const,
  margin: '0 0 20px',
}
const codeLabel = { fontSize: '12px', color: '#999', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const codeValue = { fontSize: '28px', fontWeight: 'bold' as const, color: 'hsl(175, 84%, 26%)', margin: '0', fontFamily: 'monospace', letterSpacing: '0.1em' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
