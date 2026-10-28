import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { Globe2, ExternalLink, ShieldAlert, X } from 'lucide-react';

export const AlertBanner: React.FC = () => {
  const { language } = useLanguage();
  const t = getTranslation(language);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside aria-label="Global Climate Alert Watch" className="bg-gradient-to-r from-red-700 via-orange-600 to-blue-800 text-white shadow-xs relative z-40">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs sm:text-sm">
          {/* Alert Message */}
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
              <ShieldAlert className="h-3.5 w-3.5 text-teal-200 animate-pulse" />
            </span>
            <span className="font-semibold text-ocean-100 uppercase tracking-wider text-[11px] sm:text-xs">
              {t.emergencyBanner.alertTitle}:
            </span>
            <span className="text-white/95 line-clamp-1 sm:line-clamp-none">
              {t.emergencyBanner.alertMessage}
            </span>
          </div>

          {/* Quick Actions & WMO Link */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="https://wmo.int/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white text-ocean-900 font-semibold hover:bg-ocean-50 transition-colors shadow-xs text-xs"
              title="Open WMO Official Portal"
            >
              <Globe2 className="h-3.5 w-3.5 text-ocean-600" />
              <span>{t.emergencyBanner.wmoBtn}</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss banner"
              className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
