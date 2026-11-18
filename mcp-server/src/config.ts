/**
 * Reads the server configuration from environment variables.
 *
 * Error messages name the variable that is wrong but never echo its value,
 * so a misconfigured key cannot end up in logs.
 */

export interface ErpConfig {
  /** Base URL of the published app, without trailing slash, e.g. https://your-app.lovable.app */
  baseUrl: string;
  /** Value of the ERP_API_KEY secret, sent as a Bearer token. */
  apiKey: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export class ConfigError extends Error {
  override name = "ConfigError";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function loadConfig(env: Record<string, string | undefined>): ErpConfig {
  const rawBaseUrl = env["ERP_API_BASE_URL"]?.trim();
  const apiKey = env["ERP_API_KEY"]?.trim();
  const rawTimeout = env["ERP_API_TIMEOUT_MS"]?.trim();

  if (!rawBaseUrl) throw new ConfigError("ERP_API_BASE_URL is not set.");
  if (!apiKey) throw new ConfigError("ERP_API_KEY is not set.");

  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new ConfigError("ERP_API_BASE_URL is not a valid URL.");
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    // The API key travels in a header, so plain http is only allowed for local development.
    throw new ConfigError("ERP_API_BASE_URL must use https:// (http:// is only allowed for localhost).");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ConfigError("ERP_API_BASE_URL must not contain credentials, a query string or a fragment.");
  }

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (rawTimeout) {
    timeoutMs = Number(rawTimeout);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
      throw new ConfigError("ERP_API_TIMEOUT_MS must be an integer between 100 and 120000.");
    }
  }

  return {
    baseUrl: `${url.origin}${url.pathname}`.replace(/\/+$/, ""),
    apiKey,
    timeoutMs,
  };
}
