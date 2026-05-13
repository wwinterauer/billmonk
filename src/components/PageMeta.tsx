import { useEffect } from 'react';

interface PageMetaProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  noindex?: boolean;
}

const BASE_URL = 'https://billmonk.ai';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.jpg`;

export function PageMeta({ title, description, canonical, ogType = 'website', ogImage, noindex = false }: PageMetaProps) {
  useEffect(() => {
    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:url', canonical ? `${BASE_URL}${canonical}` : BASE_URL);
    setMeta('property', 'og:image', ogImage ? (ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`) : DEFAULT_OG_IMAGE);

    // Twitter
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', ogImage ? (ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`) : DEFAULT_OG_IMAGE);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical ? `${BASE_URL}${canonical}` : BASE_URL);

    return () => {
      // Reset to defaults on unmount
      document.title = 'BillMonk — Einnahmen & Ausgaben im Griff';
    };
  }, [title, description, canonical, ogType, ogImage, noindex]);

  return null;
}
