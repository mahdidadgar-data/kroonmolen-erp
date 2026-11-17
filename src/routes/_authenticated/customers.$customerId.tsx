import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { Field, PageHeader, Panel } from "@/components/erp/page-header";
import { RecordNotFound, RouteError, pageHead } from "@/components/erp/route-states";
import { StatusBadge } from "@/components/erp/status-badge";
import { SimpleTable } from "@/components/erp/simple-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { customerDetailQuery, orderTotals } from "@/lib/queries";
import { COUNTRY, CUSTOMER_TYPE } from "@/lib/status";
import { formatDate, formatEUR, formatEUR0, formatTonnes } from "@/lib/format";
import { effectiveInvoiceStatus, todayISO } from "@/lib/erp-rules";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(customerDetailQuery(params.customerId));
    if (!data.customer) throw notFound();
    return data;
  },
  head: ({ params }) => pageHead(`Customer ${params.customerId}`, "Customer details with orders and invoices."),
  component: CustomerDetail,
  errorComponent: RouteError,
  notFoundComponent: () => <RecordNotFound what="Customer" backTo="/customers" backLabel="Back to customers" />,
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const { data } = useSuspenseQuery(customerDetailQuery(customerId));
  const navigate = Route.useNavigate();
  const c = data.customer!;
  const today = todayISO();
  const invoices = data.invoices.map((i) => ({ ...i, effective: effectiveInvoiceStatus(i, today) }));
  const open = invoices.filter((i) => i.effective !== "paid").reduce((s, i) => s + Number(i.amount_incl_vat), 0);
  const overdue = invoices.filter((i) => i.effective === "overdue").reduce((s, i) => s + Number(i.amount_incl_vat), 0);
  const limit = Number(c.credit_limit);
  const usedPct = limit > 0 ? Math.min(100, (open / limit) * 100) : 0;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/customers"><ArrowLeft /> Customers</Link>
      </Button>
      <PageHeader
        eyebrow={<span className="font-id">{c.id}</span>}
        title={c.name}
        description={`${c.city}, ${COUNTRY[c.country]}`}
        actions={<Badge variant={c.customer_type === "dealer" ? "info" : "neutral"}>{CUSTOMER_TYPE[c.customer_type]}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Account" bodyClassName="p-4">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Customer no.">{c.id}</Field>
            <Field label="Type">{CUSTOMER_TYPE[c.customer_type]}</Field>
            <Field label="City">{c.city}</Field>
            <Field label="Country">{COUNTRY[c.country]}</Field>
            <Field label="Payment terms">{c.payment_terms_days} days</Field>
            <Field label="Contact">{c.contact_email ?? "—"}</Field>
          </dl>
        </Panel>
        <Panel title="Credit" className="lg:col-span-2" bodyClassName="p-4">
          <dl className="grid grid-cols-3 gap-4">
            <Field label="Credit limit">{formatEUR0(limit)}</Field>
            <Field label="Open balance">{formatEUR0(open)}</Field>
            <Field label="Overdue">
              <span className={overdue > 0 ? "text-danger" : ""}>{formatEUR0(overdue)}</span>
            </Field>
          </dl>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Credit used</span>
              <span>{usedPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={usedPct >= 100 ? "h-full bg-danger" : usedPct >= 80 ? "h-full bg-warning" : "h-full bg-success"}
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title={`Orders (${data.orders.length})`}>
          <SimpleTable
            head={["Order", "Date", "Quantity", "Value", "Status"]}
            rightCols={[2, 3]}
            rows={data.orders.map((o) => {
              const t = orderTotals(o.sales_order_lines);
              return {
                key: o.id,
                onClick: () => navigate({ to: "/orders/$orderId", params: { orderId: o.id } }),
                cells: [
                  <span className="font-id text-primary">{o.id}</span>,
                  formatDate(o.order_date),
                  formatTonnes(t.tonnes),
                  formatEUR(t.amount),
                  <StatusBadge kind="order" status={o.status} />,
                ],
              };
            })}
          />
        </Panel>
        <Panel title={`Invoices (${invoices.length})`}>
          <SimpleTable
            head={["Invoice", "Order", "Due", "Incl. VAT", "Status"]}
            rightCols={[3]}
            rows={invoices.map((i) => ({
              key: i.id,
              onClick: () => navigate({ to: "/orders/$orderId", params: { orderId: i.order_id } }),
              cells: [
                <span className="font-id text-primary">{i.id}</span>,
                <span className="font-id">{i.order_id}</span>,
                formatDate(i.due_date),
                formatEUR(Number(i.amount_incl_vat)),
                <StatusBadge kind="invoice" status={i.effective} />,
              ],
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
