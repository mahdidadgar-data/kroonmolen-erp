// HTTP helpers for the public read-only API (/api/v1). Server-only.

export type ApiErrorCode = "unauthorized" | "not_found" | "method_not_allowed" | "server_error";

const BASE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

/** Every error has the same shape: {"error":"<code>"}. No messages, no stack traces. */
export function errorResponse(
  status: number,
  error: ApiErrorCode,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(status, { error }, headers);
}

export const notFound = () => errorResponse(404, "not_found");
export const methodNotAllowed = () => errorResponse(405, "method_not_allowed", { allow: "GET" });
export const unauthorized = () =>
  errorResponse(401, "unauthorized", { "www-authenticate": 'Bearer realm="erp-api"' });
export const serverError = () => errorResponse(500, "server_error");

/**
 * Checks "Authorization: Bearer <key>" against ERP_API_KEY.
 * Both values are SHA-256 hashed first so timingSafeEqual compares equal-length
 * buffers and the comparison time does not depend on the key's length or content.
 * Returns null when the request is authorised, otherwise the error response to send.
 */
export async function checkApiKey(request: Request): Promise<Response | null> {
  const expected = process.env["ERP_API_KEY"];
  if (!expected) {
    console.error("[api/v1] ERP_API_KEY is not set; refusing all API requests.");
    return serverError();
  }

  const match = /^Bearer[ ]+(\S+)[ ]*$/i.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) return unauthorized();

  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(token), digest(expected)) ? null : unauthorized();
}
