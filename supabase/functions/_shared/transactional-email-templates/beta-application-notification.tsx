/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const LOGO_URL = 'https://nvvssxykygdxjywncvgd.supabase.co/storage/v1/object/public/email-assets/logo.png'

interface Props {
  first_name?: string
  last_name?: string
  email?: string
  organization_type?: string
  organization_name?: string
  intended_plan?: string
  city?: string
  country?: string
}

const BetaApplicationNotification = ({
  first_name = '',
  last_name = '',
  email = '',
  organization_type = 'privat',
  organization_name = '',
  intended_plan = 'starter',
  city = '',
  country = 'AT',
}: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Neue Beta-Bewerbung von {first_name} {last_name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="BillMonk" height="40" style={logo} />
        <Heading style={h1}>Neue Beta-Bewerbung</Heading>
        <Text style={text}>
          Eine neue Beta-Bewerbung ist eingegangen:
        </Text>
        <table style={table}>
          <tbody>
            <tr><td style={labelCell}>Name</td><td style={valueCell}>{first_name} {last_name}</td></tr>
            <tr><td style={labelCell}>E-Mail</td><td style={valueCell}>{email}</td></tr>
            <tr><td style={labelCell}>Typ</td><td style={valueCell}>{organization_type}{organization_name ? ` — ${organization_name}` : ''}</td></tr>
            <tr><td style={labelCell}>Gewünschter Plan</td><td style={valueCell}>{intended_plan}</td></tr>
            <tr><td style={labelCell}>Ort</td><td style={valueCell}>{city}, {country}</td></tr>
          </tbody>
        </table>
        <Text style={footer}>
          Freigabe im Admin-Dashboard unter Beta-Verwaltung.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BetaApplicationNotification,
  subject: (data: Record<string, any>) => `Neue Beta-Bewerbung: ${data.first_name || ''} ${data.last_name || ''}`,
  to: 'w.winterauer@billmonk.ai',
  displayName: 'Beta-Bewerbung (Admin-Benachrichtigung)',
  previewData: {
    first_name: 'Max',
    last_name: 'Mustermann',
    email: 'max@example.com',
    organization_type: 'firma',
    organization_name: 'Muster GmbH',
    intended_plan: 'pro',
    city: 'Wien',
    country: 'AT',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(222, 47%, 11%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 47%)', lineHeight: '1.5', margin: '0 0 20px' }
const table = { width: '100%', borderCollapse: 'collapse' as const, margin: '0 0 24px' }
const labelCell = { fontSize: '13px', color: '#999', padding: '6px 12px 6px 0', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' as const }
const valueCell = { fontSize: '14px', color: 'hsl(222, 47%, 11%)', padding: '6px 0', borderBottom: '1px solid #eee', fontWeight: 500 as const }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 0 0' }
