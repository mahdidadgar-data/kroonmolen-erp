import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable, type Column, type FilterDef } from "@/components/erp/data-table";
import { PageHeader } from "@/components/erp/page-header";
import { NoRecords, RouteError, pageHead } from "@/components/erp/route-states";
import { Badge } from "@/components/ui/badge";
import { customersQuery, invoicesQuery, type CustomerRow } from "@/lib/queries";
import { listSearch } from "@/lib/list-search";
import { COUNTRY, CUSTOMER_TYPE, toOptions } from "@/lib/status";
import { formatEUR0 } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers/")({
  validateSearch: listSearch("type", "country"),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(customersQuery),
      context.queryClient.ensureQueryData(invoicesQuery),
    ]),
  head: () => pageHead("Customers", "Farms and feed dealers buying from Kroonmolen Feeds."),
  component: CustomersPage,
  errorComponent: RouteError,
  notFoundComponent: NoRecords,
});

type Row = CustomerRow & { openBalance: number };

const filters: FilterDef<Row, "type" | "country">[] = [
  { key: "type", label: "Type", options: toOptions(CUSTOMER_TYPE), match: (r, v) => r.customer_type === v },
  { key: "country", label: "Country", options: toOptions(COUNTRY), match: (r, v) => r.country === v },
];

const columns: Column<Row>[] = [
  { key: "id", header: "Customer no.", cell: (r) => <span className="font-id text-primary">{r.id}</span>, sortValue: (r) => r.id },
  { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
  {
    key: "type",
    header: "Type",
    cell: (r) => <Badge variant={r.customer_type === "dealer" ? "info" : "neutral"}>{CUSTOMER_TYPE[r.customer_type]}</Badge>,
    sortValue: (r) => r.customer_type,
  },
  { key: "city", header: "City", cell: (r) => r.city, sortValue: (r) => r.city },
  { key: "country", header: "Country", cell: (r) => COUNTRY[r.country], sortValue: (r) => r.country },
  { key: "terms", header: "Payment terms", cell: (r) => `${r.payment_terms_days} days`, sortValue: (r) => r.payment_terms_days, align: "right" },
  { key: "limit", header: "Credit limit", cell: (r) => formatEUR0(Number(r.credit_limit)), sortValue: (r) => Number(r.credit_limit), align: "right" },
  {
    key: "open",
    header: "Open balance",
    cell: (r) => (
      <span className={r.openBalance > Number(r.credit_limit) ? "font-medium text-danger" : ""}>{formatEUR0(r.openBalance)}</span>
    ),
    sortValue: (r) => r.openBalance,
    align: "right",
  },
];

function CustomersPage() {
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const rows: Row[] = customers.map((c) => ({
    ...c,
    openBalance: invoices
      .filter((i) => i.customer_id === c.id && i.status !== "paid")
      .reduce((s, i) => s + Number(i.amount_incl_vat), 0),
  }));

  return (
    <>
      <PageHeader title="Customers" description="Farms and feed dealers in the Netherlands and Belgium." />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.id} ${r.name} ${r.city}`}
        searchPlaceholder="Search number, name, city…"
        filters={filters}
        state={search}
        onStateChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
        onRowClick={(r) => navigate({ to: "/customers/$customerId", params: { customerId: r.id } })}
        defaultSort={{ key: "id", dir: "asc" }}
      />
    </>
  );
}
