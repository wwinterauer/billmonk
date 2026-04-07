import { Header } from '@/components/landing/Header';
import { Pricing } from '@/components/landing/Pricing';
import { PricingComparison } from '@/components/landing/PricingComparison';
import { FAQ } from '@/components/landing/FAQ';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';
import { PageMeta } from '@/components/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const pricingStructuredData = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "BillMonk",
  "description": "KI-gestützte Einnahmen-Ausgaben-Verwaltung",
  "brand": { "@type": "Brand", "name": "BillMonk" },
  "offers": [
    {
      "@type": "Offer",
      "name": "Starter",
      "price": "2.99",
      "priceCurrency": "EUR",
      "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" },
      "url": "https://billmonk.lovable.app/pricing"
    },
    {
      "@type": "Offer",
      "name": "Pro",
      "price": "7.99",
      "priceCurrency": "EUR",
      "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" },
      "url": "https://billmonk.lovable.app/pricing"
    },
    {
      "@type": "Offer",
      "name": "Business",
      "price": "15.99",
      "priceCurrency": "EUR",
      "priceSpecification": { "@type": "UnitPriceSpecification", "billingDuration": "P1M" },
      "url": "https://billmonk.lovable.app/pricing"
    }
  ]
};

const PricingPage = () => {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Preise — BillMonk | Ab €2,99/Monat"
        description="Transparente Preise für Einnahmen-Ausgaben-Verwaltung. Starter, Pro & Business — alle Pläne monatlich kündbar. Beta-Nutzer erhalten 50 % Rabatt."
        canonical="/pricing"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingStructuredData) }}
      />
      <Header />
      <main>
        <Pricing />
        <PricingComparison />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default PricingPage;
