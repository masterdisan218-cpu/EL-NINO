import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchLiveWeather,
  searchCities,
  popularCities,
} from '../services/weatherApi';
import { WeatherData, GeoLocationResult } from '../types';
import {
  Thermometer,
  Search,
  MapPin,
  RefreshCw,
  Wind,
  Droplets,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  AlertCircle,
  Compass,
  Check,
} from 'lucide-react';

export const WeatherWidget: React.FC = () => {
  const { language, isTelugu } = useLanguage();

  // Unit: 'C' | 'F'
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoLocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Active City state (default: New Delhi)
  const [activeCity, setActiveCity] = useState<GeoLocationResult>(popularCities[0]);

  // Load weather when activeCity changes
  const loadWeather = async (city: GeoLocationResult) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLiveWeather(
        city.latitude,
        city.longitude,
        city.name,
        city.country
      );
      setWeather(data);
    } catch (err: any) {
      console.error('Weather load error:', err);
      setError('Unable to fetch live meteorological data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather(activeCity);
  }, [activeCity]);

  // Handle Geolocation
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const userCity: GeoLocationResult = {
            id: Date.now(),
            name: 'Your Location',
            country: '',
            latitude,
            longitude,
          };
          setActiveCity(userCity);
        } catch {
          setError('Could not locate city for current coordinates.');
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError('Location permission denied or unavailable. Please pick a city manually.');
      }
    );
  };

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchCities(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
      setShowSearchDropdown(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getWeatherIcon = (code: number, _isDay: boolean) => {
    if (code === 0 || code === 1) {
      return <Sun className="h-8 w-8 text-amber-500 animate-spin-slow" />;
    }
    if (code === 2 || code === 3) {
      return <Cloud className="h-8 w-8 text-sky-400" />;
    }
    if (code >= 51 && code <= 82) {
      return <CloudRain className="h-8 w-8 text-blue-500" />;
    }
    if (code >= 95) {
      return <CloudLightning className="h-8 w-8 text-purple-500" />;
    }
    return <Sun className="h-8 w-8 text-amber-500" />;
  };

  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200/90 shadow-lg p-5 sm:p-6 space-y-5">
      
      {/* Top Header & Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-ocean-50 text-ocean-700 border border-ocean-200 shrink-0">
            <Thermometer className="h-5 w-5 text-ocean-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                {isTelugu ? 'ప్రత్యక్ష ఉష్ణోగ్రత & వాతావరణం' : 'Live Global Temperature'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Live API
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isTelugu
                ? 'ఓపెన్-మెటియో (Open-Meteo) నమూనా ద్వారా నిజ సమయ సమాచారం'
                : 'Real-time meteorological observation via Open-Meteo Models'}
            </p>
          </div>
        </div>

        {/* Search Bar with Autocomplete */}
        <div className="relative flex-1 sm:max-w-xs" ref={searchContainerRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchDropdown(true);
              }}
              placeholder={isTelugu ? 'నగరం లేదా దేశం శోధించండి...' : 'Search city or country...'}
              className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-ocean-500 transition-colors"
            />
            {isSearching && (
              <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean-600 animate-spin" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 max-h-56 overflow-y-auto">
              {searchResults.map((res) => (
                <button
                  key={res.id}
                  onClick={() => {
                    setActiveCity(res);
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs sm:text-sm text-slate-700 hover:bg-ocean-50 hover:text-ocean-700 flex items-center justify-between transition-colors"
                >
                  <div className="truncate">
                    <span className="font-semibold">{res.name}</span>
                    <span className="text-slate-400 text-xs ml-1.5">
                      {res.admin1 ? `${res.admin1}, ` : ''}{res.country}
                    </span>
                  </div>
                  {activeCity.name === res.name && (
                    <Check className="h-4 w-4 text-ocean-600 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Quick Select Popular Cities & Location Button */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          onClick={handleUseMyLocation}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-semibold hover:bg-teal-100 transition-colors shadow-2xs"
          title="Detect temperature from device location"
        >
          <Compass className="h-3.5 w-3.5 text-teal-600" />
          <span>{isTelugu ? 'నా ప్రాంతం' : 'My Location'}</span>
        </button>

        <span className="text-slate-300 hidden sm:inline">|</span>

        {popularCities.map((c) => {
          const isSelected = activeCity.name === c.name;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCity(c)}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Weather Display Card */}
      {loading ? (
        <div className="p-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="h-5 w-5 animate-spin text-ocean-600" />
          <span>Fetching live weather data...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => loadWeather(activeCity)}
              className="mt-2 text-xs font-bold text-rose-700 underline hover:text-rose-900"
            >
              Retry Weather Request
            </button>
          </div>
        </div>
      ) : weather ? (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-red-50/70 via-orange-50/40 to-blue-50/70 border border-blue-200/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Left: Location & Condition */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-700">
                <MapPin className="h-4 w-4 text-ocean-600 shrink-0" />
                <span className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {weather.cityName}
                </span>
                {weather.countryName && (
                  <span className="text-xs text-slate-500 font-medium">
                    ({weather.countryName})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  {weather.conditionText[language] || weather.conditionText.en}
                </span>
                <span className="text-[11px] text-slate-400">
                  • Updated {weather.lastUpdated}
                </span>
              </div>
            </div>

            {/* Center: Main Temperature Display with °C / °F toggle */}
            <div className="flex items-center gap-4 self-start md:self-auto">
              <div className="shrink-0">
                {getWeatherIcon(weather.weatherCode, weather.isDay)}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {unit === 'C' ? weather.temperatureC : weather.temperatureF}
                </span>
                <span className="text-2xl font-bold text-slate-500">
                  °{unit}
                </span>
              </div>

              {/* Unit Toggle Buttons */}
              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-white shrink-0">
                <button
                  onClick={() => setUnit('C')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                    unit === 'C'
                      ? 'bg-ocean-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  °C
                </button>
                <button
                  onClick={() => setUnit('F')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                    unit === 'F'
                      ? 'bg-ocean-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  °F
                </button>
              </div>
            </div>

            {/* Right: Wind & Humidity */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-1 gap-2 text-xs border-t md:border-t-0 md:border-l border-slate-200/80 pt-3 md:pt-0 md:pl-6 shrink-0">
              <div className="flex items-center gap-2 text-slate-600">
                <Wind className="h-4 w-4 text-sky-600 shrink-0" />
                <span>
                  Wind: <strong className="text-slate-900">{weather.windSpeedKmH} km/h</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Droplets className="h-4 w-4 text-teal-600 shrink-0" />
                <span>
                  Humidity: <strong className="text-slate-900">{weather.relativeHumidity}%</strong>
                </span>
              </div>
            </div>

          </div>

          {/* Scientific Disclaimer distinguishing local weather from climate teleconnection */}
          <div className="mt-4 pt-3 border-t border-ocean-200/60 flex items-start gap-2 text-[11px] text-slate-500">
            <span className="font-bold text-ocean-700 shrink-0">Scientific Context:</span>
            <span>
              {isTelugu
                ? 'ప్రస్తుత ఉష్ణోగ్రత రోజువారీ స్థానిక వాతావరణాన్ని ప్రతిబింబిస్తుంది. ఎల్ నినో అనేది నెలల తరబడి సముద్ర ఉష్ణోగ్రతల ద్వారా ప్రపంచ వ్యాప్తంగా వర్షాలు మరియు వేడి తరంగాలను ప్రభావితం చేసే దీర్ఘకాలిక శీతోష్ణస్థితి ప్రక్రియ.'
                : 'Current temperature reflects immediate local weather conditions. El Niño is a macro ocean-atmosphere phenomenon influencing multi-month rainfall deficits, heatwave frequency, and seasonal droughts across entire continents.'}
            </span>
          </div>
        </div>
      ) : null}

    </div>
  );
};
