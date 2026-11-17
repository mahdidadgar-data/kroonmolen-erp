import type { BadgeProps } from "@/components/ui/badge";

type Tone = NonNullable<BadgeProps["variant"]>;
type StatusDef = { label: string; tone: Tone };

export const ORDER_STATUS: Record<string, StatusDef> = {
  confirmed: { label: "Confirmed", tone: "info" },
  in_production: { label: "In production", tone: "progress" },
  ready_to_ship: { label: "Ready to ship", tone: "success" },
  partially_shipped: { label: "Partially shipped", tone: "warning" },
  shipped: { label: "Shipped", tone: "progress" },
  delivered: { label: "Delivered", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const SHIPMENT_STATUS: Record<string, StatusDef> = {
  planned: { label: "Planned", tone: "info" },
  loaded: { label: "Loaded", tone: "progress" },
  in_transit: { label: "In transit", tone: "success" },
  delivered: { label: "Delivered", tone: "neutral" },
  delayed: { label: "Delayed", tone: "danger" },
};

export const INVOICE_STATUS: Record<string, StatusDef> = {
  open: { label: "Open", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
};

export const STOCK_STATUS: Record<string, StatusDef> = {
  in_stock: { label: "In stock", tone: "success" },
  low: { label: "Low", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
};

export const CUSTOMER_TYPE: Record<string, string> = { farm: "Farm", dealer: "Dealer" };
export const COUNTRY: Record<string, string> = { NL: "Netherlands", BE: "Belgium" };
export const SPECIES: Record<string, string> = {
  dairy: "Dairy",
  beef: "Beef",
  broiler: "Broiler",
  layer: "Layer",
  pig: "Pig",
};
export const FORM: Record<string, string> = { pellet: "Pellet", mash: "Mash", crumble: "Crumble" };
export const PACKAGING: Record<string, string> = {
  bag_25kg: "25 kg bag",
  big_bag: "Big bag",
  bulk: "Bulk",
};

export const ORDER_STATUS_FLOW = [
  "confirmed",
  "in_production",
  "ready_to_ship",
  "partially_shipped",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export function toOptions(map: Record<string, string | StatusDef>) {
  return Object.entries(map).map(([value, v]) => ({
    value,
    label: typeof v === "string" ? v : v.label,
  }));
}
