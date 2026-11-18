/**
 * The MCP server and its five read-only tools. Each tool maps 1:1 onto a GET
 * endpoint of the ERP REST API v1; the ID patterns mirror docs/openapi.yaml so
 * malformed IDs are rejected before any request is made.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ErpApiError, type ErpClient, type ErpErrorKind } from "./erp-client";

export const SERVER_NAME = "kroonmolen-erp";
export const SERVER_VERSION = "1.0.0";

const idSchema = (prefix: string, example: string) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}-[0-9]{1,10}$`), `Must look like ${example} (${prefix}- followed by digits).`)
    .describe(`ID in the format ${prefix}-<digits>, e.g. ${example}. Uppercase prefix, no spaces.`);

export const ID_SCHEMAS = {
  order_id: idSchema("SO", "SO-24001"),
  customer_id: idSchema("CUST", "CUST-1001"),
  product_id: idSchema("PRD", "PRD-2001"),
  shipment_id: idSchema("SHP", "SHP-30001"),
  invoice_id: idSchema("INV", "INV-50001"),
} as const;

type IdArg = keyof typeof ID_SCHEMAS;

const UNITS = "Dates are YYYY-MM-DD (Europe/Amsterdam). Amounts are EUR, quantities are tonnes.";

interface ToolDef {
  name: string;
  title: string;
  arg: IdArg;
  /** Used in the "not found" message, e.g. "sales order". */
  noun: string;
  path: (id: string) => string;
  description: string;
}

export const TOOL_DEFS: readonly ToolDef[] = [
  {
    name: "get_order",
    title: "Get sales order",
    arg: "order_id",
    noun: "sales order",
    path: (id) => `/api/v1/orders/${encodeURIComponent(id)}`,
    description:
      "Look up one sales order by its ID (SO-<digits>, e.g. SO-24001). Returns customer_id, status, " +
      "order and requested delivery dates, is_late, totals, the order lines with products, and the " +
      "order's shipments and invoices. Use this for any question about a specific order, or to find the " +
      "shipments and invoices that belong to an order. To find a customer's orders, call " +
      `list_customer_orders first. ${UNITS}`,
  },
  {
    name: "list_customer_orders",
    title: "List a customer's orders",
    arg: "customer_id",
    noun: "customer",
    path: (id) => `/api/v1/customers/${encodeURIComponent(id)}/orders`,
    description:
      "List all sales orders of one customer by customer ID (CUST-<digits>, e.g. CUST-1001), newest " +
      "first. Each entry has id, status, dates, is_late, tonnes and amount excl. VAT, but no lines, " +
      "shipments or invoices: call get_order with an order ID for those. An existing customer without " +
      `orders returns an empty list. Customers cannot be searched by name. ${UNITS}`,
  },
  {
    name: "get_product_stock",
    title: "Get product stock",
    arg: "product_id",
    noun: "product",
    path: (id) => `/api/v1/products/${encodeURIComponent(id)}/stock`,
    description:
      "Get the current stock of one product by product ID / SKU (PRD-<digits>, e.g. PRD-2001): name, " +
      "active flag, total tonnes, overall stock_status (in_stock, low, out_of_stock) and, per warehouse, " +
      "quantity, reorder level and status. Use for availability, low-stock or reorder questions. " +
      UNITS,
  },
  {
    name: "get_shipment",
    title: "Get shipment",
    arg: "shipment_id",
    noun: "shipment",
    path: (id) => `/api/v1/shipments/${encodeURIComponent(id)}`,
    description:
      "Look up one shipment by ID (SHP-<digits>, e.g. SHP-30001): order_id, status (planned, loaded, " +
      "in_transit, delivered, delayed), carrier, tonnes, planned and actual date, and delay_reason. Use " +
      "for delivery or delay questions about a known shipment. To find the shipments of an order, use " +
      `get_order. ${UNITS}`,
  },
  {
    name: "get_invoice",
    title: "Get invoice",
    arg: "invoice_id",
    noun: "invoice",
    path: (id) => `/api/v1/invoices/${encodeURIComponent(id)}`,
    description:
      "Look up one invoice by ID (INV-<digits>, e.g. INV-50001): order and customer, amounts excl. and " +
      "incl. VAT, VAT rate, invoice/due/paid dates, status (open, paid, overdue; overdue is derived from " +
      "the due date as of today) and days_overdue. Use for payment questions. To find the invoices of an " +
      `order, use get_order. ${UNITS}`,
  },
];

export function errorMessage(kind: ErpErrorKind, noun: string, id: string): string {
  switch (kind) {
    case "not_found":
      return `Not found: no ${noun} with ID ${id}.`;
    case "unauthorized":
      return "Unauthorized: the ERP API rejected the API key. Check ERP_API_KEY.";
    case "server_error":
      return "ERP server error. Try again later.";
    case "timeout":
      return "The ERP API did not respond in time. Try again later.";
    case "unreachable":
      return "Could not reach the ERP API. Check ERP_API_BASE_URL and the network connection.";
    case "unexpected":
      return "Unexpected response from the ERP API.";
  }
}

const errorResult = (text: string): CallToolResult => ({ isError: true, content: [{ type: "text", text }] });

export function createServer(client: ErpClient): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Read-only access to the Kroonmolen ERP (sales orders, customers, product stock, shipments, " +
        "invoices). All lookups are by ID: SO- orders, CUST- customers, PRD- products, SHP- shipments, " +
        "INV- invoices. Start from list_customer_orders or get_order and follow the IDs they return.",
    },
  );

  for (const def of TOOL_DEFS) {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: { [def.arg]: ID_SCHEMAS[def.arg] },
        annotations: {
          title: def.title,
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const id = String(args[def.arg]);
        try {
          const data = await client.get(def.path(id));
          return { content: [{ type: "text", text: client.redact(JSON.stringify(data, null, 2)) }] };
        } catch (err) {
          const kind: ErpErrorKind = err instanceof ErpApiError ? err.kind : "unexpected";
          // stderr only (stdout carries the MCP protocol); log the kind, never messages or headers.
          console.error(`[${SERVER_NAME}] ${def.name} failed: ${kind}`);
          return errorResult(errorMessage(kind, def.noun, id));
        }
      },
    );
  }

  return server;
}
