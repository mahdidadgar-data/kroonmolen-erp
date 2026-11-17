// Read-only REST API v1 for external agents. Server-only: uses the service-role client.
//
// Request flow (handleApiRequest): API key -> method (GET only) -> ID format -> query.
// Every query selects explicit columns and every response is built field by field,
// so new or internal columns never leak. Unknown and malformed IDs get the same 404.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  daysBetween,
  effectiveInvoiceStatus,
  isOrderLate,
  orderTotals,
  stockStatus,
  todayISO,
  type StockStatus,
} from "@/lib/erp-rules";
import { checkApiKey, jsonResponse, methodNotAllowed, notFound, serverError } from "./http.server";

export type Endpoint =
  "order" | "customerOrders" | "productStock" | "shipment" | "invoice" | "unknown";

// Upper bound on digits keeps junk out of the database query.
export const ID_PATTERNS = {
  order: /^SO-\d{1,10}$/,
  customer: /^CUST-\d{1,10}$/,
  product: /^PRD-\d{1,10}$/,
  shipment: /^SHP-\d{1,10}$/,
  invoice: /^INV-\d{1,10}$/,
} as const;

type Params = Record<string, string | undefined>;

export async function handleApiRequest(
  request: Request,
  endpoint: Endpoint,
  params: Params,
): Promise<Response> {
  try {
    const authError = await checkApiKey(request);
    if (authError) return authError;
    if (endpoint === "unknown") return notFound();
    if (request.method !== "GET") return methodNotAllowed();

    const today = todayISO();
    let body: unknown;
    switch (endpoint) {
      case "order":
        body = await getOrder(validId(params["orderId"], ID_PATTERNS.order), today);
        break;
      case "customerOrders":
        body = await getCustomerOrders(validId(params["customerId"], ID_PATTERNS.customer), today);
        break;
      case "productStock":
        body = await getProductStock(validId(params["productId"], ID_PATTERNS.product));
        break;
      case "shipment":
        body = await getShipment(validId(params["shipmentId"], ID_PATTERNS.shipment));
        break;
      case "invoice":
        body = await getInvoice(validId(params["invoiceId"], ID_PATTERNS.invoice), today);
        break;
    }
    return body ? jsonResponse(200, body) : notFound();
  } catch (error) {
    // Log server-side only; the client gets a fixed body without details.
    console.error("[api/v1] request failed:", error);
    return serverError();
  }
}

function validId(value: string | undefined, pattern: RegExp): string | null {
  return value && pattern.test(value) ? value : null;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const round = (n: number, decimals: number) => Number(n.toFixed(decimals));
const num = (v: number | string) => Number(v);
const numOrNull = (v: number | string | null) => (v === null ? null : Number(v));

// ---------- Orders ----------

export async function getOrder(id: string | null, today: string) {
  if (!id) return null;
  const db = supabaseAdmin;
  const [orderRes, linesRes, shipmentsRes, invoicesRes] = await Promise.all([
    db
      .from("sales_orders")
      .select("id, customer_id, status, order_date, requested_delivery_date")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("sales_order_lines")
      .select("line_no, product_sku, quantity_tonnes, unit_price, line_total, products(name)")
      .eq("order_id", id)
      .order("line_no"),
    db
      .from("shipments")
      .select(
        "id, order_id, status, carrier, quantity_tonnes, planned_date, actual_date, delay_reason",
      )
      .eq("order_id", id)
      .order("id"),
    db
      .from("invoices")
      .select(
        "id, order_id, customer_id, status, amount_excl_vat, vat_rate, amount_incl_vat, invoice_date, due_date, paid_date",
      )
      .eq("order_id", id)
      .order("id"),
  ]);
  const order = check(orderRes);
  if (!order) return null;
  const lines = check(linesRes) ?? [];
  const totals = orderTotals(lines);

  return {
    id: order.id,
    customer_id: order.customer_id,
    status: order.status,
    order_date: order.order_date,
    requested_delivery_date: order.requested_delivery_date,
    is_late: isOrderLate(order, today),
    totals: { quantity_tonnes: round(totals.tonnes, 1), amount_excl_vat: round(totals.amount, 2) },
    lines: lines.map((l) => ({
      line_no: l.line_no,
      product_id: l.product_sku,
      product_name: l.products?.name ?? null,
      quantity_tonnes: num(l.quantity_tonnes),
      unit_price: num(l.unit_price),
      line_total: numOrNull(l.line_total),
    })),
    shipments: (check(shipmentsRes) ?? []).map(mapShipment),
    invoices: (check(invoicesRes) ?? []).map((inv) => mapInvoice(inv, today)),
  };
}

export async function getCustomerOrders(id: string | null, today: string) {
  if (!id) return null;
  const db = supabaseAdmin;
  const [customerRes, ordersRes] = await Promise.all([
    db.from("customers").select("id").eq("id", id).maybeSingle(),
    db
      .from("sales_orders")
      .select(
        "id, status, order_date, requested_delivery_date, sales_order_lines(quantity_tonnes, line_total)",
      )
      .eq("customer_id", id)
      .order("id", { ascending: false }),
  ]);
  const customer = check(customerRes);
  if (!customer) return null;

  return {
    customer_id: customer.id,
    orders: (check(ordersRes) ?? []).map((o) => {
      const t = orderTotals(o.sales_order_lines ?? []);
      return {
        id: o.id,
        status: o.status,
        order_date: o.order_date,
        requested_delivery_date: o.requested_delivery_date,
        is_late: isOrderLate(o, today),
        quantity_tonnes: round(t.tonnes, 1),
        amount_excl_vat: round(t.amount, 2),
      };
    }),
  };
}

// ---------- Products / stock ----------

export async function getProductStock(id: string | null) {
  if (!id) return null;
  const db = supabaseAdmin;
  const [productRes, stockRes] = await Promise.all([
    db.from("products").select("sku, name, active").eq("sku", id).maybeSingle(),
    db
      .from("inventory")
      .select("warehouse_id, quantity_tonnes, reorder_level_tonnes, warehouses(name)")
      .eq("product_sku", id)
      .order("warehouse_id"),
  ]);
  const product = check(productRes);
  if (!product) return null;

  const warehouses = (check(stockRes) ?? []).map((row) => {
    const quantity = num(row.quantity_tonnes);
    const reorder = num(row.reorder_level_tonnes);
    return {
      warehouse_id: row.warehouse_id,
      warehouse_name: row.warehouses?.name ?? null,
      quantity_tonnes: quantity,
      reorder_level_tonnes: reorder,
      stock_status: stockStatus(quantity, reorder) as StockStatus,
    };
  });
  const totalQty = round(
    warehouses.reduce((s, w) => s + w.quantity_tonnes, 0),
    1,
  );
  const totalReorder = warehouses.reduce((s, w) => s + w.reorder_level_tonnes, 0);

  return {
    product_id: product.sku,
    name: product.name,
    active: product.active,
    total_quantity_tonnes: totalQty,
    // Overall status: the same rule applied to the totals across all warehouses.
    stock_status: stockStatus(totalQty, totalReorder),
    warehouses,
  };
}

// ---------- Shipments ----------

type ShipmentCols = {
  id: string;
  order_id: string;
  status: string;
  carrier: string;
  quantity_tonnes: number;
  planned_date: string;
  actual_date: string | null;
  delay_reason: string | null;
};

function mapShipment(s: ShipmentCols) {
  return {
    id: s.id,
    order_id: s.order_id,
    status: s.status,
    carrier: s.carrier,
    quantity_tonnes: num(s.quantity_tonnes),
    planned_date: s.planned_date,
    actual_date: s.actual_date,
    delay_reason: s.delay_reason,
  };
}

export async function getShipment(id: string | null) {
  if (!id) return null;
  const shipment = check(
    await supabaseAdmin
      .from("shipments")
      .select(
        "id, order_id, status, carrier, quantity_tonnes, planned_date, actual_date, delay_reason",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  return shipment ? mapShipment(shipment) : null;
}

// ---------- Invoices ----------

type InvoiceCols = {
  id: string;
  order_id: string;
  customer_id: string;
  status: string;
  amount_excl_vat: number;
  vat_rate: number;
  amount_incl_vat: number;
  invoice_date: string;
  due_date: string;
  paid_date: string | null;
};

function mapInvoice(inv: InvoiceCols, today: string) {
  // Overdue is derived from the due date at read time, never taken from the stored status.
  const status = effectiveInvoiceStatus(inv, today);
  return {
    id: inv.id,
    order_id: inv.order_id,
    customer_id: inv.customer_id,
    status,
    amount_excl_vat: num(inv.amount_excl_vat),
    vat_rate: num(inv.vat_rate),
    amount_incl_vat: num(inv.amount_incl_vat),
    invoice_date: inv.invoice_date,
    due_date: inv.due_date,
    paid_date: inv.paid_date,
    days_overdue: status === "overdue" ? daysBetween(inv.due_date, today) : 0,
  };
}

export async function getInvoice(id: string | null, today: string) {
  if (!id) return null;
  const invoice = check(
    await supabaseAdmin
      .from("invoices")
      .select(
        "id, order_id, customer_id, status, amount_excl_vat, vat_rate, amount_incl_vat, invoice_date, due_date, paid_date",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  return invoice ? mapInvoice(invoice, today) : null;
}
