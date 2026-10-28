import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useUpdates } from '../context/UpdatesContext';
import {
  Bell,
  X,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

export const FloatingUpdatesDrawer: React.FC = () => {
  const { isTelugu } = useLanguage();
  const {
    publishedUpdates,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
  } = useUpdates();

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'alert':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'enso-report':
        return 'bg-ocean-100 text-ocean-800 border-ocean-200';
      case 'monsoon':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'heatwave':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <>
      {/* Floating Action Button (Always visible on all pages) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={openDrawer}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-blue-700 text-white font-bold text-xs sm:text-sm shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/40 focus:outline-hidden focus:ring-4 focus:ring-blue-300"
          aria-label="Open latest daily updates drawer"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>

          <Bell className="h-4 w-4 sm:h-5 sm:w-5 group-hover:rotate-12 transition-transform" />

          <span>
            {isTelugu ? 'తాజా సమాచారం' : 'Daily Updates'}
          </span>

          {/* Badge Counter */}
          <span className="px-2 py-0.5 rounded-full bg-white text-ocean-900 text-[11px] font-mono font-extrabold shadow-xs">
            {publishedUpdates.length}
          </span>
        </button>
      </div>

      {/* Slide-out Drawer Panel */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
          
          {/* Backdrop overlay */}
          <div
            onClick={closeDrawer}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer container (Right side) */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
              
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-ocean-50 text-ocean-700 border border-ocean-200">
                    <Sparkles className="h-4 w-4 text-ocean-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                      {isTelugu ? 'రోజువారీ వాతావరణ అప్‌డేట్స్' : 'Daily Climate Updates'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isTelugu ? 'ధృవీకరించిన అధికారిక నివేదికలు' : 'Verified Bulletins & Advisories'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeDrawer}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Close updates drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Updates List (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {publishedUpdates.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <ShieldAlert className="h-10 w-10 mx-auto text-slate-300" />
                    <p className="text-sm font-semibold">No published updates right now.</p>
                  </div>
                ) : (
                  publishedUpdates.map((item) => {
                    const title = isTelugu ? item.titleTe : item.titleEn;
                    const desc = isTelugu ? item.descriptionTe : item.descriptionEn;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-ocean-300 transition-all overflow-hidden flex flex-col justify-between"
                      >
                        {/* Image */}
                        {item.imageUrl && (
                          <div className="aspect-16/9 w-full bg-slate-100 overflow-hidden relative">
                            <img
                              src={item.imageUrl}
                              alt={title}
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';
                              }}
                              className="h-full w-full object-cover hover:scale-105 transition-transform duration-300"
                            />
                            <span
                              className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-xs ${getCategoryColor(
                                item.category
                              )}`}
                            >
                              {item.category.toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Text Details */}
                        <div className="p-4 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                            <Calendar className="h-3 w-3" />
                            <span>{item.date}</span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm leading-snug">
                            {title}
                          </h4>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {desc}
                          </p>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[180px]">
                              {item.sourceName}
                            </span>

                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-ocean-600 hover:text-ocean-700 hover:underline"
                            >
                              <span>{isTelugu ? 'మూలం చూడండి' : 'Read Source'}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-slate-400" />
                  <span>{publishedUpdates.length} Active Bulletins</span>
                </span>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
};
