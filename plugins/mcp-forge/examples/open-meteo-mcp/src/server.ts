import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiConfig, ApiError, geocode, getForecast, loadConfig } from "./api.js";

export const SERVER_NAME = "open-meteo-mcp";
export const SERVER_VERSION = "0.1.0";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// Errors are returned as tool results (isError: true) so the model can see
// and recover from them, instead of surfacing as protocol errors.
function fail(err: unknown): ToolResult {
  const msg =
    err instanceof ApiError ? err.message : `Unexpected error: ${(err as Error)?.message ?? String(err)}`;
  return { content: [{ type: "text", text: msg }], isError: true };
}

export function createServer(cfg: ApiConfig = loadConfig()): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  // READ tool
  server.registerTool(
    "geocode",
    {
      title: "Geocode a place name",
      description:
        "Look up coordinates for a city or place name using Open-Meteo geocoding. " +
        "Returns up to `count` matches with name, country, region, latitude, longitude and timezone. " +
        "Call this before get_forecast when you only have a place name.",
      inputSchema: {
        name: z.string().trim().min(2).max(100).describe("Place name, e.g. Lisbon or Springfield"),
        count: z.number().int().min(1).max(10).default(5).describe("Maximum matches to return (1-10)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ name, count }) => {
      try {
        const places = await geocode(cfg, name, count);
        if (places.length === 0) {
          return ok({ query: name, results: [], note: "No matches. Try another spelling or a larger nearby city." });
        }
        return ok({ query: name, results: places });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // READ tool
  server.registerTool(
    "get_forecast",
    {
      title: "Get a daily weather forecast",
      description:
        "Get current conditions and a daily forecast (max/min temperature in C, precipitation in mm, " +
        "precipitation probability, max wind in km/h, WMO weather code) for a latitude/longitude. " +
        "Dates are in the location's local timezone.",
      inputSchema: {
        lat: z.number().min(-90).max(90).describe("Latitude in decimal degrees"),
        lon: z.number().min(-180).max(180).describe("Longitude in decimal degrees"),
        days: z.number().int().min(1).max(16).default(3).describe("Number of forecast days (1-16)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ lat, lon, days }) => {
      try {
        return ok(await getForecast(cfg, lat, lon, days));
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}
