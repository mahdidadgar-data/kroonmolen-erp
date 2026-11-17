import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable, type Column, type FilterDef } from "@/components/erp/data-table";
import { PageHeader } from "@/components/erp/page-header";
import { NoRecords, RouteError, pageHead } from "@/components/erp/route-states";
import { StatusBadge } from "@/components/erp/status-badge";
import { invoicesQuery, type InvoiceRow } from "@/lib/queries";
import { listSearch } from "@/lib/list-search";
import { INVOICE_STATUS, toOptions } from "@/lib/status";
import { formatDate, formatEUR, formatEUR0 } from "@/lib/format";
import { daysBetween, effectiveInvoiceStatus, todayISO } from "@/lib/erp-rules";

export const Route = createFileRoute("/_authenticated/invoices")({
  validateSearch: listSearch("status"),
  loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery),
  head: () => pageHead("Invoices", "Customer invoices with VAT, due dates and payment status."),
  component: InvoicesPage,
  errorComponent: RouteError,
  notFoundComponent: NoRecords,
});

type Row = InvoiceRow & { effective: string; daysOverdue: number };

const filters: FilterDef<Row, "status">[] = [
  { key: "status", label: "Status", options: toOptions(INVOICE_STATUS), match: (r, v) => r.effective === v },
];

const columns: Column<Row>[] = [
  { key: "id", header: "Invoice no.", cell: (r) => <span className="font-id text-primary">{r.id}</span>, sortValue: (r) => r.id },
  {
    key: "order",
    header: "Order",
    cell: (r) => (
      <Link to="/orders/$orderId" params={{ orderId: r.order_id }} onClick={(e) => e.stopPropagation()} className="font-id text-primary hover:underline">
        {r.order_id}
      </Link>
    ),
    sortValue: (r) => r.order_id,
  },
  { key: "customer", header: "Customer", cell: (r) => <span className="font-medium">{r.customers?.name}</span>, sortValue: (r) => r.customers?.name },
  { key: "date", header: "Invoice date", cell: (r) => formatDate(r.invoice_date), sortValue: (r) => r.invoice_date },
  {
    key: "due",
    header: "Due date",
    cell: (r) => (
      <span className={r.effective === "overdue" ? "font-medium text-danger" : ""}>
        {formatDate(r.due_date)}
        {r.effective === "overdue" && <span className="ml-1.5 text-xs">({r.daysOverdue}d)</span>}
      </span>
    ),
    sortValue: (r) => r.due_date,
  },
  { key: "excl", header: "Excl. VAT", cell: (r) => formatEUR(Number(r.amount_excl_vat)), sortValue: (r) => Number(r.amount_excl_vat), align: "right" },
  { key: "vat", header: "VAT", cell: (r) => `${Number(r.vat_rate)}%`, sortValue: (r) => Number(r.vat_rate), align: "right" },
  { key: "incl", header: "Incl. VAT", cell: (r) => <span className="font-medium">{formatEUR(Number(r.amount_incl_vat))}</span>, sortValue: (r) => Number(r.amount_incl_vat), align: "right" },
  { key: "status", header: "Status", cell: (r) => <StatusBadge kind="invoice" status={r.effective} />, sortValue: (r) => r.effective },
];

function InvoicesPage() {
  const { data } = useSuspenseQuery(invoicesQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const today = todayISO();
  const rows: Row[] = data.map((i) => ({
    ...i,
    effective: effectiveInvoiceStatus(i, today),
    daysOverdue: Math.max(0, daysBetween(i.due_date, today)),
  }));
  const openAmount = rows.filter((r) => r.effective !== "paid").reduce((s, r) => s + Number(r.amount_incl_vat), 0);
  const overdue = rows.filter((r) => r.effective === "overdue").length;

  return (
    <>
      <PageHeader title="Invoices" description={`${formatEUR0(openAmount)} outstanding incl. VAT · ${overdue} overdue`} />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.id} ${r.order_id} ${r.customer_id} ${r.customers?.name ?? ""}`}
        searchPlaceholder="Search invoice, order, customer…"
        filters={filters}
        state={search}
        onStateChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
        onRowClick={(r) => navigate({ to: "/orders/$orderId", params: { orderId: r.order_id } })}
        defaultSort={{ key: "id", dir: "desc" }}
      />
    </>
  );
}
