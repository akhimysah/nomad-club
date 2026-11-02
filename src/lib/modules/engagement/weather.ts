/**
 * Météo à Marrakech : API Open-Meteo (gratuite, sans clé), appelée côté serveur.
 * Cache de 30 minutes en mémoire du serveur ; si l'API est indisponible, dernière réponse valide (ou message de repli).
 */

export const MARRAKECH = { lat: 31.6295, lng: -7.9811 } as const;

export type WeatherDay = { date: string; min: number; max: number; code: number };
export type Weather = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
  sunrise: string | null;
  sunset: string | null;
  days: WeatherDay[];
  /** Instant de la mesure (heure locale de Marrakech, AAAA-MM-JJTHH:MM). */
  observedAt: string;
};
export type WeatherResult = { ok: true; data: Weather; stale: boolean } | { ok: false };

const URL_ =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${MARRAKECH.lat}&longitude=${MARRAKECH.lng}` +
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day" +
  "&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset" +
  "&timezone=Africa%2FCasablanca&forecast_days=4";

const TTL = 30 * 60_000;
/** Dernière réponse valide (cache de 30 min, puis repli si l'API ne répond plus). Les erreurs ne sont jamais mises en cache. */
const g = globalThis as typeof globalThis & { __nomadWeather?: { data: Weather; at: number }; __nomadWeatherFail?: number };

type OpenMeteo = {
  current?: { time: string; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number; is_day: number };
  daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[]; sunrise: string[]; sunset: string[] };
};

export function parseOpenMeteo(j: OpenMeteo): Weather | null {
  const c = j.current;
  const d = j.daily;
  if (!c || !d || !Array.isArray(d.time) || typeof c.temperature_2m !== "number") return null;
  return {
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    wind: c.wind_speed_10m,
    code: c.weather_code,
    isDay: c.is_day === 1,
    sunrise: d.sunrise?.[0]?.slice(11, 16) ?? null,
    sunset: d.sunset?.[0]?.slice(11, 16) ?? null,
    days: d.time.map((date, i) => ({ date, min: d.temperature_2m_min[i], max: d.temperature_2m_max[i], code: d.weather_code[i] })),
    observedAt: c.time,
  };
}

export async function getWeather(): Promise<WeatherResult> {
  const hit = g.__nomadWeather;
  if (hit && Date.now() - hit.at < TTL) return { ok: true, data: hit.data, stale: false };
  // après un échec, on attend une minute avant de réessayer (pas de rafale d'appels)
  if (g.__nomadWeatherFail && Date.now() - g.__nomadWeatherFail < 60_000) return hit ? { ok: true, data: hit.data, stale: true } : { ok: false };
  try {
    const res = await fetch(URL_, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = parseOpenMeteo((await res.json()) as OpenMeteo);
    if (!data) throw new Error("Open-Meteo : réponse inattendue");
    g.__nomadWeather = { data, at: Date.now() };
    g.__nomadWeatherFail = undefined;
    return { ok: true, data, stale: false };
  } catch (e) {
    console.warn("[météo]", e instanceof Error ? e.message : e);
    g.__nomadWeatherFail = Date.now();
    return hit ? { ok: true, data: hit.data, stale: true } : { ok: false };
  }
}

/** Codes météo WMO → libellé français et pictogramme. */
export function weatherLabel(code: number): { label: string; kind: "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm" } {
  if (code === 0) return { label: "Ciel dégagé", kind: "sun" };
  if (code === 1) return { label: "Plutôt ensoleillé", kind: "sun" };
  if (code === 2) return { label: "Partiellement nuageux", kind: "partly" };
  if (code === 3) return { label: "Couvert", kind: "cloud" };
  if (code === 45 || code === 48) return { label: "Brouillard", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "Bruine", kind: "rain" };
  if (code >= 61 && code <= 67) return { label: "Pluie", kind: "rain" };
  if (code >= 71 && code <= 77) return { label: "Neige", kind: "snow" };
  if (code >= 80 && code <= 82) return { label: "Averses", kind: "rain" };
  if (code === 85 || code === 86) return { label: "Averses de neige", kind: "snow" };
  if (code >= 95) return { label: "Orage", kind: "storm" };
  return { label: "Variable", kind: "partly" };
}
