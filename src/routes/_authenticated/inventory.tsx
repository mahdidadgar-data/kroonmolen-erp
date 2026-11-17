import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DataTable, type Column, type FilterDef } from "@/components/erp/data-table";
import { PageHeader } from "@/components/erp/page-header";
import { NoRecords, RouteError, pageHead } from "@/components/erp/route-states";
import { StatusBadge } from "@/components/erp/status-badge";
import { inventoryQuery, type InventoryRow } from "@/lib/queries";
import { listSearch } from "@/lib/list-search";
import { PACKAGING, SPECIES, STOCK_STATUS, toOptions } from "@/lib/status";
import { formatTonnes } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inventory")({
  validateSearch: listSearch("warehouse", "status", "species"),
  loader: ({ context }) => context.queryClient.ensureQueryData(inventoryQuery),
  head: () => pageHead("Inventory", "Stock per product per warehouse with reorder levels."),
  component: InventoryPage,
  errorComponent: RouteError,
  notFoundComponent: NoRecords,
});

const filters: FilterDef<InventoryRow, "warehouse" | "status" | "species">[] = [
  {
    key: "warehouse",
    label: "Warehouse",
    options: [
      { value: "WH-ZWL", label: "Mill Zwolle" },
      { value: "WH-ANR", label: "Depot Antwerp" },
    ],
    match: (r, v) => r.warehouse_id === v,
  },
  { key: "status", label: "Status", options: toOptions(STOCK_STATUS), match: (r, v) => r.stock_status === v },
  { key: "species", label: "Species", options: toOptions(SPECIES), match: (r, v) => r.products?.species === v },
];

function Coverage({ qty, reorder }: { qty: number; reorder: number }) {
  const pct = reorder > 0 ? Math.min(100, (qty / (reorder * 3)) * 100) : 100;
  const tone = qty <= 0 ? "bg-danger" : qty <= reorder ? "bg-warning" : "bg-success";
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(pct, qty > 0 ? 4 : 0)}%` }} />
    </div>
  );
}

const columns: Column<InventoryRow>[] = [
  { key: "sku", header: "SKU", cell: (r) => <span className="font-id text-primary">{r.product_sku}</span>, sortValue: (r) => r.product_sku },
  { key: "name", header: "Product", cell: (r) => <span className="font-medium">{r.products?.name}</span>, sortValue: (r) => r.products?.name },
  { key: "packaging", header: "Packaging", cell: (r) => PACKAGING[r.products?.packaging ?? ""] ?? "—", sortValue: (r) => r.products?.packaging },
  { key: "warehouse", header: "Warehouse", cell: (r) => r.warehouses?.name, sortValue: (r) => r.warehouses?.name },
  { key: "qty", header: "On hand", cell: (r) => formatTonnes(Number(r.quantity_tonnes)), sortValue: (r) => Number(r.quantity_tonnes), align: "right" },
  { key: "reorder", header: "Reorder level", cell: (r) => formatTonnes(Number(r.reorder_level_tonnes)), sortValue: (r) => Number(r.reorder_level_tonnes), align: "right" },
  { key: "coverage", header: "Level", cell: (r) => <Coverage qty={Number(r.quantity_tonnes)} reorder={Number(r.reorder_level_tonnes)} /> },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusBadge kind="stock" status={r.stock_status ?? "in_stock"} />,
    sortValue: (r) => ({ out_of_stock: 0, low: 1, in_stock: 2 })[r.stock_status ?? "in_stock"],
  },
];

function InventoryPage() {
  const { data } = useSuspenseQuery(inventoryQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const out = data.filter((r) => r.stock_status === "out_of_stock").length;
  const low = data.filter((r) => r.stock_status === "low").length;

  return (
    <>
      <PageHeader
        title="Inventory"
        description={`Stock at Mill Zwolle and Depot Antwerp · ${out} out of stock · ${low} low`}
      />
      <DataTable
        rows={data}
        columns={columns}
        rowKey={(r) => `${r.product_sku}-${r.warehouse_id}`}
        searchText={(r) => `${r.product_sku} ${r.products?.name ?? ""}`}
        searchPlaceholder="Search SKU or product…"
        filters={filters}
        state={search}
        onStateChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
        defaultSort={{ key: "status", dir: "asc" }}
      />
    </>
  );
}
