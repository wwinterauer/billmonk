

## Problem

Die Header-Buttons "Features" und "So funktioniert's" nutzen `scrollToSection()`, das per `document.getElementById()` nach dem Element sucht. Auf der `/pricing`-Seite existieren diese Sektionen (`#features`, `#how-it-works`) aber nicht — sie sind nur auf der Index-Seite (`/`). Daher passiert beim Klick nichts.

## Loesung

Die `scrollToSection`-Funktion muss pruefen, ob man sich auf der Startseite befindet. Falls nicht, wird zuerst per `navigate('/')` zur Startseite navigiert und dann zum Anker gescrollt.

### Aenderung: `src/components/landing/Header.tsx`

- `useLocation()` und `useNavigate()` aus `react-router-dom` importieren
- `scrollToSection` anpassen:
  - Wenn `location.pathname !== '/'`: navigiere zu `/#sectionId` (z.B. `/#features`)
  - Wenn auf `/`: wie bisher per `getElementById` + `scrollIntoView`
- Fuer die Navigation mit Hash: nach `navigate('/')` ein kurzes Timeout oder `useEffect` nutzen, das beim Laden der Startseite den Hash ausliest und zum Element scrollt

Alternativ einfacher: `navigate('/#features')` verwenden und in der Index-Seite einen `useEffect` einbauen, der bei vorhandenem `location.hash` zur Sektion scrollt.

### Konkret

**Header.tsx** — `scrollToSection` erweitern:
```ts
const navigate = useNavigate();
const location = useLocation();

const scrollToSection = (id: string) => {
  if (location.pathname !== '/') {
    navigate(`/?scrollTo=${id}`);
  } else {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
  setMobileMenuOpen(false);
};
```

**Index.tsx** — Hash-Scroll beim Laden:
```ts
const location = useLocation();
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const scrollTo = params.get('scrollTo');
  if (scrollTo) {
    setTimeout(() => {
      document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }
}, [location]);
```

### Dateien
- `src/components/landing/Header.tsx` — Navigation-Logik erweitern
- `src/pages/Index.tsx` — ScrollTo-Parameter auswerten

