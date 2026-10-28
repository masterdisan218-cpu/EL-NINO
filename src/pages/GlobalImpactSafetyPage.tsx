import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { SEOHead } from '../components/SEOHead';
import {
  Globe2,
  MapPin,
  CheckCircle2,
  XCircle,
  Sun,
  Droplets,
  CloudRain,
  Sprout,
  Filter,
  AlertTriangle,
} from 'lucide-react';

export const GlobalImpactSafetyPage: React.FC = () => {
  const { language } = useLanguage();
  const t = getTranslation(language);
  const content = t.impactSafety;
  const [selectedHazard, setSelectedHazard] = useState<string>('all');

  const hazardIcons: Record<string, React.ReactNode> = {
    heat: <Sun className="h-5 w-5 text-amber-500" />,
    drought: <Droplets className="h-5 w-5 text-sky-500" />,
    flood: <CloudRain className="h-5 w-5 text-blue-600" />,
    farming: <Sprout className="h-5 w-5 text-teal-600" />,
  };

  const filteredGuidelines = selectedHazard === 'all'
    ? content.guidelines
    : content.guidelines.filter((g) => g.hazardIcon === selectedHazard);

  return (
    <>
      <SEOHead
        titleEn="Global Impact & Safety - Worldwide Risks, Heat, Drought, Floods & Farming"
        titleTe="ప్రపంచ ప్రభావాలు & రక్షణ - వాతావరణ ముప్పులు, ఎండలు, కరవులు & వ్యవసాయం"
        titleEs="Impacto Global y Seguridad - Riesgos Mundiales, Calor, Sequías e Inundaciones"
        descriptionEn="Country-by-country risks, teleconnections, and vetted Do’s and Don’ts for extreme heat, droughts, flash floods, and agricultural resilience."
        descriptionTe="వివిధ దేశాలు మరియు ఖండాలపై ఎల్ నినో ప్రభావాలు, తీవ్ర ఎండలు, కరవు, వరదలు మరియు వ్యవసాయ రక్షణ సూత్రాలు."
        descriptionEs="Riesgos por país, teleconexiones y pautas verificadas de qué hacer y qué evitar ante calor extremo, sequías e inundaciones."
      />

      {/* Header Banner */}
      <section className="bg-gradient-to-r from-red-50/80 via-white to-blue-50/80 pt-10 pb-12 border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-100 text-teal-900 text-xs font-semibold uppercase tracking-wider mb-4 border border-teal-200">
            <Globe2 className="h-3.5 w-3.5 text-teal-600" />
            <span>Worldwide Teleconnections & Protocols</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            {content.pageTitle}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            {content.pageSubtitle}
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        
        {/* Section 1: Regional Breakdown Cards */}
        <section className="space-y-8">
          <div>
            <div className="flex items-center gap-2 text-ocean-600 font-bold uppercase tracking-wider text-xs mb-1">
              <MapPin className="h-4 w-4" />
              <span>Continental Teleconnections</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {content.regionalTitle}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {content.regionalSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.regions.map((reg, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-6 bg-slate-50/80 border border-slate-200 flex flex-col justify-between hover:bg-white hover:shadow-md transition-all space-y-5"
              >
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900">
                        {reg.region}
                      </h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-ocean-100 text-ocean-800 font-semibold">
                        Zone {idx + 1}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-ocean-700 mt-0.5">
                      {reg.countries}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200/80">
                    {reg.teleconnectionTrend}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                      Primary Hazard Vulnerabilities:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {reg.primaryRisks.map((risk, rIdx) => (
                        <li key={rIdx} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 text-xs text-slate-700 bg-white/70 p-3 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-900 block mb-0.5">
                    Recommended Action:
                  </span>
                  <span>{reg.keyAdvisory}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Universal Preparedness Do's and Don'ts */}
        <section className="space-y-8 pt-8 border-t border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-teal-700 font-bold uppercase tracking-wider text-xs mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span>Universal Safety Protocols</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {content.safetyTitle}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {content.safetySubtitle}
            </p>
          </div>

          {/* Hazard Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedHazard('all')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                selectedHazard === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>All Hazards</span>
            </button>

            {[
              { id: 'heat', label: 'Extreme Heat', icon: <Sun className="h-3.5 w-3.5 text-amber-500" /> },
              { id: 'drought', label: 'Drought & Water', icon: <Droplets className="h-3.5 w-3.5 text-sky-500" /> },
              { id: 'flood', label: 'Floods & Storms', icon: <CloudRain className="h-3.5 w-3.5 text-blue-600" /> },
              { id: 'farming', label: 'Farming & Crops', icon: <Sprout className="h-3.5 w-3.5 text-teal-600" /> },
            ].map((tab) => {
              const active = selectedHazard === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedHazard(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    active
                      ? 'bg-ocean-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Guidelines Cards Grid */}
          <div className="space-y-10">
            {filteredGuidelines.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden"
              >
                {/* Header */}
                <div className="bg-slate-50/90 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-xl bg-white border border-slate-200 shadow-xs">
                      {hazardIcons[item.hazardIcon] || <Sun className="h-5 w-5" />}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">
                      {item.hazard}
                    </h3>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {item.overview}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* DOs */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        <h4 className="text-base font-bold text-emerald-950 uppercase tracking-wide">
                          Do’s (Recommended Actions)
                        </h4>
                      </div>
                      <ul className="space-y-2.5">
                        {item.dos.map((doItem, dIdx) => (
                          <li key={dIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                            <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                            <span className="leading-relaxed">{doItem}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* DONTs */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
                        <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                        <h4 className="text-base font-bold text-rose-950 uppercase tracking-wide">
                          Don’ts (Hazardous Mistakes)
                        </h4>
                      </div>
                      <ul className="space-y-2.5">
                        {item.donts.map((dontItem, xIdx) => (
                          <li key={xIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                            <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                            <span className="leading-relaxed">{dontItem}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </>
  );
};
