import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, CircleDot } from "lucide-react";
import { toast } from "sonner";

import { Field, PageHeader, Panel } from "@/components/erp/page-header";
import { RecordNotFound, RouteError, pageHead } from "@/components/erp/route-states";
import { StatusBadge } from "@/components/erp/status-badge";
import { SimpleTable } from "@/components/erp/simple-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { orderDetailQuery } from "@/lib/queries";
import { useIsAdmin } from "@/hooks/use-role";
import { COUNTRY, INVOICE_STATUS, ORDER_STATUS, ORDER_STATUS_FLOW, PACKAGING, SHIPMENT_STATUS } from "@/lib/status";
import { formatDate, formatDateTime, formatEUR, formatTonnes } from "@/lib/format";
import { effectiveInvoiceStatus, isOrderLate, todayISO } from "@/lib/erp-rules";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(orderDetailQuery(params.orderId));
    if (!data.order) throw notFound();
    return data;
  },
  head: ({ params }) => pageHead(`Order ${params.orderId}`, "Sales order with lines, shipments, invoice and activity log."),
  component: OrderDetail,
  errorComponent: RouteError,
  notFoundComponent: () => <RecordNotFound what="Order" backTo="/orders" backLabel="Back to sales orders" />,
});

function useUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await fn();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });
}

function OrderDetail() {
  const { orderId } = Route.useParams();
  const { data } = useSuspenseQuery(orderDetailQuery(orderId));
  const order = data.order!;
  const today = todayISO();
  const update = useUpdate();
  const isAdmin = useIsAdmin();
  const [nextStatus, setNextStatus] = useState(order.status);

  const totalTonnes = data.lines.reduce((s, l) => s + Number(l.quantity_tonnes), 0);
  const totalAmount = data.lines.reduce((s, l) => s + Number(l.line_total ?? 0), 0);
  const shippedTonnes = data.shipments
    .filter((s) => s.status === "delivered" || s.status === "in_transit")
    .reduce((s, x) => s + Number(x.quantity_tonnes), 0);
  const late = isOrderLate(order, today);

  function changeOrderStatus() {
    update.mutate(() => supabase.from("sales_orders").update({ status: nextStatus }).eq("id", order.id), {
      onSuccess: () => toast.success(`${order.id} set to ${ORDER_STATUS[nextStatus]?.label}`),
    });
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/orders"><ArrowLeft /> Sales orders</Link>
      </Button>
      <PageHeader
        eyebrow="Sales order"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{order.id}</span>
            <StatusBadge kind="order" status={order.status} />
            {late && <Badge variant="danger">Late</Badge>}
          </span>
        }
        description={
          <>
            <Link to="/customers/$customerId" params={{ customerId: order.customer_id }} className="text-primary hover:underline">
              {order.customers?.name}
            </Link>{" "}
            · {order.customers?.city}, {COUNTRY[order.customers?.country ?? ""]}
          </>
        }
        actions={
          isAdmin ? (
          <>
            <Select value={nextStatus} onValueChange={setNextStatus}>
              <SelectTrigger className="h-8 w-44 text-sm" aria-label="New status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUS_FLOW.map((s) => (
                  <SelectItem key={s} value={s}>{ORDER_STATUS[s]?.label ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={nextStatus === order.status || update.isPending} onClick={changeOrderStatus}>
              Update status
            </Button>
          </>
          ) : (
            <span className="text-xs text-muted-foreground">View only</span>
          )
        }
      />

      <Panel bodyClassName="p-4" className="mb-4">
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Order date">{formatDate(order.order_date)}</Field>
          <Field label="Requested delivery">
            <span className={late ? "text-danger" : ""}>{formatDate(order.requested_delivery_date)}</span>
          </Field>
          <Field label="Ships from">{order.warehouses?.name}</Field>
          <Field label="Quantity">{formatTonnes(totalTonnes)}</Field>
          <Field label="Shipped / in transit">{formatTonnes(shippedTonnes)}</Field>
          <Field label="Value excl. VAT">{formatEUR(totalAmount)}</Field>
        </dl>
        {order.notes && <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{order.notes}</p>}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Order lines">
            <SimpleTable
              head={["#", "Product", "Packaging", "Quantity", "Price / t", "Line total"]}
              rightCols={[3, 4, 5]}
              rows={[
                ...data.lines.map((l) => ({
                  key: l.id,
                  cells: [
                    l.line_no,
                    <span>
                      <span className="font-medium">{l.products?.name}</span>{" "}
                      <span className="font-id text-xs text-muted-foreground">{l.product_sku}</span>
                    </span>,
                    PACKAGING[l.products?.packaging ?? ""] ?? "—",
                    formatTonnes(Number(l.quantity_tonnes)),
                    formatEUR(Number(l.unit_price)),
                    formatEUR(Number(l.line_total)),
                  ],
                })),
                {
                  key: "total",
                  cells: ["", <span className="font-semibold">Total</span>, "", <span className="font-semibold">{formatTonnes(totalTonnes)}</span>, "", <span className="font-semibold">{formatEUR(totalAmount)}</span>],
                },
              ]}
            />
          </Panel>

          <Panel title={`Shipments (${data.shipments.length})`}>
            {data.shipments.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No shipments planned yet.</div>
            ) : (
              <div className="divide-y">
                {data.shipments.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
                    <span className="font-id text-primary">{s.id}</span>
                    <span>{s.carrier}</span>
                    <span className="tabular-nums">{formatTonnes(Number(s.quantity_tonnes))}</span>
                    <span className="text-muted-foreground">
                      Planned {formatDate(s.planned_date)}
                      {s.actual_date && ` · Actual ${formatDate(s.actual_date)}`}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      {!isAdmin ? <StatusBadge kind="shipment" status={s.status} /> : (
                      <Select
                        value={s.status}
                        onValueChange={(v) =>
                          update.mutate(
                            () =>
                              supabase
                                .from("shipments")
                                .update({
                                  status: v,
                                  actual_date: v === "delivered" || v === "in_transit" ? (s.actual_date ?? today) : s.actual_date,
                                })
                                .eq("id", s.id),
                            { onSuccess: () => toast.success(`${s.id} set to ${SHIPMENT_STATUS[v]?.label}`) },
                          )
                        }
                      >
                        <SelectTrigger className="h-7 w-32 text-xs" aria-label={`Status of ${s.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SHIPMENT_STATUS).map(([v, d]) => (
                            <SelectItem key={v} value={v}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      )}
                    </div>
                    {s.delay_reason && (
                      <p className="w-full rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
                        Delay reason: {s.delay_reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Invoice">
            {data.invoices.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Not invoiced yet. Invoices are issued on shipment.</div>
            ) : (
              <div className="divide-y">
                {data.invoices.map((inv) => {
                  const eff = effectiveInvoiceStatus(inv, today);
                  return (
                    <div key={inv.id} className="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
                      <Field label="Invoice no."><span className="font-id text-primary">{inv.id}</span></Field>
                      <Field label="Invoice date">{formatDate(inv.invoice_date)}</Field>
                      <Field label="Due date">{formatDate(inv.due_date)}</Field>
                      <Field label="Excl. VAT">{formatEUR(Number(inv.amount_excl_vat))}</Field>
                      <Field label={`Incl. ${Number(inv.vat_rate)}% VAT`}>{formatEUR(Number(inv.amount_incl_vat))}</Field>
                      <div className="ml-auto flex items-center gap-2">
                        <StatusBadge kind="invoice" status={eff} />
                        {isAdmin && eff !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate(
                                () => supabase.from("invoices").update({ status: "paid", paid_date: today }).eq("id", inv.id),
                                { onSuccess: () => toast.success(`${inv.id} marked as paid`) },
                              )
                            }
                          >
                            <Check /> Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Activity log" bodyClassName="p-4">
          <ol className="relative space-y-4 border-l pl-5">
            {data.activity.map((a) => (
              <li key={a.id} className="relative">
                <CircleDot className="absolute -left-[27px] top-0.5 size-3.5 bg-card text-primary" />
                <div className="text-sm font-medium text-foreground">{a.event}</div>
                {a.to_status && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {a.from_status && <span>{labelFor(a.from_status)}</span>}
                    {a.from_status && <span>→</span>}
                    <span className="font-medium text-foreground">{labelFor(a.to_status)}</span>
                  </div>
                )}
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(a.created_at)} · {a.actor}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}

function labelFor(status: string) {
  return ORDER_STATUS[status]?.label ?? SHIPMENT_STATUS[status]?.label ?? INVOICE_STATUS[status]?.label ?? status.replace(/_/g, " ");
}
