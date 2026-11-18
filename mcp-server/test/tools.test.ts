/**
 * End-to-end tool tests: a real MCP client talks to the server over the SDK's
 * in-memory transport, with only `fetch` mocked.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createErpClient, type FetchLike } from "../src/erp-client";
import { createServer, TOOL_DEFS } from "../src/tools";

const KEY = "test-secret-key-0123456789abcdef";
const BASE = "https://erp.example.test";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const VALID: Record<string, [arg: string, id: string, path: string]> = {
  get_order: ["order_id", "SO-24042", "/api/v1/orders/SO-24042"],
  list_customer_orders: ["customer_id", "CUST-1006", "/api/v1/customers/CUST-1006/orders"],
  get_product_stock: ["product_id", "PRD-2008", "/api/v1/products/PRD-2008/stock"],
  get_shipment: ["shipment_id", "SHP-30042", "/api/v1/shipments/SHP-30042"],
  get_invoice: ["invoice_id", "INV-50039", "/api/v1/invoices/INV-50039"],
};

let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
let client: Client;

beforeEach(async () => {
  fetchMock = vi.fn<FetchLike>(async () => json(200, { ok: true }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const server = createServer(createErpClient({ baseUrl: BASE, apiKey: KEY, timeoutMs: 1000 }, fetchMock));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterEach(async () => {
  await client.close();
  vi.restoreAllMocks();
});

async function call(name: string, args: Record<string, unknown>) {
  try {
    return (await client.callTool({ name, arguments: args })) as CallToolResult;
  } catch (err) {
    // Some SDK versions surface validation failures as a protocol error instead of isError.
    return { isError: true, content: [{ type: "text", text: String(err) }] } as CallToolResult;
  }
}

const textOf = (result: CallToolResult) =>
  result.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");

describe("tool listing", () => {
  it("exposes exactly the five tools, all annotated read-only", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(Object.keys(VALID).sort());
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.description?.length).toBeGreaterThan(80);
      expect(tool.inputSchema.required).toEqual([VALID[tool.name]![0]]);
    }
  });
});

describe.each(TOOL_DEFS.map((d) => d.name))("%s", (name) => {
  const [arg, id, path] = VALID[name]!;

  it("calls the matching endpoint with the Bearer key and returns the JSON", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id, status: "open" }));

    const result = await call(name, { [arg]: id });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({ id, status: "open" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}${path}`);
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${KEY}`);
  });

  it.each([
    ["wrong letters", id.replace(/[0-9]+$/, "ABC")],
    ["lowercase prefix", id.toLowerCase()],
    ["wrong prefix", "XX-123"],
    ["path traversal", `${id}/../../admin`],
    ["query injection", `${id}?x=1`],
    ["too many digits", id.replace(/[0-9]+$/, "12345678901")],
    ["empty string", ""],
  ])("rejects %s before calling the API", async (_label, badId) => {
    const result = await call(name, { [arg]: badId });

    expect(result.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing or non-string argument", async () => {
    expect((await call(name, {})).isError).toBe(true);
    expect((await call(name, { [arg]: 123 })).isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("error mapping", () => {
  it.each([
    [401, /^Unauthorized:/],
    [404, /^Not found: no sales order with ID SO-24042\.$/],
    [500, /^ERP server error\./],
    [418, /^Unexpected response/],
  ])("HTTP %i becomes a short, safe message", async (status, message) => {
    fetchMock.mockResolvedValueOnce(json(status, { error: "boom", stack: "at secret.ts:1", key: KEY }));

    const result = await call("get_order", { order_id: "SO-24042" });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(message);
    expect(textOf(result)).not.toContain("boom");
    expect(textOf(result)).not.toContain("secret.ts");
  });

  it("uses the right noun per tool in not-found messages", async () => {
    fetchMock.mockResolvedValue(json(404, { error: "not_found" }));
    expect(textOf(await call("get_invoice", { invoice_id: "INV-1" }))).toBe("Not found: no invoice with ID INV-1.");
    expect(textOf(await call("list_customer_orders", { customer_id: "CUST-1" }))).toBe(
      "Not found: no customer with ID CUST-1.",
    );
  });

  it("network failures become 'Could not reach'", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("getaddrinfo ENOTFOUND erp.example.test"));
    const result = await call("get_shipment", { shipment_id: "SHP-1" });
    expect(textOf(result)).toMatch(/^Could not reach the ERP API/);
    expect(textOf(result)).not.toContain("ENOTFOUND");
  });

  it("timeouts become a timeout message", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    const result = await call("get_product_stock", { product_id: "PRD-1" });
    expect(textOf(result)).toMatch(/did not respond in time/);
  });
});

describe("API key never appears in output", () => {
  it("is absent from successful results, even if the API echoes it", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: "SO-1", note: `token ${KEY}` }));
    const result = await call("get_order", { order_id: "SO-1" });
    expect(result.isError).toBeFalsy();
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(textOf(result)).toContain("[redacted]");
  });

  it("is absent from every error result and from stderr logs", async () => {
    const responses: Array<() => Promise<Response>> = [
      async () => json(401, { key: KEY }),
      async () => json(404, { key: KEY }),
      async () => json(500, { key: KEY }),
      async () => {
        throw new Error(`Bearer ${KEY}`);
      },
      async () => new Response(`not json ${KEY}`, { status: 200 }),
    ];
    for (const respond of responses) {
      fetchMock.mockImplementationOnce(respond);
      const result = await call("get_order", { order_id: "SO-1" });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toContain(KEY);
    }
    const logged = vi.mocked(console.error).mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain(KEY);
  });

  it("is absent from the tool listing", async () => {
    expect(JSON.stringify(await client.listTools())).not.toContain(KEY);
  });
});
