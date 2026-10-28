import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { officialSources } from '../data/sourcesData';
import { useUpdates } from '../context/UpdatesContext';
import {
  Waves,
  ExternalLink,
  ShieldCheck,
  Globe2,
  HeartHandshake,
} from 'lucide-react';

export const Footer: React.FC = () => {
  const { language } = useLanguage();
  const { visiblePages } = useUpdates();
  const t = getTranslation(language);

  const footerLinks = [
    { path: '/', label: t.nav.home },
    { path: '/global-impact-safety', label: t.nav.impactSafety },
    { path: '/products', label: t.nav.products },
    { path: '/about-sources', label: t.nav.aboutSources },
  ].filter((link) => visiblePages.includes(link.path));

  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800">
          
          {/* Col 1: Brand & Purpose */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 via-orange-400 to-blue-600 flex items-center justify-center text-white">
                <Waves className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                {t.brand.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t.home.heroSubtitle}
            </p>
          </div>

          {/* Col 2: The 4 Pages */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-100 mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-ocean-400"></span>
              {t.footer.quickLinks}
            </h4>
            <ul className="space-y-2.5 text-sm">
              {footerLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Official Meteorological Authorities */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-100 mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400"></span>
              {t.footer.authorities}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {officialSources.slice(0, 6).map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between"
                >
                  <div className="truncate">
                    <span className="font-semibold text-slate-200 group-hover:text-ocean-300 transition-colors">
                      {source.abbreviation}
                    </span>
                    <span className="text-slate-500 text-[11px] block truncate">
                      {source.domain}
                    </span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-500 group-hover:text-ocean-400 shrink-0 ml-2" />
                </a>
              ))}
            </div>
          </div>

        </div>

        {/* Disclaimer & Bottom Bar */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400 text-center md:text-left">
          <div className="space-y-1 max-w-3xl">
            <p className="flex items-center justify-center md:justify-start gap-1.5 text-slate-300 font-medium">
              <ShieldCheck className="h-4 w-4 text-ocean-400 shrink-0" />
              {t.footer.rights}
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {t.footer.disclaimerText}
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0 text-slate-400">
            <span className="flex items-center gap-1.5 text-xs">
              <Globe2 className="h-4 w-4 text-teal-400" />
              <HeartHandshake className="h-4 w-4 text-rose-400" />
              {t.footer.builtFor}
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
