import { WeatherData, GeoLocationResult } from '../types';

// Map WMO Weather Interpretation Codes to multilingual descriptions
export const getWeatherCondition = (code: number) => {
  switch (code) {
    case 0:
      return { en: 'Clear sky', te: 'నిర్మలమైన ఆకాశం', es: 'Cielo despejado' };
    case 1:
      return { en: 'Mainly clear', te: 'తేలికపాటి మేఘాలు', es: 'Mayormente despejado' };
    case 2:
      return { en: 'Partly cloudy', te: 'పాక్షికంగా మేఘావృతం', es: 'Parcialmente nublado' };
    case 3:
      return { en: 'Overcast', te: 'పూర్తిగా మేఘావృతం', es: 'Nublado' };
    case 45:
    case 48:
      return { en: 'Fog & Mist', te: 'పొగమంచు', es: 'Niebla' };
    case 51:
    case 53:
    case 55:
      return { en: 'Light drizzle', te: 'తేలికపాటి జల్లులు', es: 'Llovizna ligera' };
    case 61:
    case 63:
    case 65:
      return { en: 'Rain showers', te: 'వర్షపు జల్లులు', es: 'Lluvia' };
    case 71:
    case 73:
    case 75:
      return { en: 'Snowfall', te: 'మంచు కురుస్తోంది', es: 'Nevada' };
    case 80:
    case 81:
    case 82:
      return { en: 'Heavy downpour', te: 'భారీ వర్షం', es: 'Chubascos intensos' };
    case 95:
    case 96:
    case 99:
      return { en: 'Thunderstorm', te: 'ఉరుములు & మెరుపులతో కూడిన వాన', es: 'Tormenta eléctrica' };
    default:
      return { en: 'Moderate conditions', te: 'సాధారణ వాతావరణం', es: 'Condiciones moderadas' };
  }
};

// Search global cities using Open-Meteo Geocoding
export const searchCities = async (query: string): Promise<GeoLocationResult[]> => {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query.trim()
    )}&count=6&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Geocoding search failed');
    const data = await response.json();
    if (!data.results) return [];
    return data.results.map((item: any) => ({
      id: item.id,
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      country: item.country || '',
      admin1: item.admin1 || '',
    }));
  } catch (err) {
    console.error('Error searching cities:', err);
    return [];
  }
};

// Fetch real-time temperature & atmospheric conditions
export const fetchLiveWeather = async (
  lat: number,
  lon: number,
  cityName: string,
  countryName: string
): Promise<WeatherData> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&timezone=auto`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather service returned HTTP ${response.status}`);
  }
  const data = await response.json();
  const current = data.current;

  if (!current) {
    throw new Error('Current weather parameters missing from forecast response');
  }

  const tempC = Math.round(current.temperature_2m * 10) / 10;
  const tempF = Math.round(((tempC * 9) / 5 + 32) * 10) / 10;
  const condition = getWeatherCondition(current.weather_code);

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    temperatureC: tempC,
    temperatureF: tempF,
    weatherCode: current.weather_code,
    conditionText: condition,
    windSpeedKmH: Math.round(current.wind_speed_10m),
    relativeHumidity: current.relative_humidity_2m,
    isDay: current.is_day === 1,
    cityName,
    countryName,
    lastUpdated: timeFormatted,
  };
};

// Popular global cities for quick selection
export const popularCities: GeoLocationResult[] = [
  { id: 1, name: 'New Delhi', country: 'India', latitude: 28.6139, longitude: 77.2090 },
  { id: 2, name: 'Hyderabad', country: 'India', latitude: 17.3850, longitude: 78.4867 },
  { id: 3, name: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503 },
  { id: 4, name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278 },
  { id: 5, name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060 },
  { id: 6, name: 'Lima', country: 'Peru', latitude: -12.0464, longitude: -77.0428 },
  { id: 7, name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093 },
  { id: 8, name: 'Nairobi', country: 'Kenya', latitude: -1.2921, longitude: 36.8219 },
];
