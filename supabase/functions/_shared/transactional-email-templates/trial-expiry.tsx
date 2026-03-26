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
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'BillMonk'
const SITE_URL = 'https://billmonk.lovable.app'
const LOGO_URL = 'https://nvvssxykygdxjywncvgd.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface TrialExpiryProps {
  name?: string
  plan?: string
  daysLeft?: number
}

const TrialExpiryEmail = ({ name, plan, daysLeft = 3 }: TrialExpiryProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Deine {SITE_NAME}-Testphase endet in {daysLeft} Tagen</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="BillMonk" height="40" style={logo} />
        <Heading style={h1}>
          {name ? `Hey ${name},` : 'Hey,'} deine Testphase endet bald!
        </Heading>
        <Text style={text}>
          In <strong>{daysLeft} Tagen</strong> läuft dein
          {plan ? ` ${plan}-` : ' '}Testzeitraum bei {SITE_NAME} aus.
          Damit du weiterhin alle Funktionen nutzen kannst, sichere dir
          jetzt dein Abo.
        </Text>
        <Text style={text}>
          <strong>Das würdest du verlieren:</strong>
        </Text>
        <Section style={featureList}>
          <Text style={featureItem}>✦ KI-gestützte Belegerkennung</Text>
          <Text style={featureItem}>✦ Automatische Kategorisierung</Text>
          <Text style={featureItem}>✦ Rechnungserstellung & Versand</Text>
          <Text style={featureItem}>✦ Bank-Import & Abgleich</Text>
          <Text style={featureItem}>✦ Cloud-Backup & Export</Text>
        </Section>
        <Button style={button} href={`${SITE_URL}/pricing`}>
          Jetzt upgraden
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
  component: TrialExpiryEmail,
  subject: 'Deine BillMonk-Testphase endet bald',
  displayName: 'Testphase-Erinnerung',
  previewData: { name: 'Max', plan: 'Pro', daysLeft: 3 },
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
const featureList = { margin: '0 0 25px', padding: '0' }
const featureItem = {
  fontSize: '14px',
  color: 'hsl(222, 47%, 11%)',
  lineHeight: '1.8',
  margin: '0',
  padding: '0',
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
