/**
 * Minimal client for the read-only Kroonmolen ERP REST API v1 (docs/openapi.yaml).
 *
 * Every failure becomes an ErpApiError with a fixed `kind`. Response bodies of
 * failed requests, raw exception messages and headers are never passed on, so
 * nothing from the transport layer (and never the API key) reaches the caller.
 */
import type { ErpConfig } from "./config";

export type ErpErrorKind =
  | "unauthorized"
  | "not_found"
  | "server_error"
  | "timeout"
  | "unreachable"
  | "unexpected";

export class ErpApiError extends Error {
  override name = "ErpApiError";
  constructor(readonly kind: ErpErrorKind) {
    super(`ERP API error: ${kind}`);
  }
}

export interface ErpClient {
  /** GET a path such as `/api/v1/orders/SO-24001` and return the parsed JSON body. */
  get(path: string): Promise<unknown>;
  /** Replace every occurrence of the API key in `text` (defence in depth for tool output). */
  redact(text: string): string;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function statusToKind(status: number): ErpErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status >= 500) return "server_error";
  return "unexpected";
}

export function createErpClient(
  config: ErpConfig,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): ErpClient {
  return {
    async get(path) {
      let res: Response;
      try {
        res = await fetchImpl(`${config.baseUrl}${path}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(config.timeoutMs),
          // Never follow a redirect: it could carry the Authorization header to another host.
          redirect: "error",
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        throw new ErpApiError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable");
      }

      if (!res.ok) {
        // Do not read the body: it is not needed and must not leak into tool output.
        throw new ErpApiError(statusToKind(res.status));
      }

      try {
        return await res.json();
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        throw new ErpApiError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unexpected");
      }
    },

    redact(text) {
      // A real key is long; skipping very short values avoids mangling ordinary JSON.
      if (config.apiKey.length < 8) return text;
      return text.split(config.apiKey).join("[redacted]");
    },
  };
}
