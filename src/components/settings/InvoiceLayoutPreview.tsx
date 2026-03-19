import { CompanySettings } from '@/hooks/useCompanySettings';

interface Props {
  layoutVariant: string;
  companySettings: CompanySettings | null;
  invoiceNumber: string;
  footerText: string;
  logoUrl: string | null;
  documentTitle?: string;
}

const SAMPLE_CUSTOMER = {
  name: 'Max Mustermann GmbH',
  street: 'Musterstraße 12',
  zip: '1010',
  city: 'Wien',
  country: 'Österreich',
};

const SAMPLE_ITEMS = [
  { description: 'Webdesign Startseite', qty: 1, unit: 'Stk', price: 1200 },
  { description: 'SEO-Optimierung', qty: 3, unit: 'Std', price: 95 },
  { description: 'Hosting (Jahrespaket)', qty: 1, unit: 'Stk', price: 180 },
];

export function InvoiceLayoutPreview({ layoutVariant, companySettings, invoiceNumber, footerText, logoUrl, documentTitle = 'Rechnung' }: Props) {
  const company = {
    name: companySettings?.company_name || 'Meine Firma GmbH',
    street: companySettings?.street || 'Beispielgasse 1',
    zip: companySettings?.zip || '1010',
    city: companySettings?.city || 'Wien',
    uid: companySettings?.uid_number || 'ATU12345678',
    email: companySettings?.email || 'office@meinefirma.at',
    phone: companySettings?.phone || '+43 1 234 5678',
    iban: companySettings?.iban || 'AT12 3456 7890 1234 5678',
    bic: companySettings?.bic || 'BKAUATWW',
    bank: companySettings?.bank_name || 'Beispielbank AG',
  };

  const subtotal = SAMPLE_ITEMS.reduce((s, i) => s + i.qty * i.price, 0);
  const isSmallBusiness = companySettings?.is_small_business === true;
  const vat = isSmallBusiness ? 0 : subtotal * 0.2;
  const total = subtotal + vat;
  const today = new Date().toLocaleDateString('de-AT');

  const isCompact = layoutVariant === 'compact';
  const isModern = layoutVariant === 'modern';
  const isMinimal = layoutVariant === 'minimal';

  const textSize = isCompact ? 'text-[5px]' : 'text-[6px]';
  const headingSize = isCompact ? 'text-[7px]' : 'text-[8px]';
  const titleSize = isCompact ? 'text-[9px]' : 'text-[10px]';
  const gap = isCompact ? 'gap-1' : 'gap-2';
  const py = isCompact ? 'py-[1px]' : 'py-[2px]';

  return (
    <div className="flex justify-center">
      <div
        className="bg-white border border-border rounded shadow-lg overflow-hidden"
        style={{ width: 280, height: 396, padding: isCompact ? 14 : 18, position: 'relative' }}
      >
        {/* Header */}
        {isModern && (
          <div className="mb-2 text-center">
            {logoUrl && <img src={logoUrl} alt="Logo" className="mx-auto mb-1" style={{ maxHeight: 22 }} />}
            <div className={`${headingSize} font-bold text-gray-900`}>{company.name}</div>
            <div className="h-[2px] bg-blue-500 mt-1 mb-2 rounded-full" />
          </div>
        )}

        {!isModern && !isMinimal && (
          <div className="flex justify-between items-start mb-2">
            <div>
              {logoUrl && <img src={logoUrl} alt="Logo" className="mb-1" style={{ maxHeight: 20 }} />}
              <div className={`${headingSize} font-bold text-gray-900`}>{company.name}</div>
              <div className={`${textSize} text-gray-500`}>{company.street}, {company.zip} {company.city}</div>
            </div>
            <div className={`${textSize} text-gray-500 text-right`}>
              <div>UID: {company.uid}</div>
              <div>{company.email}</div>
              <div>{company.phone}</div>
            </div>
          </div>
        )}

        {isMinimal && (
          <div className="mb-2">
            <div className={`${headingSize} font-bold text-gray-900`}>{company.name}</div>
            <div className={`${textSize} text-gray-500`}>{company.street}, {company.zip} {company.city} · {company.uid}</div>
          </div>
        )}

        {/* Recipient */}
        <div className={`mb-2 ${textSize} text-gray-800`}>
          <div className={`${textSize} text-gray-400 mb-[1px]`} style={{ fontSize: 4 }}>
            {company.name} · {company.street} · {company.zip} {company.city}
          </div>
          <div className="font-semibold">{SAMPLE_CUSTOMER.name}</div>
          <div>{SAMPLE_CUSTOMER.street}</div>
          <div>{SAMPLE_CUSTOMER.zip} {SAMPLE_CUSTOMER.city}</div>
        </div>

        {/* Title + Meta */}
        <div className={`flex justify-between items-end mb-1 ${gap}`}>
          <div className={`${titleSize} font-bold text-gray-900`}>{documentTitle}</div>
          <div className={`${textSize} text-gray-600 text-right`}>
            <div>Nr: <span className="font-mono">{invoiceNumber}</span></div>
            <div>Datum: {today}</div>
          </div>
        </div>

        {isModern && <div className="h-[1px] bg-blue-500/30 mb-1" />}

        {/* Table */}
        <table className="w-full mb-2" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className={`${textSize} font-semibold text-gray-600 border-b border-gray-300`}>
              <td className={`${py} text-left`}>Beschreibung</td>
              <td className={`${py} text-right`}>Menge</td>
              <td className={`${py} text-right`}>Einheit</td>
              <td className={`${py} text-right`}>Preis</td>
              <td className={`${py} text-right`}>Gesamt</td>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((item, i) => (
              <tr key={i} className={`${textSize} text-gray-800 border-b border-gray-100`}>
                <td className={py}>{item.description}</td>
                <td className={`${py} text-right`}>{item.qty}</td>
                <td className={`${py} text-right`}>{item.unit}</td>
                <td className={`${py} text-right`}>{item.price.toFixed(2)} €</td>
                <td className={`${py} text-right`}>{(item.qty * item.price).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className={`flex flex-col items-end ${textSize} text-gray-800 mb-2`}>
          <div className="flex justify-between w-24">
            <span>Netto:</span><span>{subtotal.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between w-24">
            <span>20% USt:</span><span>{vat.toFixed(2)} €</span>
          </div>
          <div className={`flex justify-between w-24 font-bold border-t border-gray-300 mt-[1px] pt-[1px] ${headingSize}`}>
            <span>Gesamt:</span><span>{total.toFixed(2)} €</span>
          </div>
        </div>

        {/* Bank Info */}
        <div className={`${textSize} text-gray-500 mb-1`}>
          <span className="font-medium">Bankverbindung:</span> {company.bank} · IBAN: {company.iban} · BIC: {company.bic}
        </div>

        {/* Footer */}
        {footerText && (
          <div className={`${textSize} text-gray-400 mt-auto`} style={{ position: 'absolute', bottom: isCompact ? 10 : 14, left: isCompact ? 14 : 18, right: isCompact ? 14 : 18 }}>
            {footerText}
          </div>
        )}
      </div>
    </div>
  );
}
