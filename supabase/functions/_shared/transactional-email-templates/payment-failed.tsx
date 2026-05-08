/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'BillMonk'
const SITE_URL = 'https://billmonk.lovable.app'
const LOGO_URL = 'https://nvvssxykygdxjywncvgd.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface PaymentFailedProps {
  name?: string
  amount?: string
  currency?: string
  nextRetryDate?: string
}

const PaymentFailedEmail = ({ name, amount, currency, nextRetryDate }: PaymentFailedProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Zahlung fehlgeschlagen – bitte Zahlungsmethode prüfen</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="BillMonk" height="40" style={logo} />
        <Heading style={h1}>
          {name ? `Hi ${name}, ` : ''}deine Zahlung ist fehlgeschlagen
        </Heading>
        <Text style={text}>
          Wir konnten {amount && currency ? <>den Betrag von <strong>{amount} {currency}</strong></> : 'deine letzte Zahlung'} für dein {SITE_NAME}-Abo
          leider nicht abbuchen.
        </Text>
        <Text style={text}>
          Bitte prüfe deine hinterlegte Zahlungsmethode (Kreditkarte abgelaufen,
          Limit überschritten, SEPA-Mandat ungültig).
          {nextRetryDate ? (
            <> Wir versuchen es automatisch erneut am <strong>{nextRetryDate}</strong>.</>
          ) : (
            <> Wir versuchen es in den nächsten Tagen automatisch erneut.</>
          )}
        </Text>
        <Button style={button} href={`${SITE_URL}/account`}>
          Zahlungsmethode aktualisieren
        </Button>
        <Text style={text}>
          Solange die Zahlung offen ist, bleibt dein Konto aktiv. Wenn auch die
          weiteren Versuche scheitern, wird dein Abo pausiert.
        </Text>
        <Text style={footer}>
          Bei Fragen antworte einfach auf diese E-Mail oder besuche{' '}
          <Link href={SITE_URL} style={link}>billmonk.ai</Link>.
        </Text>
        <Text style={footer}>Dein {SITE_NAME}-Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentFailedEmail,
  subject: 'Zahlung fehlgeschlagen – bitte Zahlungsmethode prüfen',
  displayName: 'Zahlung fehlgeschlagen',
  previewData: { name: 'Max', amount: '19,00', currency: 'EUR', nextRetryDate: '15.05.2026' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(222, 47%, 11%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 47%)', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'hsl(175, 84%, 26%)', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(175, 84%, 26%)', color: '#ffffff', fontSize: '14px', borderRadius: '12px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
