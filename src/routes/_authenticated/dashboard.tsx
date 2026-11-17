import { cloneElement, type ReactElement, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  Clock,
  CreditCard,
  FileWarning,
  PackageX,
  ShoppingCart,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { PageHeader, Panel } from "@/components/erp/page-header";
import { NoRecords, RouteError, pageHead } from "@/components/erp/route-states";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { customersQuery, inventoryQuery, invoicesQuery, ordersQuery, shipmentsQuery } from "@/lib/queries";
import { addDays, daysBetween, effectiveInvoiceStatus, isOrderLate, isOrderOpen, isShippingToday, todayISO, weekStart } from "@/lib/erp-rules";
import { formatDate, formatEUR0 } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(ordersQuery),
      context.queryClient.ensureQueryData(shipmentsQuery),
      context.queryClient.ensureQueryData(invoicesQuery),
      context.queryClient.ensureQueryData(inventoryQuery),
      context.queryClient.ensureQueryData(customersQuery),
    ]),
  head: () => pageHead("Dashboard", "Open orders, shipments today, stock alerts and receivables at a glance."),
  component: Dashboard,
  errorComponent: RouteError,
  notFoundComponent: NoRecords,
});

const chartConfig = {
  orders: { label: "Orders", color: "var(--chart-1)" },
  cancelled: { label: "Cancelled", color: "var(--chart-5)" },
} satisfies ChartConfig;

type Exception = {
  key: string;
  severity: "danger" | "warning";
  icon: LucideIcon;
  title: string;
  detail: string;
  link: ReactNode;
};

function Dashboard() {
  const { data: orders } = useSuspenseQuery(ordersQuery);
  const { data: shipments } = useSuspenseQuery(shipmentsQuery);
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: inventory } = useSuspenseQuery(inventoryQuery);
  const { data: customers } = useSuspenseQuery(customersQuery);
  const today = todayISO();

  const openOrders = orders.filter((o) => isOrderOpen(o.status));
  const shipToday = shipments.filter((s) => isShippingToday(s, today));
  const shipTodayOrders = new Set(shipToday.map((s) => s.order_id));
  const lowStock = inventory.filter((i) => i.stock_status !== "in_stock");
  const outOfStock = lowStock.filter((i) => i.stock_status === "out_of_stock");
  const inv = invoices.map((i) => ({ ...i, effective: effectiveInvoiceStatus(i, today) }));
  const overdue = inv.filter((i) => i.effective === "overdue");
  const unpaid = inv.filter((i) => i.effective !== "paid");
  const openAmount = unpaid.reduce((s, i) => s + Number(i.amount_incl_vat), 0);
  const overdueAmount = overdue.reduce((s, i) => s + Number(i.amount_incl_vat), 0);

  // Orders per week, last 13 weeks
  const firstWeek = weekStart(addDays(today, -7 * 12));
  const weeks = Array.from({ length: 13 }, (_, i) => addDays(firstWeek, i * 7));
  const chartData = weeks.map((w) => {
    const inWeek = orders.filter((o) => weekStart(o.order_date) === w);
    return {
      week: formatDate(w).slice(0, 6),
      orders: inWeek.filter((o) => o.status !== "cancelled").length,
      cancelled: inWeek.filter((o) => o.status === "cancelled").length,
    };
  });

  // Exceptions
  const exceptions: Exception[] = [];
  for (const s of shipments.filter((x) => x.status === "delayed")) {
    exceptions.push({
      key: s.id,
      severity: "danger",
      icon: Truck,
      title: `Shipment ${s.id} delayed`,
      detail: `${s.sales_orders?.customers?.name ?? ""} · planned ${formatDate(s.planned_date)} · ${s.delay_reason ?? "no reason given"}`,
      link: <Link to="/orders/$orderId" params={{ orderId: s.order_id }} className="font-id text-primary hover:underline">{s.order_id}</Link>,
    });
  }
  for (const o of orders.filter((x) => isOrderLate(x, today))) {
    exceptions.push({
      key: `late-${o.id}`,
      severity: "warning",
      icon: Clock,
      title: `Order ${o.id} past requested delivery`,
      detail: `${o.customers?.name ?? ""} · requested ${formatDate(o.requested_delivery_date)} · ${daysBetween(o.requested_delivery_date, today)} days late`,
      link: <Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-id text-primary hover:underline">{o.id}</Link>,
    });
  }
  for (const i of [...overdue].sort((a, b) => a.due_date.localeCompare(b.due_date))) {
    exceptions.push({
      key: i.id,
      severity: "danger",
      icon: FileWarning,
      title: `Invoice ${i.id} overdue`,
      detail: `${i.customers?.name ?? ""} · ${formatEUR0(Number(i.amount_incl_vat))} · ${daysBetween(i.due_date, today)} days past due`,
      link: <Link to="/orders/$orderId" params={{ orderId: i.order_id }} className="font-id text-primary hover:underline">{i.order_id}</Link>,
    });
  }
  for (const s of lowStock) {
    exceptions.push({
      key: `${s.product_sku}-${s.warehouse_id}`,
      severity: s.stock_status === "out_of_stock" ? "danger" : "warning",
      icon: s.stock_status === "out_of_stock" ? PackageX : Boxes,
      title: `${s.products?.name} ${s.stock_status === "out_of_stock" ? "out of stock" : "below reorder level"}`,
      detail: `${s.warehouses?.name} · ${Number(s.quantity_tonnes)} t on hand, reorder at ${Number(s.reorder_level_tonnes)} t`,
      link: <Link to="/inventory" search={{ q: s.product_sku }} className="font-id text-primary hover:underline">{s.product_sku}</Link>,
    });
  }
  for (const c of customers) {
    const bal = unpaid.filter((i) => i.customer_id === c.id).reduce((s, i) => s + Number(i.amount_incl_vat), 0);
    if (bal > Number(c.credit_limit)) {
      exceptions.push({
        key: `credit-${c.id}`,
        severity: "warning",
        icon: CreditCard,
        title: `${c.name} over credit limit`,
        detail: `Open ${formatEUR0(bal)} vs limit ${formatEUR0(Number(c.credit_limit))}`,
        link: <Link to="/customers/$customerId" params={{ customerId: c.id }} className="font-id text-primary hover:underline">{c.id}</Link>,
      });
    }
  }
  exceptions.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));

  return (
    <>
      <PageHeader title="Dashboard" description={`Today, ${formatDate(today)} · Mill Zwolle & Depot Antwerp`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={ShoppingCart} label="Open orders" value={String(openOrders.length)} hint={`${orders.length} in last 3 months`} to={<Link to="/orders" search={{ view: "open" }} />} />
        <Kpi icon={Truck} label="Shipping today" value={String(shipTodayOrders.size)} hint={`${shipToday.length} loads planned`} to={<Link to="/shipments" search={{ when: "today" }} />} />
        <Kpi
          icon={Boxes}
          label="Low-stock products"
          value={String(lowStock.length)}
          hint={`${outOfStock.length} out of stock`}
          tone={outOfStock.length ? "danger" : "warning"}
          to={<Link to="/inventory" search={{ sort: "status", dir: "asc" }} />}
        />
        <Kpi icon={FileWarning} label="Overdue invoices" value={String(overdue.length)} hint={formatEUR0(overdueAmount)} tone="danger" to={<Link to="/invoices" search={{ status: "overdue" }} />} />
        <Kpi icon={Wallet} label="Open invoice amount" value={formatEUR0(openAmount)} hint={`${unpaid.length} unpaid, incl. VAT`} to={<Link to="/invoices" search={{ sort: "due", dir: "asc" }} />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Orders per week" actions={<span className="text-xs text-muted-foreground">Last 13 weeks</span>} bodyClassName="p-4">
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={chartData} margin={{ left: -20, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="orders" stackId="a" fill="var(--color-orders)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cancelled" stackId="a" fill="var(--color-cancelled)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" /> Needs attention
              <Badge variant="neutral">{exceptions.length}</Badge>
            </span>
          }
        >
          <ul className="max-h-[320px] divide-y overflow-y-auto">
            {exceptions.map((e) => (
              <li key={e.key} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
                    e.severity === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
                  )}
                >
                  <e.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="truncate text-xs text-muted-foreground" title={e.detail}>{e.detail}</div>
                </div>
                <div className="shrink-0 text-xs">{e.link}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone?: "danger" | "warning";
  to: ReactElement<{ className?: string; children?: ReactNode }>;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-primary")} />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
        {hint}
        <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </>
  );
  return cloneElement(to, {
    className: "group block rounded-lg border bg-card p-4 shadow-card transition-colors hover:border-primary/40",
    children: content,
  });
}
