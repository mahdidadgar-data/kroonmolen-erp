import { describe, expect, it } from "vitest";
import {
  effectiveInvoiceStatus,
  isOrderLate,
  isOrderOpen,
  isShippingToday,
  orderTotals,
  stockStatus,
  weekStart,
} from "@/lib/erp-rules";

const today = "2026-11-17";

describe("invoice status", () => {
  it("an unpaid invoice past its due date is overdue", () => {
    expect(effectiveInvoiceStatus({ status: "open", due_date: "2026-11-16" }, today)).toBe("overdue");
  });
  it("an unpaid invoice due today is still open", () => {
    expect(effectiveInvoiceStatus({ status: "open", due_date: today }, today)).toBe("open");
  });
  it("a paid invoice stays paid even after the due date", () => {
    expect(effectiveInvoiceStatus({ status: "paid", due_date: "2026-10-01" }, today)).toBe("paid");
  });
});

describe("orders", () => {
  it("delivered and cancelled orders are not open", () => {
    expect(isOrderOpen("delivered")).toBe(false);
    expect(isOrderOpen("cancelled")).toBe(false);
    expect(isOrderOpen("partially_shipped")).toBe(true);
  });
  it("an order in production past its requested delivery date is late", () => {
    expect(isOrderLate({ status: "in_production", requested_delivery_date: "2026-11-14" }, today)).toBe(true);
    expect(isOrderLate({ status: "shipped", requested_delivery_date: "2026-11-14" }, today)).toBe(false);
  });
});

describe("shipments", () => {
  it("only planned or loaded shipments for today count as shipping today", () => {
    expect(isShippingToday({ planned_date: today, status: "loaded" }, today)).toBe(true);
    expect(isShippingToday({ planned_date: today, status: "delayed" }, today)).toBe(false);
    expect(isShippingToday({ planned_date: "2026-11-18", status: "planned" }, today)).toBe(false);
  });
});

describe("stock status", () => {
  it("zero is out of stock, at or below reorder level is low", () => {
    expect(stockStatus(0, 20)).toBe("out_of_stock");
    expect(stockStatus(20, 20)).toBe("low");
    expect(stockStatus(21, 20)).toBe("in_stock");
  });
});

describe("weeks", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-17")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
  });
});

describe("order totals", () => {
  it("sums tonnes and line totals, treating a missing line total as 0", () => {
    expect(
      orderTotals([
        { quantity_tonnes: 10, line_total: 3000 },
        { quantity_tonnes: 2.5, line_total: null },
      ]),
    ).toEqual({ tonnes: 12.5, amount: 3000 });
  });
  it("an order without lines totals zero", () => {
    expect(orderTotals([])).toEqual({ tonnes: 0, amount: 0 });
  });
});
