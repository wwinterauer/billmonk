import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-12 bg-background border-t border-border">
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">XpenzAi</span>
            <span className="text-sm text-muted-foreground ml-2">© 2025 XpenzAi</span>
          </div>

          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/impressum" className="text-muted-foreground hover:text-foreground transition-colors">
              Impressum
            </Link>
            <Link to="/datenschutz" className="text-muted-foreground hover:text-foreground transition-colors">
              Datenschutz
            </Link>
            <Link to="/agb" className="text-muted-foreground hover:text-foreground transition-colors">
              AGB
            </Link>
          </nav>

          <div className="text-sm text-muted-foreground">
            Made with ❤️ in Austria 🇦🇹
          </div>
        </div>
      </div>
    </footer>
  );
}
