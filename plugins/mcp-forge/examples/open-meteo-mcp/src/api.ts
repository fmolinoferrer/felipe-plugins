// Thin, testable API client. All network access goes through `fetchJson`,
// and the fetch implementation is injectable via ApiConfig for tests.

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface ApiConfig {
  forecastUrl: string;
  geocodingUrl: string;
  timeoutMs: number;
  fetch: FetchLike;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    forecastUrl: env.OPEN_METEO_FORECAST_URL ?? "https://api.open-meteo.com/v1/forecast",
    geocodingUrl: env.OPEN_METEO_GEOCODING_URL ?? "https://geocoding-api.open-meteo.com/v1/search",
    timeoutMs: Number(env.OPEN_METEO_TIMEOUT_MS ?? 10000),
    fetch: globalThis.fetch as unknown as FetchLike,
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJson(cfg: ApiConfig, url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await cfg.fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      throw new ApiError(`Upstream returned ${res.status} ${res.statusText}: ${body}`, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(`Request timed out after ${cfg.timeoutMs} ms`);
    }
    throw new ApiError(`Network error: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export interface Place {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  population?: number;
}

export async function geocode(cfg: ApiConfig, name: string, count = 5): Promise<Place[]> {
  const url = new URL(cfg.geocodingUrl);
  url.searchParams.set("name", name);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const data = await fetchJson(cfg, url.toString());
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  return results.map((r) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    population: r.population,
  }));
}

export interface ForecastDay {
  date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_mm: number | null;
  precipitation_probability_max: number | null;
  wind_speed_max_kmh: number | null;
  weather_code: number | null;
}

export interface Forecast {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: { time: string; temperature_c: number; wind_speed_kmh: number; weather_code: number };
  daily: ForecastDay[];
}

export async function getForecast(cfg: ApiConfig, lat: number, lon: number, days: number): Promise<Forecast> {
  const url = new URL(cfg.forecastUrl);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("forecast_days", String(days));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("current", "temperature_2m,wind_speed_10m,weather_code");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code",
  );
  const d = await fetchJson(cfg, url.toString());
  const daily = d?.daily ?? {};
  const times: string[] = daily.time ?? [];
  const at = (k: string, i: number) => (Array.isArray(daily[k]) ? (daily[k][i] ?? null) : null);
  return {
    latitude: d.latitude,
    longitude: d.longitude,
    timezone: d.timezone,
    current: d.current
      ? {
          time: d.current.time,
          temperature_c: d.current.temperature_2m,
          wind_speed_kmh: d.current.wind_speed_10m,
          weather_code: d.current.weather_code,
        }
      : undefined,
    daily: times.map((date, i) => ({
      date,
      temp_max_c: at("temperature_2m_max", i),
      temp_min_c: at("temperature_2m_min", i),
      precipitation_mm: at("precipitation_sum", i),
      precipitation_probability_max: at("precipitation_probability_max", i),
      wind_speed_max_kmh: at("wind_speed_10m_max", i),
      weather_code: at("weather_code", i),
    })),
  };
}
