/**
 * Smoke test against the live API: starts the real server over stdio and calls
 * each tool once. Prints only the tool name and ok/error, never data or the key.
 *
 *   bun run smoke      (needs ERP_API_BASE_URL and ERP_API_KEY in the environment)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const CALLS: Array<[tool: string, args: Record<string, string>]> = [
  ["get_order", { order_id: "SO-24042" }],
  ["list_customer_orders", { customer_id: "CUST-1006" }],
  ["get_product_stock", { product_id: "PRD-2008" }],
  ["get_shipment", { shipment_id: "SHP-30042" }],
  ["get_invoice", { invoice_id: "INV-50039" }],
];

const missing = ["ERP_API_BASE_URL", "ERP_API_KEY"].filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`smoke: ${missing.join(" and ")} not set`);
  process.exit(1);
}

const env: Record<string, string> = { ...getDefaultEnvironment() };
for (const name of ["ERP_API_BASE_URL", "ERP_API_KEY", "ERP_API_TIMEOUT_MS"]) {
  const value = process.env[name];
  if (value) env[name] = value;
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
  env,
  stderr: "ignore", // the server's own log lines are not part of the smoke output
});
const client = new Client({ name: "kroonmolen-erp-smoke", version: "1.0.0" });

let failures = 0;
try {
  await client.connect(transport);
  for (const [tool, args] of CALLS) {
    let ok = false;
    try {
      const result = await client.callTool({ name: tool, arguments: args });
      ok = result.isError !== true;
    } catch {
      ok = false;
    }
    if (!ok) failures++;
    console.log(`${tool.padEnd(22)} ${ok ? "ok" : "error"}`);
  }
} catch {
  console.log("server                 error");
  failures++;
} finally {
  await client.close().catch(() => {});
}

process.exit(failures === 0 ? 0 : 1);
