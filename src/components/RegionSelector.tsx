import React from 'react';
import { Globe2 } from 'lucide-react';
import { countries } from '../data/regions';
import { useRegion } from '../context/RegionContext';

interface RegionSelectorProps {
  className?: string;
  label?: string;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({ className = '', label = 'Your country or region' }) => {
  const { countryCode, setCountryCode } = useRegion();

  return (
    <label className={`flex items-center gap-2 text-sm font-semibold text-slate-700 ${className}`}>
      <Globe2 className="h-4 w-4 shrink-0 text-ocean-700" />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={countryCode}
        onChange={(event) => setCountryCode(event.target.value)}
        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-200"
      >
        <option value="global">Global</option>
        {countries.map((country) => (
          <option key={country.code} value={country.code}>{country.name} ({country.region})</option>
        ))}
      </select>
    </label>
  );
};
