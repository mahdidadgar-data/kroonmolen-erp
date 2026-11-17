import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable, type Column, type FilterDef } from "@/components/erp/data-table";
import { PageHeader } from "@/components/erp/page-header";
import { NoRecords, RouteError, pageHead } from "@/components/erp/route-states";
import { StatusBadge } from "@/components/erp/status-badge";
import { inventoryQuery, productsQuery, type ProductRow } from "@/lib/queries";
import { listSearch } from "@/lib/list-search";
import { FORM, PACKAGING, SPECIES, toOptions } from "@/lib/status";
import { formatEUR, formatTonnes } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  validateSearch: listSearch("species", "form", "packaging"),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(inventoryQuery),
    ]),
  head: () => pageHead("Products", "Compound feed products: species, form, packaging and price per tonne."),
  component: ProductsPage,
  errorComponent: RouteError,
  notFoundComponent: NoRecords,
});

type Row = ProductRow & { stock: number; worst: string };

const filters: FilterDef<Row, "species" | "form" | "packaging">[] = [
  { key: "species", label: "Species", options: toOptions(SPECIES), match: (r, v) => r.species === v },
  { key: "form", label: "Form", options: toOptions(FORM), match: (r, v) => r.form === v },
  { key: "packaging", label: "Packaging", options: toOptions(PACKAGING), match: (r, v) => r.packaging === v },
];

const columns: Column<Row>[] = [
  { key: "sku", header: "SKU", cell: (r) => <span className="font-id text-primary">{r.sku}</span>, sortValue: (r) => r.sku },
  { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
  { key: "species", header: "Species", cell: (r) => SPECIES[r.species], sortValue: (r) => r.species },
  { key: "form", header: "Form", cell: (r) => FORM[r.form], sortValue: (r) => r.form },
  { key: "packaging", header: "Packaging", cell: (r) => PACKAGING[r.packaging], sortValue: (r) => r.packaging },
  { key: "price", header: "Price / tonne", cell: (r) => formatEUR(Number(r.unit_price_per_tonne)), sortValue: (r) => Number(r.unit_price_per_tonne), align: "right" },
  { key: "stock", header: "Total stock", cell: (r) => formatTonnes(r.stock), sortValue: (r) => r.stock, align: "right" },
  { key: "status", header: "Stock status", cell: (r) => <StatusBadge kind="stock" status={r.worst} />, sortValue: (r) => r.worst },
];

const RANK: Record<string, number> = { out_of_stock: 0, low: 1, in_stock: 2 };

function ProductsPage() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: inventory } = useSuspenseQuery(inventoryQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const rows: Row[] = products.map((p) => {
    const inv = inventory.filter((i) => i.product_sku === p.sku);
    const worst = inv.reduce((w, i) => (RANK[i.stock_status ?? "in_stock"] < RANK[w] ? (i.stock_status ?? w) : w), "in_stock");
    return { ...p, stock: inv.reduce((s, i) => s + Number(i.quantity_tonnes), 0), worst };
  });

  return (
    <>
      <PageHeader title="Products" description="Feed products with list price per tonne. Stock status shows the weakest warehouse." />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.sku}
        searchText={(r) => `${r.sku} ${r.name}`}
        searchPlaceholder="Search SKU or name…"
        filters={filters}
        state={search}
        onStateChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
        onRowClick={(r) => navigate({ to: "/inventory", search: { q: r.sku } })}
        defaultSort={{ key: "sku", dir: "asc" }}
      />
    </>
  );
}
