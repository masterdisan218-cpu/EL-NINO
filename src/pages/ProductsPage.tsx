import React, { useState } from 'react';
import { ExternalLink, Filter, PackageSearch, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUpdates } from '../context/UpdatesContext';
import { getTranslation } from '../data/translations';
import { SEOHead } from '../components/SEOHead';
import { ProductCategory } from '../types';
import { RegionSelector } from '../components/RegionSelector';
import { useRegion } from '../context/RegionContext';
import { isPromotionActive } from '../services/promotions';

const categories: ProductCategory[] = ['water-filtration', 'hydration', 'heat-protection', 'farming-garden', 'emergency-power'];

export const ProductsPage: React.FC = () => {
  const { language, isTelugu } = useLanguage();
  const { products, publishedUpdates, publishedContent, contentError } = useUpdates();
  const { countryCode, countryName, regionName } = useRegion();
  const t = getTranslation(language).products;
  const [selectedCategory, setSelectedCategory] = useState('all');
  const regionalUpdates = publishedUpdates.filter((update) => {
    const markets = update.countries || [];
    return countryCode === 'global' ? markets.length === 0 || markets.includes('*') : markets.length === 0 || markets.includes('*') || markets.includes(countryCode);
  });
  const regionalGuidance = publishedContent.filter((entry) => {
    if (entry.kind !== 'content' || entry.category !== 'regional-guidance' || entry.pagePath !== '/') return false;
    const markets = entry.availableCountries?.split(',').map((code) => code.trim()).filter(Boolean) || [];
    return countryCode === 'global' ? markets.includes('*') : markets.includes('*') || markets.includes(countryCode);
  });
  const currentRisks = new Set([
    ...regionalUpdates.flatMap((update) => update.climateRisks || []),
    ...regionalGuidance.flatMap((entry) => entry.climateRisks?.split(',').map((risk) => risk.trim()) || []),
  ]);
  const productsForRegion = products.filter((product) => {
    const markets = product.availableCountries || [];
    return countryCode === 'global' ? markets.includes('*') : markets.includes('*') || markets.includes(countryCode);
  }).sort((a, b) => {
    const aScore = (a.climateRisks || []).filter((risk) => currentRisks.has(risk)).length;
    const bScore = (b.climateRisks || []).filter((risk) => currentRisks.has(risk)).length;
    return bScore - aScore;
  });
  const visibleProducts = (selectedCategory === 'all' ? productsForRegion : productsForRegion.filter((product) => product.category === selectedCategory));

  return (
    <>
      <SEOHead
        titleEn="Preparedness Products and Supplies"
        titleTe="సంసిద్ధత పరికరాలు మరియు సామాగ్రి"
        descriptionEn="Optional suggestions for supplies that may help people prepare for extreme weather."
        descriptionTe="తీవ్ర వాతావరణానికి సిద్ధం కావడానికి ఉపయోగపడే సామాగ్రి సూచనలు."
      />
      <section className="border-b border-slate-200/60 bg-gradient-to-br from-red-50/80 via-white to-blue-50/80 px-4 py-10 text-center">
        <div className="mx-auto max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sky-900"><PackageSearch className="h-4 w-4" />{isTelugu ? 'సంసిద్ధత సామాగ్రి' : 'Preparedness supplies'}</span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t.pageTitle}</h1>
          <p className="mx-auto mt-3 max-w-3xl leading-relaxed text-slate-600">{t.pageSubtitle}</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-9 sm:px-6">
        <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
          <div><h2 className="font-bold">{t.disclaimerTitle}</h2><p className="mt-1 text-sm leading-relaxed">{t.disclaimerText}</p></div>
        </div>

        {contentError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{isTelugu ? 'ప్రచురించిన సమాచారం లోడ్ కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.' : `Published content could not be loaded: ${contentError}`}</p>}

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{isTelugu ? 'మీ ప్రాంతానికి సంబంధించిన ఉత్పత్తులు' : 'Products for Your Region'}</h2>
            <p className="mt-1 text-sm text-slate-600">{countryCode === 'global' ? 'Showing listings explicitly marked for global delivery.' : `${countryName} · ${regionName}. Product markets and prices are entered by the site administrator.`}</p>
          </div>
          <RegionSelector label={isTelugu ? 'ఉత్పత్తుల ప్రాంతాన్ని ఎంచుకోండి' : 'Filter products by country or region'} />
        </section>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          <button onClick={() => setSelectedCategory('all')} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold ${selectedCategory === 'all' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}><Filter className="h-4 w-4" />{t.filterAll} ({productsForRegion.length})</button>
          {categories.map((category) => {
            const label = t.categories[category];
            const count = productsForRegion.filter((product) => product.category === category).length;
            return <button key={category} onClick={() => setSelectedCategory(category)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${selectedCategory === category ? 'bg-ocean-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{label} ({count})</button>;
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((product) => (
            <article key={product.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-ocean-300 hover:shadow-lg">
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <img src={product.imageUrl} alt={isTelugu ? product.titleTe || product.name : product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                {product.badge && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800">{product.badge}</span>}
              </div>
              <div className="space-y-3 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ocean-700">{t.categories[product.category] || product.category}</p>
                <h2 className="font-bold leading-snug text-slate-900">{isTelugu ? product.titleTe || product.name : language === 'es' ? product.titleEs || product.name : product.name}</h2>
                <p className="line-clamp-4 text-sm leading-relaxed text-slate-600">{isTelugu ? product.descriptionTe || product.description : language === 'es' ? product.descriptionEs || product.description : product.description}</p>
                {product.price && <p className="font-semibold text-slate-900">{[product.price, product.currency].filter(Boolean).join(' ')}</p>}
                {isPromotionActive(product.offerExpiresAt) && (product.offer || product.offerTe || product.offerEs) && <p className="text-sm font-semibold text-teal-800">{isTelugu ? product.offerTe || product.offer : language === 'es' ? product.offerEs || product.offer : product.offer}</p>}
                {product.recommendedFor && <p className="border-t border-slate-100 pt-3 text-xs text-slate-600"><strong>{t.card.recommendedFor}: </strong>{isTelugu ? product.recommendedForTe || product.recommendedFor : language === 'es' ? product.recommendedForEs || product.recommendedFor : product.recommendedFor}</p>}
                <a href={product.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-ocean-700 hover:underline">{t.card.viewProduct}<ExternalLink className="h-4 w-4" /></a>
              </div>
            </article>
          ))}
        </div>
        {visibleProducts.length === 0 && <p className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">{isTelugu ? 'ఈ ప్రాంతానికి ప్రచురించిన ఉత్పత్తులు లేవు.' : 'No products have been published for this region yet. Product suggestions appear only after verified listings are added in the admin.'}</p>}
      </div>
    </>
  );
};
