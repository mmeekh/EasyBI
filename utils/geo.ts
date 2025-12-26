export interface GeoLocation {
  name: string;
  lat: number;
  lon: number;
  aliases?: string[];
}

const LOCATIONS: GeoLocation[] = [
  { name: 'United States', lat: 37.0902, lon: -95.7129, aliases: ['usa', 'us', 'united states of america'] },
  { name: 'United Kingdom', lat: 55.3781, lon: -3.4360, aliases: ['uk', 'great britain', 'england'] },
  { name: 'Canada', lat: 56.1304, lon: -106.3468 },
  { name: 'Brazil', lat: -14.2350, lon: -51.9253 },
  { name: 'Mexico', lat: 23.6345, lon: -102.5528, aliases: ['mexico city'] },
  { name: 'Germany', lat: 51.1657, lon: 10.4515 },
  { name: 'France', lat: 46.2276, lon: 2.2137 },
  { name: 'Spain', lat: 40.4637, lon: -3.7492 },
  { name: 'Italy', lat: 41.8719, lon: 12.5674 },
  { name: 'Netherlands', lat: 52.1326, lon: 5.2913, aliases: ['holland'] },
  { name: 'Turkey', lat: 38.9637, lon: 35.2433 },
  { name: 'Russia', lat: 61.5240, lon: 105.3188 },
  { name: 'United Arab Emirates', lat: 23.4241, lon: 53.8478, aliases: ['uae'] },
  { name: 'Saudi Arabia', lat: 23.8859, lon: 45.0792 },
  { name: 'South Africa', lat: -30.5595, lon: 22.9375 },
  { name: 'India', lat: 20.5937, lon: 78.9629 },
  { name: 'China', lat: 35.8617, lon: 104.1954 },
  { name: 'Japan', lat: 36.2048, lon: 138.2529 },
  { name: 'South Korea', lat: 35.9078, lon: 127.7669, aliases: ['korea'] },
  { name: 'Australia', lat: -25.2744, lon: 133.7751 },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
  { name: 'Ankara', lat: 39.9334, lon: 32.8597 },
  { name: 'Izmir', lat: 38.4237, lon: 27.1428 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Berlin', lat: 52.5200, lon: 13.4050 },
  { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
  { name: 'Rome', lat: 41.9028, lon: 12.4964 },
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { name: 'New York', lat: 40.7128, lon: -74.0060, aliases: ['nyc', 'new york city'] },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, aliases: ['la'] },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194, aliases: ['sf'] },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { name: 'Sao Paulo', lat: -23.5505, lon: -46.6333 },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi', lat: 28.7041, lon: 77.1025, aliases: ['new delhi'] },
  { name: 'Shanghai', lat: 31.2304, lon: 121.4737 },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Seoul', lat: 37.5665, lon: 126.9780 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Melbourne', lat: -37.8136, lon: 144.9631 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'Riyadh', lat: 24.7136, lon: 46.6753 },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
  { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 },
];

const normalizeLocation = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const LOCATION_INDEX = (() => {
  const map = new Map<string, GeoLocation>();
  LOCATIONS.forEach((location) => {
    const keys = [location.name, ...(location.aliases || [])];
    keys.forEach((key) => {
      const normalized = normalizeLocation(key);
      if (normalized) {
        map.set(normalized, location);
      }
    });
  });
  return map;
})();

export const resolveLocation = (value: string): GeoLocation | null => {
  if (!value) return null;
  const normalized = normalizeLocation(value);
  if (!normalized) return null;

  const direct = LOCATION_INDEX.get(normalized);
  if (direct) return direct;

  for (const [key, location] of LOCATION_INDEX.entries()) {
    if (normalized.includes(key) && key.length >= 4) {
      return location;
    }
  }

  return null;
};

export const projectGeoPoint = (
  lat: number,
  lon: number,
  width: number,
  height: number,
  padding = 12,
) => {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  const x = ((lon + 180) / 360) * (width - padding * 2) + padding;
  const y = ((90 - clampedLat) / 180) * (height - padding * 2) + padding;
  return { x, y };
};
