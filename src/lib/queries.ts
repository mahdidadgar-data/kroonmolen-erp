import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const fetchCustomers = async () => check(await supabase.from("customers").select("*").order("id"));
export const customersQuery = queryOptions({ queryKey: ["customers"], queryFn: fetchCustomers });

const fetchProducts = async () => check(await supabase.from("products").select("*").order("sku"));
export const productsQuery = queryOptions({ queryKey: ["products"], queryFn: fetchProducts });

const fetchInventory = async () =>
    check(
      await supabase
        .from("inventory")
        .select("*, products(name, species, packaging), warehouses(name)")
        .order("product_sku"),
    );
export const inventoryQuery = queryOptions({ queryKey: ["inventory"], queryFn: fetchInventory });

const fetchOrders = async () =>
    check(
      await supabase
        .from("sales_orders")
        .select("*, customers(name, country), sales_order_lines(quantity_tonnes, line_total)")
        .order("id", { ascending: false }),
    );
export const ordersQuery = queryOptions({ queryKey: ["orders"], queryFn: fetchOrders });

const fetchShipments = async () =>
    check(
      await supabase
        .from("shipments")
        .select("*, sales_orders(customer_id, customers(name))")
        .order("id", { ascending: false }),
    );
export const shipmentsQuery = queryOptions({ queryKey: ["shipments"], queryFn: fetchShipments });

const fetchInvoices = async () =>
    check(
      await supabase
        .from("invoices")
        .select("*, customers(name, credit_limit)")
        .order("id", { ascending: false }),
    );
export const invoicesQuery = queryOptions({ queryKey: ["invoices"], queryFn: fetchInvoices });

export const customerDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["customer", id],
    queryFn: async () => {
      const [customer, orders, invoices] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("sales_orders")
          .select("*, sales_order_lines(quantity_tonnes, line_total)")
          .eq("customer_id", id)
          .order("id", { ascending: false }),
        supabase.from("invoices").select("*").eq("customer_id", id).order("id", { ascending: false }),
      ]);
      return { customer: check(customer), orders: check(orders), invoices: check(invoices) };
    },
  });

export const orderDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["order", id],
    queryFn: async () => {
      const [order, lines, shipments, invoices, activity] = await Promise.all([
        supabase.from("sales_orders").select("*, customers(*), warehouses(name)").eq("id", id).maybeSingle(),
        supabase
          .from("sales_order_lines")
          .select("*, products(name, packaging)")
          .eq("order_id", id)
          .order("line_no"),
        supabase.from("shipments").select("*").eq("order_id", id).order("id"),
        supabase.from("invoices").select("*").eq("order_id", id).order("id"),
        supabase
          .from("order_activity")
          .select("*")
          .eq("order_id", id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
      ]);
      return {
        order: check(order),
        lines: check(lines),
        shipments: check(shipments),
        invoices: check(invoices),
        activity: check(activity),
      };
    },
  });

export type OrderRow = Awaited<ReturnType<typeof fetchOrders>>[number];
export type ShipmentRow = Awaited<ReturnType<typeof fetchShipments>>[number];
export type InvoiceRow = Awaited<ReturnType<typeof fetchInvoices>>[number];
export type InventoryRow = Awaited<ReturnType<typeof fetchInventory>>[number];
export type CustomerRow = Awaited<ReturnType<typeof fetchCustomers>>[number];
export type ProductRow = Awaited<ReturnType<typeof fetchProducts>>[number];

// Moved to erp-rules so server code (the /api/v1 routes) can use it without the browser client.
export { orderTotals } from "@/lib/erp-rules";

export const myRoleQuery = queryOptions({
  queryKey: ["my-role"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return "viewer" as const;
    const rows = check(await supabase.from("user_roles").select("role").eq("user_id", u.user.id));
    return rows.some((r) => r.role === "admin") ? ("admin" as const) : ("viewer" as const);
  },
});
