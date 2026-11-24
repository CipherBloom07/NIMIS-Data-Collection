import { useState } from 'react';

/** Use the bundled official emblem, with a local SVG fallback for stale PWA caches.
 * Both images are shipped with NIMIS Collect; no external image host is required.
 */
export default function BrandLogo({ className = '', compact = false }: {
  className?: string;
  compact?: boolean;
}) {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const prefix = import.meta.env.BASE_URL;
  const source = prefix + (fallback ? 'zimbabwe-coat-of-arms.svg' : 'zimbabwe-coat-of-arms.jpg');

  if (failed) return <span className={'brand-logo-text ' + className} aria-label="NIMIS official identity">
    NIMIS
  </span>;
  return <img
    className={className}
    src={source}
    width={compact ? 35 : 66}
    height={compact ? 35 : 66}
    alt="Zimbabwe national coat of arms"
    loading="eager"
    decoding="async"
    onError={() => {
      if (!fallback) setFallback(true);
      else setFailed(true);
    }}
  />;
}
