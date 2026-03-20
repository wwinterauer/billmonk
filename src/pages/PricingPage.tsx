import { Header } from '@/components/landing/Header';
import { Pricing } from '@/components/landing/Pricing';
import { PricingComparison } from '@/components/landing/PricingComparison';
import { FAQ } from '@/components/landing/FAQ';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const PricingPage = () => {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
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
