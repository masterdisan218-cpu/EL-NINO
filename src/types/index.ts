export type Language = 'en' | 'te' | 'es';

export interface NavItem {
  id: string;
  path: string;
  label: string;
}

export type ProductCategory =
  | 'water-filtration'
  | 'hydration'
  | 'heat-protection'
  | 'farming-garden'
  | 'emergency-power';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  imageUrl: string;
  externalUrl: string;
  badge?: string;
  recommendedFor: string;
  titleTe?: string;
  descriptionTe?: string;
  recommendedForTe?: string;
  titleEs?: string;
  descriptionEs?: string;
  recommendedForEs?: string;
  availableCountries?: string[];
  climateRisks?: string[];
  currency?: string;
  price?: string;
  offer?: string;
  offerTe?: string;
  offerEs?: string;
  offerExpiresAt?: string;
}

export interface OfficialSource {
  id: string;
  name: string;
  nativeName?: string;
  abbreviation: string;
  url: string;
  domain: string;
  region: string;
  description: {
    en: string;
    te: string;
    es: string;
  };
  keyRole: {
    en: string;
    te: string;
    es: string;
  };
  updateFrequency: {
    en: string;
    te: string;
    es: string;
  };
}

export interface RegionalImpact {
  region: string;
  countries: string;
  teleconnectionTrend: string;
  primaryRisks: string[];
  keyAdvisory: string;
}

export interface SafetyGuideline {
  hazard: string;
  hazardIcon: string;
  overview: string;
  dos: string[];
  donts: string[];
}

// --- Live Weather Types ---
export interface WeatherData {
  temperatureC: number;
  temperatureF: number;
  weatherCode: number;
  conditionText: {
    en: string;
    te: string;
    es: string;
  };
  windSpeedKmH: number;
  relativeHumidity: number;
  isDay: boolean;
  cityName: string;
  countryName: string;
  lastUpdated: string;
}

export interface GeoLocationResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

// --- Floating Daily Updates & Admin Types ---
export interface LiveUpdateItem {
  id: string;
  titleEn: string;
  titleTe: string;
  titleEs?: string;
  descriptionEn: string;
  descriptionTe: string;
  descriptionEs?: string;
  date: string;
  imageUrl: string;
  category: 'alert' | 'enso-report' | 'monsoon' | 'heatwave' | 'advisory';
  sourceName: string;
  sourceUrl: string;
  isPublished: boolean;
  countries?: string[];
  climateRisks?: string[];
  scheduledAt?: string;
}

export type ContentKind = 'update' | 'product' | 'page' | 'content';

export interface CMSContentEntry {
  id: string;
  kind: ContentKind;
  titleEn: string;
  titleTe: string;
  titleEs: string;
  descriptionEn: string;
  descriptionTe: string;
  descriptionEs: string;
  date: string;
  imageUrl: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  linkUrl: string;
  price: string;
  offer: string;
  offerTe: string;
  offerEs: string;
  recommendedFor: string;
  recommendedForTe: string;
  recommendedForEs: string;
  badge: string;
  pagePath: string;
  seoTitleEn: string;
  seoTitleTe: string;
  seoTitleEs: string;
  seoDescriptionEn: string;
  seoDescriptionTe: string;
  seoDescriptionEs: string;
  availableCountries: string;
  climateRisks: string;
  currency: string;
  offerExpiresAt: string;
  scheduledAt: string;
  published: boolean;
  updatedAt?: string;
  publishedAt?: string;
  expiresAt?: string;
}
