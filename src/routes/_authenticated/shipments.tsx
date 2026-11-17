import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable, type Column, type FilterDef } from "@/components/erp/data-table";
import { PageHeader } from "@/components/erp/page-header";
import { NoRecords, RouteError, pageHead } from "@/components/erp/route-states";
import { StatusBadge } from "@/components/erp/status-badge";
import { shipmentsQuery, type ShipmentRow } from "@/lib/queries";
import { listSearch } from "@/lib/list-search";
import { SHIPMENT_STATUS, toOptions } from "@/lib/status";
import { formatDate, formatTonnes } from "@/lib/format";
import { isShippingToday, todayISO } from "@/lib/erp-rules";

export const Route = createFileRoute("/_authenticated/shipments")({
  validateSearch: listSearch("status", "carrier", "when"),
  loader: ({ context }) => context.queryClient.ensureQueryData(shipmentsQuery),
  head: () => pageHead("Shipments", "Planned and executed feed deliveries, carriers and delays."),
  component: ShipmentsPage,
  errorComponent: RouteError,
  notFoundComponent: NoRecords,
});

const columns: Column<ShipmentRow>[] = [
  { key: "id", header: "Shipment no.", cell: (r) => <span className="font-id text-primary">{r.id}</span>, sortValue: (r) => r.id },
  {
    key: "order",
    header: "Order",
    cell: (r) => (
      <Link
        to="/orders/$orderId"
        params={{ orderId: r.order_id }}
        onClick={(e) => e.stopPropagation()}
        className="font-id text-primary hover:underline"
      >
        {r.order_id}
      </Link>
    ),
    sortValue: (r) => r.order_id,
  },
  { key: "customer", header: "Customer", cell: (r) => r.sales_orders?.customers?.name, sortValue: (r) => r.sales_orders?.customers?.name },
  { key: "carrier", header: "Carrier", cell: (r) => r.carrier, sortValue: (r) => r.carrier },
  { key: "qty", header: "Quantity", cell: (r) => formatTonnes(Number(r.quantity_tonnes)), sortValue: (r) => Number(r.quantity_tonnes), align: "right" },
  { key: "planned", header: "Planned", cell: (r) => formatDate(r.planned_date), sortValue: (r) => r.planned_date },
  { key: "actual", header: "Actual", cell: (r) => formatDate(r.actual_date), sortValue: (r) => r.actual_date },
  { key: "status", header: "Status", cell: (r) => <StatusBadge kind="shipment" status={r.status} />, sortValue: (r) => r.status },
  {
    key: "reason",
    header: "Delay reason",
    cell: (r) => <span className="block max-w-72 truncate text-muted-foreground" title={r.delay_reason ?? ""}>{r.delay_reason ?? "—"}</span>,
    sortValue: (r) => r.delay_reason,
  },
];

function ShipmentsPage() {
  const { data } = useSuspenseQuery(shipmentsQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const today = todayISO();
  const carriers = [...new Set(data.map((s) => s.carrier))].sort();

  const filters: FilterDef<ShipmentRow, "status" | "carrier" | "when">[] = [
    { key: "status", label: "Status", options: toOptions(SHIPMENT_STATUS), match: (r, v) => r.status === v },
    { key: "carrier", label: "Carrier", options: carriers.map((c) => ({ value: c, label: c })), match: (r, v) => r.carrier === v },
    {
      key: "when",
      label: "Date",
      options: [
        { value: "today", label: "Shipping today" },
        { value: "upcoming", label: "Upcoming" },
      ],
      match: (r, v) => (v === "today" ? isShippingToday(r, today) : r.planned_date >= today && r.status !== "delivered"),
    },
  ];

  const delayed = data.filter((s) => s.status === "delayed").length;
  const shippingToday = data.filter((s) => isShippingToday(s, today)).length;

  return (
    <>
      <PageHeader title="Shipments" description={`${shippingToday} leaving today · ${delayed} delayed`} />
      <DataTable
        rows={data}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.id} ${r.order_id} ${r.carrier} ${r.sales_orders?.customers?.name ?? ""}`}
        searchPlaceholder="Search shipment, order, carrier…"
        filters={filters}
        state={search}
        onStateChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
        onRowClick={(r) => navigate({ to: "/orders/$orderId", params: { orderId: r.order_id } })}
        defaultSort={{ key: "planned", dir: "desc" }}
      />
    </>
  );
}
