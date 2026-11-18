import { describe, expect, it, vi } from "vitest";
import { ConfigError, DEFAULT_TIMEOUT_MS, loadConfig } from "../src/config";
import { createErpClient, ErpApiError, type FetchLike } from "../src/erp-client";

const KEY = "test-secret-key-0123456789abcdef";
const config = { baseUrl: "https://erp.example.test", apiKey: KEY, timeoutMs: 1000 };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function kindOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ErpApiError);
    // The thrown error must not carry the key in any form.
    expect(JSON.stringify(err)).not.toContain(KEY);
    expect(String(err)).not.toContain(KEY);
    return (err as ErpApiError).kind;
  }
  throw new Error("expected the call to fail");
}

describe("loadConfig", () => {
  const base = { ERP_API_BASE_URL: "https://erp.example.test/", ERP_API_KEY: KEY };

  it("reads base URL, key and default timeout, trimming a trailing slash", () => {
    expect(loadConfig(base)).toEqual({ baseUrl: "https://erp.example.test", apiKey: KEY, timeoutMs: DEFAULT_TIMEOUT_MS });
  });

  it("accepts a custom timeout", () => {
    expect(loadConfig({ ...base, ERP_API_TIMEOUT_MS: "2500" }).timeoutMs).toBe(2500);
  });

  it.each([
    [{ ERP_API_KEY: KEY }, /ERP_API_BASE_URL is not set/],
    [{ ERP_API_BASE_URL: "https://erp.example.test" }, /ERP_API_KEY is not set/],
    [{ ...base, ERP_API_BASE_URL: "not a url" }, /not a valid URL/],
    [{ ...base, ERP_API_BASE_URL: "http://erp.example.test" }, /must use https/],
    [{ ...base, ERP_API_BASE_URL: "https://user:pw@erp.example.test" }, /must not contain credentials/],
    [{ ...base, ERP_API_TIMEOUT_MS: "abc" }, /ERP_API_TIMEOUT_MS/],
  ])("rejects bad config %#", (env, message) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });

  it("allows http for localhost", () => {
    expect(loadConfig({ ...base, ERP_API_BASE_URL: "http://localhost:3000" }).baseUrl).toBe("http://localhost:3000");
  });

  it("never puts the key in an error message", () => {
    try {
      loadConfig({ ERP_API_BASE_URL: `http://${KEY}.example.test`, ERP_API_KEY: KEY });
    } catch (err) {
      expect(String(err)).not.toContain(KEY);
    }
  });
});

describe("createErpClient", () => {
  it("sends a GET with the key as a Bearer token and parses the JSON body", async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json(200, { id: "SO-1" }));
    const client = createErpClient(config, fetchMock);

    await expect(client.get("/api/v1/orders/SO-1")).resolves.toEqual({ id: "SO-1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://erp.example.test/api/v1/orders/SO-1");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${KEY}`);
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [404, "not_found"],
    [500, "server_error"],
    [503, "server_error"],
    [405, "unexpected"],
    [429, "unexpected"],
  ])("maps HTTP %i to %s without reading the body", async (status, kind) => {
    const res = json(status, { error: "x", leaked: KEY });
    const bodySpy = vi.spyOn(res, "json");
    const client = createErpClient(config, async () => res);

    expect(await kindOf(client.get("/x"))).toBe(kind);
    expect(bodySpy).not.toHaveBeenCalled();
  });

  it("maps a request that exceeds the timeout to timeout", async () => {
    const hangUntilAborted: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
      });
    const client = createErpClient({ ...config, timeoutMs: 20 }, hangUntilAborted);

    expect(await kindOf(client.get("/x"))).toBe("timeout");
  });

  it("maps a network failure to unreachable and drops the original message", async () => {
    const client = createErpClient(config, async () => {
      throw new TypeError(`fetch failed: Authorization: Bearer ${KEY}`);
    });

    expect(await kindOf(client.get("/x"))).toBe("unreachable");
  });

  it("maps a non-JSON 200 body to unexpected", async () => {
    const client = createErpClient(config, async () => new Response("<html>", { status: 200 }));

    expect(await kindOf(client.get("/x"))).toBe("unexpected");
  });

  it("redacts the key from text", () => {
    const client = createErpClient(config, vi.fn());
    expect(client.redact(`a ${KEY} b ${KEY}`)).toBe("a [redacted] b [redacted]");
  });
});
