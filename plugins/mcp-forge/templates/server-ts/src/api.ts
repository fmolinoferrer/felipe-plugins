// {{TITLE}} API client. Same shape as examples/open-meteo-mcp/src/api.ts:
// config from env, injectable fetch, every failure normalised to ApiError.
// TODO(mcp-forge): replace the example Item endpoints with the real API.

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  readOnly: boolean;
  fetch: FetchLike;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    baseUrl: (env.{{ENV_PREFIX}}_BASE_URL ?? "https://api.example.com/v1").replace(/\/+$/, ""),
    apiKey: env.{{ENV_PREFIX}}_API_KEY ?? "",
    timeoutMs: Number(env.{{ENV_PREFIX}}_TIMEOUT_MS ?? 10000),
    readOnly: (env.{{ENV_PREFIX}}_READ_ONLY ?? "false").toLowerCase() === "true",
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

async function request(cfg: ApiConfig, method: string, path: string, body?: unknown): Promise<any> {
  if (!cfg.apiKey) throw new ApiError("{{ENV_PREFIX}}_API_KEY is not set. Configure it in the server environment.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await cfg.fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      // Never echo request headers (they contain the key). Truncate upstream body.
      const text = (await res.text().catch(() => "")).slice(0, 300);
      throw new ApiError(`Upstream returned ${res.status} ${res.statusText}: ${text}`, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") throw new ApiError(`Request timed out after ${cfg.timeoutMs} ms`);
    throw new ApiError(`Network error: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export interface Item {
  id: string;
  name: string;
  [k: string]: unknown;
}

export async function listItems(cfg: ApiConfig, query: string | undefined, limit: number): Promise<Item[]> {
  const qs = new URLSearchParams({ limit: String(limit), ...(query ? { q: query } : {}) });
  const data = await request(cfg, "GET", `/items?${qs}`);
  return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
}

export async function getItem(cfg: ApiConfig, id: string): Promise<Item> {
  return request(cfg, "GET", `/items/${encodeURIComponent(id)}`);
}

export async function createItem(cfg: ApiConfig, input: { name: string; notes?: string }): Promise<Item> {
  return request(cfg, "POST", "/items", input);
}
