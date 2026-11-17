import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS, ORDER_STATUS, SHIPMENT_STATUS, STOCK_STATUS } from "@/lib/status";

const MAPS = {
  order: ORDER_STATUS,
  shipment: SHIPMENT_STATUS,
  invoice: INVOICE_STATUS,
  stock: STOCK_STATUS,
};

export function StatusBadge({ kind, status }: { kind: keyof typeof MAPS; status: string }) {
  const def = MAPS[kind][status] ?? { label: status, tone: "neutral" as const };
  return (
    <Badge variant={def.tone}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {def.label}
    </Badge>
  );
}
