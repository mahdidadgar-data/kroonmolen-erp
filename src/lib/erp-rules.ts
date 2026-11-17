// Business rules for Kroonmolen ERP. Pure functions so they can be unit tested.

export type OrderStatus =
  | "confirmed"
  | "in_production"
  | "ready_to_ship"
  | "partially_shipped"
  | "shipped"
  | "delivered"
  | "cancelled";
export type ShipmentStatus = "planned" | "loaded" | "in_transit" | "delivered" | "delayed";
export type InvoiceStatus = "open" | "paid" | "overdue";
export type StockStatus = "in_stock" | "low" | "out_of_stock";

/** Today's date (YYYY-MM-DD) in the company's time zone. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** An unpaid invoice past its due date is overdue, whatever the stored status says. */
export function effectiveInvoiceStatus(
  invoice: { status: string; due_date: string },
  today: string,
): InvoiceStatus {
  if (invoice.status === "paid") return "paid";
  return invoice.due_date < today ? "overdue" : "open";
}

/** Open orders are everything not yet delivered and not cancelled. */
export function isOrderOpen(status: string): boolean {
  return status !== "delivered" && status !== "cancelled";
}

/** Past the requested delivery date and not yet fully shipped/delivered/cancelled. */
export function isOrderLate(
  order: { status: string; requested_delivery_date: string },
  today: string,
): boolean {
  if (["shipped", "delivered", "cancelled"].includes(order.status)) return false;
  return order.requested_delivery_date < today;
}

/** A shipment leaves today when it is planned for today and still waiting at the mill. */
export function isShippingToday(
  shipment: { planned_date: string; status: string },
  today: string,
): boolean {
  return shipment.planned_date === today && (shipment.status === "planned" || shipment.status === "loaded");
}

/** Total tonnes and amount (excl. VAT) of an order's lines. */
export function orderTotals(lines: { quantity_tonnes: number; line_total: number | null }[]) {
  return lines.reduce(
    (acc, l) => ({
      tonnes: acc.tonnes + Number(l.quantity_tonnes),
      amount: acc.amount + Number(l.line_total ?? 0),
    }),
    { tonnes: 0, amount: 0 },
  );
}

export function stockStatus(quantity: number, reorderLevel: number): StockStatus {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= reorderLevel) return "low";
  return "in_stock";
}

/** Monday (YYYY-MM-DD) of the ISO week containing the date. */
export function weekStart(iso: string): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
