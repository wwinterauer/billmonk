import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  path: string; // z.B. "/pricing"
  noIndex?: boolean;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE = "https://billmonk.ai";
const DEFAULT_OG = `${SITE}/og-image.jpg`;

/**
 * Per-Route SEO Tags. Überschreibt die statischen Tags aus index.html
 * für Crawler, die JS ausführen (Googlebot). Social-Crawler nutzen weiter
 * die statischen Defaults — das ist erwünscht.
 */
export function SEO({ title, description, path, noIndex, ogImage, jsonLd }: SEOProps) {
  const url = `${SITE}${path}`;
  const image = ogImage || DEFAULT_OG;
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />

      {/* Twitter */}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
