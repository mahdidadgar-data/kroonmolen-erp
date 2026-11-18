/**
 * Entry point: `bun src/index.ts`. Speaks MCP over stdio, so all diagnostics
 * go to stderr; stdout is reserved for the protocol.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigError, loadConfig } from "./config";
import { createErpClient } from "./erp-client";
import { createServer, SERVER_NAME } from "./tools";

async function main() {
  const config = loadConfig(process.env);
  const server = createServer(createErpClient(config));
  await server.connect(new StdioServerTransport());
  console.error(`[${SERVER_NAME}] ready (stdio)`);
}

main().catch((err: unknown) => {
  const message = err instanceof ConfigError ? err.message : "failed to start";
  console.error(`[${SERVER_NAME}] ${message}`);
  process.exit(1);
});
