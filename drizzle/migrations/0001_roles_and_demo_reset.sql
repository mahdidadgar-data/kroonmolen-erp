CREATE TYPE public.app_role AS ENUM ('viewer', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

INSERT INTO public.user_roles (user_id, role) SELECT id, 'viewer' FROM auth.users ON CONFLICT DO NOTHING;

DROP POLICY "Signed-in staff can update sales_orders" ON public.sales_orders;
DROP POLICY "Signed-in staff can update shipments" ON public.shipments;
DROP POLICY "Signed-in staff can update invoices" ON public.invoices;
CREATE POLICY "Admins can update sales_orders" ON public.sales_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shipments" ON public.shipments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Private snapshot of the original seed (anchored on 2026-11-17), not exposed through the API
CREATE SCHEMA IF NOT EXISTS demo_seed;
REVOKE ALL ON SCHEMA demo_seed FROM PUBLIC, anon, authenticated;
CREATE TABLE demo_seed.customers AS SELECT * FROM public.customers;
CREATE TABLE demo_seed.products AS SELECT * FROM public.products;
CREATE TABLE demo_seed.warehouses AS SELECT * FROM public.warehouses;
CREATE TABLE demo_seed.inventory AS SELECT product_sku, warehouse_id, quantity_tonnes, reorder_level_tonnes FROM public.inventory;
CREATE TABLE demo_seed.sales_orders AS SELECT * FROM public.sales_orders;
CREATE TABLE demo_seed.sales_order_lines AS SELECT id, order_id, line_no, product_sku, quantity_tonnes, unit_price FROM public.sales_order_lines;
CREATE TABLE demo_seed.shipments AS SELECT * FROM public.shipments;
CREATE TABLE demo_seed.invoices AS SELECT * FROM public.invoices;
CREATE TABLE demo_seed.order_activity AS SELECT order_id, event, from_status, to_status, actor, created_at FROM public.order_activity;

-- Let the seeding routine skip the automatic "Order created" log entry
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.seeding', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_activity (order_id, event, from_status, to_status, actor)
    VALUES (NEW.id, 'Order created', NULL, NEW.status, COALESCE(auth.jwt() ->> 'email', 'system'));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.updated_at := now();
    INSERT INTO public.order_activity (order_id, event, from_status, to_status, actor)
    VALUES (NEW.id, 'Status changed', OLD.status, NEW.status, COALESCE(auth.jwt() ->> 'email', 'system'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d integer := (now() AT TIME ZONE 'Europe/Amsterdam')::date - DATE '2026-11-17';
  iv interval := make_interval(days => ((now() AT TIME ZONE 'Europe/Amsterdam')::date - DATE '2026-11-17'));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset demo data' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.seeding', 'on', true);

  DELETE FROM public.order_activity WHERE id IS NOT NULL;
  DELETE FROM public.invoices WHERE id IS NOT NULL;
  DELETE FROM public.shipments WHERE id IS NOT NULL;
  DELETE FROM public.sales_order_lines WHERE id IS NOT NULL;
  DELETE FROM public.sales_orders WHERE id IS NOT NULL;
  DELETE FROM public.inventory WHERE product_sku IS NOT NULL;
  DELETE FROM public.products WHERE sku IS NOT NULL;
  DELETE FROM public.customers WHERE id IS NOT NULL;
  DELETE FROM public.warehouses WHERE id IS NOT NULL;

  INSERT INTO public.warehouses SELECT * FROM demo_seed.warehouses;
  INSERT INTO public.customers SELECT * FROM demo_seed.customers;
  INSERT INTO public.products SELECT * FROM demo_seed.products;
  INSERT INTO public.inventory (product_sku, warehouse_id, quantity_tonnes, reorder_level_tonnes)
    SELECT product_sku, warehouse_id, quantity_tonnes, reorder_level_tonnes FROM demo_seed.inventory;
  INSERT INTO public.sales_orders (id, customer_id, order_date, requested_delivery_date, warehouse_id, status, notes, created_at, updated_at)
    SELECT id, customer_id, order_date + d, requested_delivery_date + d, warehouse_id, status, notes, created_at + iv, updated_at + iv FROM demo_seed.sales_orders;
  INSERT INTO public.sales_order_lines (id, order_id, line_no, product_sku, quantity_tonnes, unit_price)
    SELECT id, order_id, line_no, product_sku, quantity_tonnes, unit_price FROM demo_seed.sales_order_lines;
  INSERT INTO public.shipments (id, order_id, carrier, quantity_tonnes, planned_date, actual_date, status, delay_reason)
    SELECT id, order_id, carrier, quantity_tonnes, planned_date + d, actual_date + d, status, delay_reason FROM demo_seed.shipments;
  INSERT INTO public.invoices (id, order_id, customer_id, invoice_date, due_date, amount_excl_vat, vat_rate, amount_incl_vat, status, paid_date)
    SELECT id, order_id, customer_id, invoice_date + d, due_date + d, amount_excl_vat, vat_rate, amount_incl_vat, status, paid_date + d FROM demo_seed.invoices;
  INSERT INTO public.order_activity (order_id, event, from_status, to_status, actor, created_at)
    SELECT order_id, event, from_status, to_status, actor, created_at + iv FROM demo_seed.order_activity;

  PERFORM set_config('app.seeding', 'off', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;