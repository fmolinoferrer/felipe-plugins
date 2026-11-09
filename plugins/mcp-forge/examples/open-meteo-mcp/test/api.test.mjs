// Unit tests (node:test) against the built output, with a fake fetch: no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { geocode, getForecast, ApiError } from "../dist/api.js";

function cfgWith(handler) {
  const calls = [];
  return {
    calls,
    cfg: {
      forecastUrl: "https://api.example.test/v1/forecast",
      geocodingUrl: "https://geo.example.test/v1/search",
      timeoutMs: 1000,
      fetch: async (url) => {
        calls.push(url);
        return handler(url);
      },
    },
  };
}
const json = (body, status = 200) => ({
  ok: status < 400,
  status,
  statusText: status < 400 ? "OK" : "Bad Request",
  json: async () => body,
  text: async () => JSON.stringify(body),
});

test("geocode maps results and passes the query", async () => {
  const { cfg, calls } = cfgWith(() =>
    json({ results: [{ name: "Lisbon", country: "Portugal", latitude: 38.72, longitude: -9.13, timezone: "Europe/Lisbon" }] }),
  );
  const out = await geocode(cfg, "Lisbon", 1);
  assert.equal(out[0].name, "Lisbon");
  assert.equal(out[0].latitude, 38.72);
  assert.match(calls[0], /name=Lisbon/);
  assert.match(calls[0], /count=1/);
});

test("geocode returns [] when API has no results field", async () => {
  const { cfg } = cfgWith(() => json({ generationtime_ms: 0.1 }));
  assert.deepEqual(await geocode(cfg, "Nowhereville"), []);
});

test("getForecast zips daily arrays into rows", async () => {
  const { cfg, calls } = cfgWith(() =>
    json({
      latitude: 38.7,
      longitude: -9.1,
      timezone: "Europe/Lisbon",
      current: { time: "2026-11-09T12:00", temperature_2m: 18.2, wind_speed_10m: 10, weather_code: 3 },
      daily: {
        time: ["2026-11-09", "2026-11-10"],
        temperature_2m_max: [19, 20],
        temperature_2m_min: [12, 13],
        precipitation_sum: [0, 1.2],
        precipitation_probability_max: [5, 60],
        wind_speed_10m_max: [15, 22],
        weather_code: [3, 61],
      },
    }),
  );
  const f = await getForecast(cfg, 38.7, -9.1, 2);
  assert.equal(f.daily.length, 2);
  assert.equal(f.daily[1].precipitation_mm, 1.2);
  assert.equal(f.current.temperature_c, 18.2);
  assert.match(calls[0], /forecast_days=2/);
});

test("upstream HTTP errors become ApiError", async () => {
  const { cfg } = cfgWith(() => json({ reason: "Latitude must be in range" }, 400));
  await assert.rejects(getForecast(cfg, 0, 0, 1), (e) => e instanceof ApiError && e.status === 400);
});
