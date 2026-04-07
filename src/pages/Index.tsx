import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PrivateCustomers } from '@/components/landing/PrivateCustomers';
import { BusinessCustomers } from '@/components/landing/BusinessCustomers';
import { Features } from '@/components/landing/Features';
import { BusinessWorkflow } from '@/components/landing/BusinessWorkflow';
import { Testimonials } from '@/components/landing/Testimonials';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';
import { PageMeta } from '@/components/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "BillMonk",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "description": "KI-gestützte Einnahmen-Ausgaben-Verwaltung für Kleinunternehmer, Freelancer und Vermieter. Belege erfassen, Rechnungen erstellen, Bankabgleich.",
      "url": "https://billmonk.lovable.app",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "EUR",
        "lowPrice": "2.99",
        "highPrice": "15.99",
        "offerCount": 3
      },
      "author": {
        "@type": "Organization",
        "name": "BillMonk",
        "url": "https://billmonk.lovable.app",
        "email": "w.winterauer@billmonk.ai",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Bad Goisern",
          "addressCountry": "AT"
        }
      }
    },
    {
      "@type": "Organization",
      "name": "BillMonk",
      "url": "https://billmonk.lovable.app",
      "logo": "https://billmonk.lovable.app/icons/icon-512x512.png",
      "sameAs": [],
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "w.winterauer@billmonk.ai",
        "contactType": "customer support"
      }
    }
  ]
};

const Index = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const scrollTo = params.get('scrollTo');
    if (scrollTo) {
      setTimeout(() => {
        document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, [location.search]);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="BillMonk — KI-gestützte Einnahmen & Ausgaben Verwaltung"
        description="Belege erfassen, Rechnungen erstellen, Bankabgleich — alles KI-gestützt und vorbereitet für den Steuerberater. Made in Austria. Ab €2,99/Monat."
        canonical="/"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Header />
      <main>
        <Hero />
        <ProblemSolution />
        <HowItWorks />
        <PrivateCustomers />
        <BusinessCustomers />
        <Features />
        <BusinessWorkflow />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
