import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { countries, getBrowserCountry } from '../data/regions';

interface RegionContextValue {
  countryCode: string;
  countryName: string;
  regionName: string;
  setCountryCode: (code: string) => void;
}

const STORAGE_KEY = 'el_nino_ready_world_country';
const RegionContext = createContext<RegionContextValue | undefined>(undefined);

export const RegionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [countryCode, setCountryCodeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'global' || countries.some((country) => country.code === saved))) return saved;
    } catch {
      // Browser storage can be disabled; the locale suggestion still works.
    }
    return getBrowserCountry();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, countryCode);
    } catch {
      // The selected region remains available for the current page view.
    }
  }, [countryCode]);

  const selectedCountry = countries.find((country) => country.code === countryCode);
  const value = useMemo(() => ({
    countryCode,
    countryName: selectedCountry?.name || 'Global',
    regionName: selectedCountry?.region || 'Global',
    setCountryCode: (code: string) => {
      if (code === 'global' || countries.some((country) => country.code === code)) {
        setCountryCodeState(code);
      }
    },
  }), [countryCode, selectedCountry]);

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
};

export const useRegion = (): RegionContextValue => {
  const context = useContext(RegionContext);
  if (!context) throw new Error('useRegion must be used within a RegionProvider');
  return context;
};
