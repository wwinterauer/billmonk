import { Helmet } from 'react-helmet-async';

interface PageMetaProps {
  title: string;
  description: string;
  /** Pfad-only, z.B. "/pricing". Wenn leer = Startseite. */
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  noindex?: boolean;
  /** JSON-LD strukturierte Daten (einzeln oder Array) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE_URL = 'https://billmonk.ai';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.jpg`;

export function PageMeta({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage,
  noindex = false,
  jsonLd,
}: PageMetaProps) {
  const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : BASE_URL;
  const imageUrl = ogImage
    ? ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`
    : DEFAULT_OG_IMAGE;

  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />

      {/* Twitter */}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
