export const NO_RECEIPT_CATEGORY = 'Keine Rechnung';

export const TAX_TYPES = [
  { value: 'Betriebsausgabe', label: 'Betriebsausgabe' },
  { value: 'GWG bis 1.000€', label: 'GWG bis 1.000€' },
  { value: 'Bewirtung 50%', label: 'Bewirtung 50% abzugsfähig' },
  { value: 'Bewirtung 100%', label: 'Bewirtung 100% abzugsfähig' },
  { value: 'Vorsteuer abzugsfähig', label: 'Vorsteuer abzugsfähig' },
  { value: 'Reisekosten', label: 'Reisekosten' },
  { value: 'Kfz-Kosten', label: 'Kfz-Kosten' },
  { value: 'Repräsentation', label: 'Repräsentation nicht abzugsfähig' },
  { value: 'Abschreibung', label: 'Abschreibung' },
  { value: 'Sonstige', label: 'Sonstige' },
];

export const PAYMENT_METHODS = [
  { value: 'Überweisung', label: 'Überweisung' },
  { value: 'Kreditkarte', label: 'Kreditkarte' },
  { value: 'Debitkarte', label: 'Karte Debitzahlung' },
  { value: 'Bar', label: 'Barzahlung' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Apple Pay', label: 'Apple Pay' },
  { value: 'Google Pay', label: 'Google Pay' },
  { value: 'Lastschrift', label: 'Lastschrift' },
  { value: 'Sonstige', label: 'Sonstige' },
];

export const TAX_TYPE_COLORS: Record<string, string> = {
  'Betriebsausgabe': '#3B82F6',
  'GWG bis 1.000€': '#10B981',
  'Bewirtung 50%': '#F59E0B',
  'Bewirtung 100%': '#EAB308',
  'Vorsteuer abzugsfähig': '#6366F1',
  'Reisekosten': '#EC4899',
  'Kfz-Kosten': '#14B8A6',
  'Repräsentation': '#EF4444',
  'Abschreibung': '#8B5CF6',
  'Sonstige': '#94A3B8',
  'Offen': '#D1D5DB',
};
