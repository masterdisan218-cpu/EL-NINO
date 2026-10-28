import React, { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useUpdates } from '../context/UpdatesContext';

export const PublishedContent: React.FC = () => {
  const { pathname } = useLocation();
  const { language, isTelugu } = useLanguage();
  const { publishedContent } = useUpdates();
  const pageEntries = publishedContent.filter(
    (entry) => (entry.kind === 'page' || entry.kind === 'content') && entry.pagePath === pathname,
  );
  const contentEntries = pageEntries.filter((entry) => entry.kind === 'content' && entry.category !== 'regional-guidance');
  const seoEntry = [...pageEntries].reverse().find(
    (entry) => entry.seoTitleEn || entry.seoTitleTe || entry.seoDescriptionEn || entry.seoDescriptionTe,
  );

  useEffect(() => {
    if (!seoEntry) return;
    const title = isTelugu ? seoEntry.seoTitleTe || seoEntry.seoTitleEn : language === 'es' ? seoEntry.seoTitleEs || seoEntry.seoTitleEn : seoEntry.seoTitleEn || seoEntry.seoTitleTe;
    const description = isTelugu ? seoEntry.seoDescriptionTe || seoEntry.seoDescriptionEn : language === 'es' ? seoEntry.seoDescriptionEs || seoEntry.seoDescriptionEn : seoEntry.seoDescriptionEn || seoEntry.seoDescriptionTe;
    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
    if (seoEntry.imageUrl) {
      let metaImage = document.querySelector('meta[property="og:image"]');
      if (!metaImage) {
        metaImage = document.createElement('meta');
        metaImage.setAttribute('property', 'og:image');
        document.head.appendChild(metaImage);
      }
      metaImage.setAttribute('content', new URL(seoEntry.imageUrl, window.location.origin).href);
    }
  }, [isTelugu, language, seoEntry]);

  if (!contentEntries.length) return null;

  return (
    <section aria-label={isTelugu ? 'ప్రచురించిన సమాచారం' : 'Published information'} className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6">
        {contentEntries.map((entry) => {
          const title = isTelugu ? entry.titleTe || entry.titleEn : language === 'es' ? entry.titleEs || entry.titleEn : entry.titleEn || entry.titleTe;
          const description = isTelugu ? entry.descriptionTe || entry.descriptionEn : language === 'es' ? entry.descriptionEs || entry.descriptionEn : entry.descriptionEn || entry.descriptionTe;
          return (
            <article key={entry.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {entry.imageUrl && <img src={entry.imageUrl} alt={title} loading="lazy" className="max-h-80 w-full object-cover" />}
              <div className="p-5 sm:p-7">
                {entry.category && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ocean-700">{entry.category}</p>}
                {title && <h2 className="text-xl font-bold text-slate-900">{title}</h2>}
                {description && <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700">{description}</p>}
                {entry.linkUrl && <a href={entry.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ocean-700 hover:underline">{isTelugu ? 'లింక్‌ను తెరవండి' : 'Open link'}<ExternalLink className="h-4 w-4" /></a>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
