// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------- In-memory stand-in for the service-role Supabase client ----------
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };
interface FakeQuery extends PromiseLike<Result> {
  select(columns: string): FakeQuery;
  eq(column: string, value: unknown): FakeQuery;
  order(column: string, opts?: unknown): FakeQuery;
  maybeSingle(): FakeQuery;
}

const db = vi.hoisted(() => {
  const state = {
    tables: {} as Record<string, Row[]>,
    selects: [] as { table: string; columns: string }[],
    fail: false,
  };
  function from(table: string): FakeQuery {
    let rows = [...(state.tables[table] ?? [])];
    let single = false;
    const q: FakeQuery = {
      select(columns) {
        state.selects.push({ table, columns });
        return q;
      },
      eq(column, value) {
        rows = rows.filter((r) => r[column] === value);
        return q;
      },
      order() {
        return q;
      },
      maybeSingle() {
        single = true;
        return q;
      },
      then(onFulfilled, onRejected) {
        const res: Result = state.fail
          ? { data: null, error: { message: "boom: relation secret_table does not exist" } }
          : { data: single ? (rows[0] ?? null) : rows, error: null };
        return Promise.resolve(res).then(onFulfilled, onRejected);
      },
    };
    return q;
  }
  return { state, from };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => db.from(table) },
}));

import { handleApiRequest, type Endpoint } from "@/lib/api/v1.server";
import { Route as OrderRoute } from "@/routes/api/v1/orders.$orderId";
import { Route as CustomerOrdersRoute } from "@/routes/api/v1/customers.$customerId.orders";
import { Route as ProductStockRoute } from "@/routes/api/v1/products.$productId.stock";
import { Route as ShipmentRoute } from "@/routes/api/v1/shipments.$shipmentId";
import { Route as InvoiceRoute } from "@/routes/api/v1/invoices.$invoiceId";
import { Route as CatchAllRoute } from "@/routes/api/v1/$";

// ---------- Fixtures (include internal columns that must never be returned) ----------
const KEY = "test-api-key-0123456789";
const TODAY = "2026-11-17";

function seed() {
  db.state.fail = false;
  db.state.selects = [];
  db.state.tables = {
    customers: [
      {
        id: "CUST-1001",
        name: "Boerderij De Linde",
        credit_limit: 50000,
        contact_email: "x@example.com",
        created_at: "2026-01-01",
      },
      {
        id: "CUST-1002",
        name: "No Orders BV",
        credit_limit: 1000,
        contact_email: null,
        created_at: "2026-01-01",
      },
    ],
    sales_orders: [
      {
        id: "SO-24001",
        customer_id: "CUST-1001",
        status: "in_production",
        order_date: "2026-11-01",
        requested_delivery_date: "2026-11-10",
        warehouse_id: "WH-1",
        notes: "internal: call before delivery",
        created_at: "2026-11-01T08:00:00Z",
        updated_at: "2026-11-02T08:00:00Z",
        sales_order_lines: [
          { quantity_tonnes: 10.1, line_total: 3030.1 },
          { quantity_tonnes: 5.2, line_total: 1560.2 },
        ],
      },
      {
        id: "SO-24002",
        customer_id: "CUST-1001",
        status: "delivered",
        order_date: "2026-10-01",
        requested_delivery_date: "2026-10-10",
        warehouse_id: "WH-1",
        notes: null,
        created_at: "2026-10-01T08:00:00Z",
        updated_at: "2026-10-12T08:00:00Z",
        sales_order_lines: [{ quantity_tonnes: 3, line_total: 900 }],
      },
    ],
    sales_order_lines: [
      {
        id: "SO-24001-1",
        order_id: "SO-24001",
        line_no: 1,
        product_sku: "PRD-2001",
        quantity_tonnes: 10.1,
        unit_price: 300,
        line_total: 3030.1,
        products: { name: "Dairy Pellet 18" },
      },
      {
        id: "SO-24001-2",
        order_id: "SO-24001",
        line_no: 2,
        product_sku: "PRD-2002",
        quantity_tonnes: 5.2,
        unit_price: 300.04,
        line_total: 1560.2,
        products: { name: "Beef Mash" },
      },
    ],
    shipments: [
      {
        id: "SHP-30001",
        order_id: "SO-24001",
        status: "delayed",
        carrier: "Van Dijk Transport",
        quantity_tonnes: 10.1,
        planned_date: "2026-11-12",
        actual_date: null,
        delay_reason: "Truck breakdown",
        created_at: "2026-11-01",
      },
    ],
    invoices: [
      // Stored as "open" but past due: the API must report it as overdue.
      {
        id: "INV-50001",
        order_id: "SO-24001",
        customer_id: "CUST-1001",
        status: "open",
        amount_excl_vat: 4590.3,
        vat_rate: 9,
        amount_incl_vat: 5003.43,
        invoice_date: "2026-10-01",
        due_date: "2026-11-07",
        paid_date: null,
        created_at: "2026-10-01",
      },
      {
        id: "INV-50002",
        order_id: "SO-24002",
        customer_id: "CUST-1001",
        status: "paid",
        amount_excl_vat: 900,
        vat_rate: 9,
        amount_incl_vat: 981,
        invoice_date: "2026-09-01",
        due_date: "2026-10-01",
        paid_date: "2026-09-20",
        created_at: "2026-09-01",
      },
    ],
    products: [
      {
        sku: "PRD-2001",
        name: "Dairy Pellet 18",
        active: true,
        unit_price_per_tonne: 300,
        species: "dairy",
        created_at: "2026-01-01",
      },
    ],
    inventory: [
      {
        product_sku: "PRD-2001",
        warehouse_id: "WH-1",
        quantity_tonnes: 40,
        reorder_level_tonnes: 20,
        stock_status: "in_stock",
        updated_at: "2026-11-01",
        warehouses: { name: "Mill Veghel" },
      },
      {
        product_sku: "PRD-2001",
        warehouse_id: "WH-2",
        quantity_tonnes: 5,
        reorder_level_tonnes: 10,
        stock_status: "low",
        updated_at: "2026-11-01",
        warehouses: { name: "Depot Gent" },
      },
    ],
  };
}

function req(method = "GET", authorization: string | null = `Bearer ${KEY}`) {
  const headers = new Headers();
  if (authorization !== null) headers.set("authorization", authorization);
  return new Request("https://erp.example.test/api/v1/x", { method, headers });
}

const call = (endpoint: Endpoint, params: Record<string, string>, request = req()) =>
  handleApiRequest(request, endpoint, params);

const keys = (o: unknown) => Object.keys(o as object).sort();

const originalKey = process.env["ERP_API_KEY"];
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
});
afterAll(() => {
  vi.useRealTimers();
  if (originalKey === undefined) delete process.env["ERP_API_KEY"];
  else process.env["ERP_API_KEY"] = originalKey;
});
beforeEach(() => {
  process.env["ERP_API_KEY"] = KEY;
  seed();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- Auth ----------
describe("authentication", () => {
  it.each([
    ["missing header", null],
    ["wrong key", "Bearer not-the-key"],
    ["key prefix only", `Bearer ${KEY.slice(0, 10)}`],
    ["key plus extra", `Bearer ${KEY}x`],
    ["wrong scheme", `Basic ${KEY}`],
    ["bare key, no scheme", KEY],
    ["empty bearer", "Bearer "],
  ])("rejects %s with 401 and does not touch the database", async (_label, header) => {
    const res = await call("order", { orderId: "SO-24001" }, req("GET", header));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/);
    expect(db.state.selects).toHaveLength(0);
  });

  it("accepts the correct key (scheme is case-insensitive)", async () => {
    expect((await call("order", { orderId: "SO-24001" }, req("GET", `bearer ${KEY}`))).status).toBe(
      200,
    );
  });

  it("checks the key before the method, so unauthenticated callers learn nothing", async () => {
    const res = await call("order", { orderId: "SO-24001" }, req("DELETE", null));
    expect(res.status).toBe(401);
  });

  it("refuses everything when ERP_API_KEY is not configured", async () => {
    delete process.env["ERP_API_KEY"];
    const res = await call("order", { orderId: "SO-24001" }, req("GET", "Bearer "));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_error" });
    expect(db.state.selects).toHaveLength(0);
  });
});

// ---------- 404 ----------
describe("not found", () => {
  const NOT_FOUND = JSON.stringify({ error: "not_found" });

  it.each([
    ["order", "orderId", "SO-99999"],
    ["customerOrders", "customerId", "CUST-9999"],
    ["productStock", "productId", "PRD-9999"],
    ["shipment", "shipmentId", "SHP-99999"],
    ["invoice", "invoiceId", "INV-99999"],
  ] as const)("unknown %s id returns 404 {error:not_found}", async (endpoint, param, id) => {
    const res = await call(endpoint, { [param]: id });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(NOT_FOUND);
  });

  it.each([
    "24001",
    "so-24001",
    "SO-",
    "SO-24001-1",
    "SO-abc",
    "CUST-1001",
    "SO-24001' OR '1'='1",
    "SO-24001%00",
    `SO-${"9".repeat(50)}`,
    "",
  ])("malformed order id %j gets the identical 404 without querying", async (id) => {
    const unknown = await call("order", { orderId: "SO-99999" });
    db.state.selects = [];
    const malformed = await call("order", { orderId: id });
    expect(malformed.status).toBe(404);
    expect(await malformed.text()).toBe(await unknown.text());
    expect([...malformed.headers]).toEqual([...unknown.headers]);
    expect(db.state.selects).toHaveLength(0);
  });

  it.each([
    ["customerOrders", "customerId", "SO-24001"],
    ["productStock", "productId", "2001"],
    ["shipment", "shipmentId", "INV-50001"],
    ["invoice", "invoiceId", "inv-50001"],
  ] as const)("malformed %s id returns 404", async (endpoint, param, id) => {
    const res = await call(endpoint, { [param]: id });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(NOT_FOUND);
  });

  it("unknown /api/v1 paths return the same JSON 404", async () => {
    const res = await call("unknown", { _splat: "orders" });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(NOT_FOUND);
  });
});

// ---------- 405 ----------
describe("read-only", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])(
    "%s returns 405 with Allow: GET and no database access",
    async (method) => {
      const res = await call("invoice", { invoiceId: "INV-50001" }, req(method));
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("GET");
      if (method !== "HEAD") expect(await res.json()).toEqual({ error: "method_not_allowed" });
      expect(db.state.selects).toHaveLength(0);
    },
  );

  // The runtime dispatches HEAD -> handlers.HEAD ?? GET, and other methods -> handlers[method] ?? ANY.
  // Every route must register GET, HEAD and ANY so non-GET methods reach the 405 check.
  const routes = [
    ["orders", OrderRoute, { orderId: "SO-24001" }],
    ["customer orders", CustomerOrdersRoute, { customerId: "CUST-1001" }],
    ["product stock", ProductStockRoute, { productId: "PRD-2001" }],
    ["shipments", ShipmentRoute, { shipmentId: "SHP-30001" }],
    ["invoices", InvoiceRoute, { invoiceId: "INV-50001" }],
  ] as const;

  type Handler = (ctx: { request: Request; params: Record<string, string> }) => Promise<Response>;
  const handlersOf = (route: unknown) =>
    (route as { options: { server: { handlers: Record<string, Handler> } } }).options.server
      .handlers;

  it.each(routes)(
    "%s route serves GET and sends HEAD/other methods to 405",
    async (_name, route, params) => {
      const h = handlersOf(route);
      expect(Object.keys(h).sort()).toEqual(["ANY", "GET", "HEAD"]);
      expect((await h["GET"]!({ request: req("GET"), params })).status).toBe(200);
      expect((await h["HEAD"]!({ request: req("HEAD"), params })).status).toBe(405);
      expect((await h["ANY"]!({ request: req("POST"), params })).status).toBe(405);
    },
  );

  it("catch-all route returns 404 for unknown paths", async () => {
    const h = handlersOf(CatchAllRoute);
    expect((await h["GET"]!({ request: req("GET"), params: { _splat: "nope" } })).status).toBe(404);
  });
});

// ---------- Response shapes ----------
describe("response shape", () => {
  it("GET order returns status, lines, shipments and invoices with explicit fields", async () => {
    const res = await call("order", { orderId: "SO-24001" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();

    expect(keys(body)).toEqual(
      [
        "customer_id",
        "id",
        "invoices",
        "is_late",
        "lines",
        "order_date",
        "requested_delivery_date",
        "shipments",
        "status",
        "totals",
      ].sort(),
    );
    expect(body).toMatchObject({
      id: "SO-24001",
      customer_id: "CUST-1001",
      status: "in_production",
      is_late: true, // requested 2026-11-10, not shipped, today 2026-11-17
      totals: { quantity_tonnes: 15.3, amount_excl_vat: 4590.3 },
    });
    expect(body.lines).toEqual([
      {
        line_no: 1,
        product_id: "PRD-2001",
        product_name: "Dairy Pellet 18",
        quantity_tonnes: 10.1,
        unit_price: 300,
        line_total: 3030.1,
      },
      {
        line_no: 2,
        product_id: "PRD-2002",
        product_name: "Beef Mash",
        quantity_tonnes: 5.2,
        unit_price: 300.04,
        line_total: 1560.2,
      },
    ]);
    expect(body.shipments).toHaveLength(1);
    expect(keys(body.shipments[0])).toEqual(
      [
        "actual_date",
        "carrier",
        "delay_reason",
        "id",
        "order_id",
        "planned_date",
        "quantity_tonnes",
        "status",
      ].sort(),
    );
    expect(Array.isArray(body.invoices)).toBe(true);
    expect(body.invoices[0]).toMatchObject({
      id: "INV-50001",
      status: "overdue",
      days_overdue: 10,
    });
    expect(JSON.stringify(body)).not.toMatch(
      /notes|created_at|updated_at|warehouse_id|"SO-24001-1"/,
    );
  });

  it("GET order with no invoices returns an empty array", async () => {
    db.state.tables["invoices"] = [];
    const body = await (await call("order", { orderId: "SO-24001" })).json();
    expect(body.invoices).toEqual([]);
  });

  it("GET customer orders lists order summaries, newest first", async () => {
    const body = await (await call("customerOrders", { customerId: "CUST-1001" })).json();
    expect(keys(body)).toEqual(["customer_id", "orders"]);
    expect(body.customer_id).toBe("CUST-1001");
    expect(body.orders).toHaveLength(2);
    expect(keys(body.orders[0])).toEqual(
      [
        "amount_excl_vat",
        "id",
        "is_late",
        "order_date",
        "quantity_tonnes",
        "requested_delivery_date",
        "status",
      ].sort(),
    );
    expect(body.orders.find((o: { id: string }) => o.id === "SO-24002")).toMatchObject({
      status: "delivered",
      is_late: false,
      quantity_tonnes: 3,
      amount_excl_vat: 900,
    });
    expect(JSON.stringify(body)).not.toMatch(/credit_limit|contact_email|notes/);
  });

  it("GET customer orders for a customer without orders returns an empty list, not 404", async () => {
    const res = await call("customerOrders", { customerId: "CUST-1002" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ customer_id: "CUST-1002", orders: [] });
  });

  it("GET product stock returns per-warehouse and overall stock status", async () => {
    const body = await (await call("productStock", { productId: "PRD-2001" })).json();
    expect(body).toEqual({
      product_id: "PRD-2001",
      name: "Dairy Pellet 18",
      active: true,
      total_quantity_tonnes: 45,
      stock_status: "in_stock", // 45 t total vs 30 t total reorder level
      warehouses: [
        {
          warehouse_id: "WH-1",
          warehouse_name: "Mill Veghel",
          quantity_tonnes: 40,
          reorder_level_tonnes: 20,
          stock_status: "in_stock",
        },
        {
          warehouse_id: "WH-2",
          warehouse_name: "Depot Gent",
          quantity_tonnes: 5,
          reorder_level_tonnes: 10,
          stock_status: "low",
        },
      ],
    });
  });

  it("GET product stock with no inventory rows reports out_of_stock", async () => {
    db.state.tables["inventory"] = [];
    const body = await (await call("productStock", { productId: "PRD-2001" })).json();
    expect(body).toMatchObject({
      total_quantity_tonnes: 0,
      stock_status: "out_of_stock",
      warehouses: [],
    });
  });

  it("GET shipment returns status, planned/actual date and delay reason", async () => {
    const body = await (await call("shipment", { shipmentId: "SHP-30001" })).json();
    expect(body).toEqual({
      id: "SHP-30001",
      order_id: "SO-24001",
      status: "delayed",
      carrier: "Van Dijk Transport",
      quantity_tonnes: 10.1,
      planned_date: "2026-11-12",
      actual_date: null,
      delay_reason: "Truck breakdown",
    });
  });

  it("GET invoice derives overdue from the due date, not the stored status", async () => {
    const body = await (await call("invoice", { invoiceId: "INV-50001" })).json();
    expect(body).toEqual({
      id: "INV-50001",
      order_id: "SO-24001",
      customer_id: "CUST-1001",
      status: "overdue",
      amount_excl_vat: 4590.3,
      vat_rate: 9,
      amount_incl_vat: 5003.43,
      invoice_date: "2026-10-01",
      due_date: "2026-11-07",
      paid_date: null,
      days_overdue: 10,
    });
  });

  it("GET invoice keeps a paid invoice paid even after the due date", async () => {
    const body = await (await call("invoice", { invoiceId: "INV-50002" })).json();
    expect(body).toMatchObject({ status: "paid", days_overdue: 0 });
  });

  it("never selects * (every query lists explicit columns)", async () => {
    await call("order", { orderId: "SO-24001" });
    await call("customerOrders", { customerId: "CUST-1001" });
    await call("productStock", { productId: "PRD-2001" });
    await call("shipment", { shipmentId: "SHP-30001" });
    await call("invoice", { invoiceId: "INV-50001" });
    expect(db.state.selects.length).toBeGreaterThan(0);
    for (const s of db.state.selects) expect(s.columns).not.toContain("*");
  });
});

// ---------- Errors ----------
describe("server errors", () => {
  it("database failures return a generic 500 without details", async () => {
    db.state.fail = true;
    const res = await call("order", { orderId: "SO-24001" });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe(JSON.stringify({ error: "server_error" }));
    expect(text).not.toMatch(/boom|secret_table|stack|at /);
  });
});
