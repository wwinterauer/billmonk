import { Link } from 'react-router-dom';
import { Mail, MapPin, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import logoTeal from '@/assets/logo-teal.png';

export function Footer() {
  return (
    <footer className="py-12 bg-background border-t border-border">
      <div className="container">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logoTeal} alt="BillMonk" className="h-7" />
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                Beta
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              KI-gestützte Einnahmen-Ausgaben-Verwaltung für Kleinunternehmer, Freelancer und Vermieter. Made in Austria.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Produkt</h3>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/register" className="text-muted-foreground hover:text-foreground transition-colors">
                Kostenlos starten
              </Link>
              <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                Login
              </Link>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                Features
              </button>
            </nav>
          </div>

          {/* Impressum */}
          <div id="impressum">
            <h3 className="font-semibold text-foreground mb-4">Impressum</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Wilfried Winterauer</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Gschwandt 48, 4822 Bad Goisern</span>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <a 
                  href="mailto:w.winterauer@gmail.com" 
                  className="hover:text-foreground transition-colors"
                >
                  w.winterauer@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2026 BillMonk. Alle Rechte vorbehalten.</p>
          <div className="flex items-center gap-4">
            <Link to="/datenschutz" className="hover:text-foreground transition-colors">
              Datenschutz
            </Link>
            <span>•</span>
            <span>Made with ❤️ in Austria 🇦🇹</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
