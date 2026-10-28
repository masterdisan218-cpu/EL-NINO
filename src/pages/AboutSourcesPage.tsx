import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { officialSources } from '../data/sourcesData';
import { SEOHead } from '../components/SEOHead';
import {
  ShieldCheck,
  ExternalLink,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Heart,
  Globe2,
  Ban,
  FileText,
  Compass,
} from 'lucide-react';

export const AboutSourcesPage: React.FC = () => {
  const { language } = useLanguage();
  const t = getTranslation(language);
  const content = t.aboutSources;

  const ethicsIcons = [
    <Ban key="1" className="h-6 w-6 text-emerald-600" />,
    <FileText key="2" className="h-6 w-6 text-ocean-600" />,
    <Globe2 key="3" className="h-6 w-6 text-teal-600" />,
    <Compass key="4" className="h-6 w-6 text-amber-500" />,
  ];

  return (
    <>
      <SEOHead
        titleEn="About Us & Official Global Sources - WMO, NOAA, IMD & NDMA"
        titleTe="మా గురించి & అధికారిక అంతర్జాతీయ మూలాలు - WMO, NOAA & IMD"
        titleEs="Acerca de Nosotros y Fuentes Oficiales - OMM, NOAA, IMD y FEMA"
        descriptionEn="Our global public interest mission, scientific ethics, and verified directory of world meteorological and disaster management authorities."
        descriptionTe="మా అంతర్జాతీయ ప్రజా విద్యా లక్ష్యం, నైతిక విలువలు మరియు అధికారిక వాతావరణ సంస్థల వివరాలు."
        descriptionEs="Nuestra misión de interés público, ética científica y directorio de organismos meteorológicos mundiales."
      />

      {/* Header Banner */}
      <section className="bg-gradient-to-r from-red-50/80 via-white to-blue-50/80 pt-10 pb-12 border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-semibold uppercase tracking-wider mb-4 border border-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Public Trust & Citations</span>
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
        
        {/* Mission Statement */}
        <section className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-ocean-600 font-bold uppercase tracking-wider text-xs">
            <Heart className="h-4 w-4 text-rose-500" />
            <span>{content.missionTitle}</span>
          </div>
          <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-medium">
            {content.missionText}
          </p>
        </section>

        {/* 4 Guiding Ethics */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {content.ethicsTitle}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Strict non-commercial and evidence-based standards
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {content.ethics.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-6 bg-white border border-slate-200 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {ethicsIcons[idx]}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Directory of Authoritative Global Meteorological Agencies */}
        <section className="space-y-8 pt-8 border-t border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-ocean-600 font-bold uppercase tracking-wider text-xs mb-1">
              <Building2 className="h-4 w-4" />
              <span>Statutory Weather Authorities</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {content.sourcesTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {content.sourcesSubtitle}
            </p>
          </div>

          <div className="space-y-6">
            {officialSources.map((source) => {
              const desc = source.description[language] || source.description.en;
              const role = source.keyRole[language] || source.keyRole.en;
              const freq = source.updateFrequency[language] || source.updateFrequency.en;

              return (
                <div
                  key={source.id}
                  className="rounded-2xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-5 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-ocean-100 text-ocean-800">
                          {source.abbreviation}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {source.region}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified Agency
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 pt-1">
                        {source.name}
                        {source.nativeName && source.nativeName !== source.name && (
                          <span className="text-sm font-normal text-slate-500 ml-2">
                            ({source.nativeName})
                          </span>
                        )}
                      </h3>
                    </div>

                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ocean-600 hover:bg-ocean-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors shrink-0"
                    >
                      <span>Visit Agency Portal</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                    {desc}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="font-bold text-slate-800 block mb-1">
                        Key Responsibilities:
                      </span>
                      <span className="text-slate-600 leading-relaxed">
                        {role}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="font-bold text-slate-800 block mb-1">
                        Publication Frequency:
                      </span>
                      <span className="text-slate-600 leading-relaxed">
                        {freq}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    URL: <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-ocean-600 hover:underline">{source.url}</a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Emergency Helplines Directory */}
        <section className="space-y-6 pt-8 border-t border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-rose-600 font-bold uppercase tracking-wider text-xs mb-1">
              <PhoneCall className="h-4 w-4" />
              <span>International & National Lines</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {content.helplinesTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {content.helplinesSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {content.helplines.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-5 bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-mono font-extrabold text-slate-900">
                      {item.number}
                    </span>
                    <a
                      href={`tel:${item.number.replace(/[^0-9]/g, '')}`}
                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      title="Call Helpline"
                    >
                      <PhoneCall className="h-4 w-4" />
                    </a>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mt-1">
                    {item.name}
                  </h4>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Statutory Advisory Box */}
        <div className="p-6 rounded-2xl bg-slate-900 text-white flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            <strong>Statutory Civil Defense Notice:</strong> This website is an educational synthesis. During active cyclones, extreme heatwaves, or flash flood warnings, always prioritize orders issued by your local mayor’s office, district collectorate, or national civil protection agency.
          </p>
        </div>

      </div>
    </>
  );
};
