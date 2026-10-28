import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useUpdates } from '../context/UpdatesContext';
import {
  Menu,
  X,
  Globe2,
  Waves,
  ShieldCheck,
  ChevronDown,
  Check,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { language, setLanguage, isTelugu, availableLanguages } = useLanguage();
  const { visiblePages } = useUpdates();
  const t = getTranslation(language);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setLangDropdownOpen(false);
  }, [location.pathname]);

  // Click outside to close language dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { path: '/', label: t.nav.home },
    { path: '/global-impact-safety', label: t.nav.impactSafety },
    { path: '/products', label: t.nav.products },
    { path: '/about-sources', label: t.nav.aboutSources },
  ].filter((link) => visiblePages.includes(link.path));

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const currentLangObj = availableLanguages.find((l) => l.code === language) || availableLanguages[0];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Brand Name */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-hidden focus:ring-2 focus:ring-ocean-500 rounded-lg p-1"
          >
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-red-600 via-orange-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
              <Waves className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg sm:text-xl tracking-tight group-hover:text-ocean-700 transition-colors">
                  {t.brand.name}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  WMO • NOAA
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                {isTelugu ? 'ప్రపంచ వాతావరణ సంసిద్ధత & ముందస్తు హెచ్చరికలు' : t.brand.tagline}
              </p>
            </div>
          </Link>

          {/* Desktop 4 Nav Links */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-ocean-50 text-ocean-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Language Switcher and Mobile Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Dropdown Selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-red-50 via-orange-50 to-blue-50 border border-blue-200 text-blue-900 hover:from-red-100 hover:to-blue-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all shadow-xs text-xs sm:text-sm font-semibold"
                aria-expanded={langDropdownOpen}
                aria-label="Select language"
              >
                <Globe2 className="h-4 w-4 text-ocean-600" />
                <span>{currentLangObj.native}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Select Language
                  </div>
                  {availableLanguages.map((langOpt) => {
                    const isSelected = language === langOpt.code;
                    return (
                      <button
                        key={langOpt.code}
                        onClick={() => {
                          setLanguage(langOpt.code);
                          setLangDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-xs sm:text-sm text-left transition-colors ${
                          isSelected
                            ? 'bg-ocean-50 font-bold text-ocean-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{langOpt.native}</span>
                          <span className="text-[10px] text-slate-400 font-sans">{langOpt.label}</span>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-ocean-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile Menu Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-ocean-500"
              aria-expanded={mobileMenuOpen}
              aria-label="Open main navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-slate-800" />
              ) : (
                <Menu className="h-6 w-6 text-slate-800" />
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Navigation (4 Links) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-full bg-white/98 backdrop-blur-lg border-b border-slate-200 shadow-xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-4 space-y-1.5 sm:px-6">
            <div className="pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Menu ({navLinks.length} Pages)
              </span>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                El Niño Ready World
              </span>
            </div>

            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-base font-semibold transition-colors ${
                    active
                      ? 'bg-ocean-100/70 text-ocean-900 border-l-4 border-ocean-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{link.label}</span>
                  {active && (
                    <span className="h-2 w-2 rounded-full bg-ocean-600"></span>
                  )}
                </Link>
              );
            })}

            {/* Mobile Language Switcher Section */}
            <div className="pt-4 mt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-semibold block mb-2">
                Language (భాష / Idioma):
              </span>
              <div className="grid grid-cols-3 gap-2">
                {availableLanguages.map((langOpt) => {
                  const isSelected = language === langOpt.code;
                  return (
                    <button
                      key={langOpt.code}
                      onClick={() => setLanguage(langOpt.code)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold text-center border transition-all ${
                        isSelected
                          ? 'bg-ocean-600 text-white border-ocean-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                      }`}
                    >
                      {langOpt.native}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </header>
  );
};
