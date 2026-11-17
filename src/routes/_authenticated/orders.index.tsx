import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";

import { DataTable, type Column, type FilterDef } from "@/components/erp/data-table";
import { PageHeader } from "@/components/erp/page-header";
import { NoRecords, RouteError, pageHead } from "@/components/erp/route-states";
import { StatusBadge } from "@/components/erp/status-badge";
import { ordersQuery, orderTotals, type OrderRow } from "@/lib/queries";
import { listSearch } from "@/lib/list-search";
import { ORDER_STATUS, toOptions } from "@/lib/status";
import { formatDate, formatEUR, formatTonnes } from "@/lib/format";
import { isOrderLate, isOrderOpen, todayISO } from "@/lib/erp-rules";

export const Route = createFileRoute("/_authenticated/orders/")({
  validateSearch: listSearch("status", "warehouse", "view"),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery),
  head: () => pageHead("Sales orders", "Customer sales orders with lines, delivery dates and status."),
  component: OrdersPage,
  errorComponent: RouteError,
  notFoundComponent: NoRecords,
});

type Row = OrderRow & { tonnes: number; amount: number; late: boolean };

const filters: FilterDef<Row, "status" | "warehouse" | "view">[] = [
  { key: "status", label: "Status", options: toOptions(ORDER_STATUS), match: (r, v) => r.status === v },
  {
    key: "warehouse",
    label: "Warehouse",
    options: [
      { value: "WH-ZWL", label: "Mill Zwolle" },
      { value: "WH-ANR", label: "Depot Antwerp" },
    ],
    match: (r, v) => r.warehouse_id === v,
  },
  {
    key: "view",
    label: "Show",
    options: [
      { value: "open", label: "Open orders" },
      { value: "late", label: "Late orders" },
    ],
    match: (r, v) => (v === "late" ? r.late : isOrderOpen(r.status)),
  },
];

const columns: Column<Row>[] = [
  { key: "id", header: "Order no.", cell: (r) => <span className="font-id text-primary">{r.id}</span>, sortValue: (r) => r.id },
  {
    key: "customer",
    header: "Customer",
    cell: (r) => (
      <span className="font-medium">
        {r.customers?.name} <span className="font-id text-xs text-muted-foreground">{r.customer_id}</span>
      </span>
    ),
    sortValue: (r) => r.customers?.name,
  },
  { key: "order_date", header: "Order date", cell: (r) => formatDate(r.order_date), sortValue: (r) => r.order_date },
  {
    key: "requested",
    header: "Requested delivery",
    cell: (r) => (
      <span className={r.late ? "inline-flex items-center gap-1 font-medium text-danger" : ""}>
        {r.late && <Clock className="size-3.5" />}
        {formatDate(r.requested_delivery_date)}
      </span>
    ),
    sortValue: (r) => r.requested_delivery_date,
  },
  { key: "warehouse", header: "From", cell: (r) => (r.warehouse_id === "WH-ZWL" ? "Zwolle" : "Antwerp"), sortValue: (r) => r.warehouse_id },
  { key: "tonnes", header: "Quantity", cell: (r) => formatTonnes(r.tonnes), sortValue: (r) => r.tonnes, align: "right" },
  { key: "amount", header: "Value excl. VAT", cell: (r) => formatEUR(r.amount), sortValue: (r) => r.amount, align: "right" },
  { key: "status", header: "Status", cell: (r) => <StatusBadge kind="order" status={r.status} />, sortValue: (r) => r.status },
];

function OrdersPage() {
  const { data } = useSuspenseQuery(ordersQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const today = todayISO();
  const rows: Row[] = data.map((o) => ({ ...o, ...orderTotals(o.sales_order_lines), late: isOrderLate(o, today) }));
  const open = rows.filter((r) => isOrderOpen(r.status)).length;

  return (
    <>
      <PageHeader title="Sales orders" description={`${rows.length} orders · ${open} open`} />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.id} ${r.customer_id} ${r.customers?.name ?? ""}`}
        searchPlaceholder="Search order, customer…"
        filters={filters}
        state={search}
        onStateChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
        onRowClick={(r) => navigate({ to: "/orders/$orderId", params: { orderId: r.id } })}
        defaultSort={{ key: "id", dir: "desc" }}
      />
    </>
  );
}
