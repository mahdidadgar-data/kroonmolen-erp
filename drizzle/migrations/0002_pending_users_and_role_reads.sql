CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- New accounts start pending (no role) until an admin approves them.
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'viewer') OR public.has_role(_user_id, 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Signed-in staff can view customers" ON public.customers;
DROP POLICY IF EXISTS "Signed-in staff can view products" ON public.products;
DROP POLICY IF EXISTS "Signed-in staff can view warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Signed-in staff can view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Signed-in staff can view sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Signed-in staff can view sales_order_lines" ON public.sales_order_lines;
DROP POLICY IF EXISTS "Signed-in staff can view shipments" ON public.shipments;
DROP POLICY IF EXISTS "Signed-in staff can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Signed-in staff can view order_activity" ON public.order_activity;

CREATE POLICY "Approved staff can view customers" ON public.customers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Approved staff can view products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Approved staff can view warehouses" ON public.warehouses FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Approved staff can view inventory" ON public.inventory FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Approved staff can view sales_orders" ON public.sales_orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Approved staff can view sales_order_lines" ON public.sales_order_lines FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Approved staff can view shipments" ON public.shipments FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Approved staff can view invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Approved staff can view order_activity" ON public.order_activity FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, created_at timestamptz, email_confirmed boolean, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can list users' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, (u.email_confirmed_at IS NOT NULL),
    CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin') THEN 'admin'
         WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'viewer') THEN 'viewer'
         ELSE 'pending' END
  FROM auth.users u ORDER BY u.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.admin_approve_viewer(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve users' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'viewer') ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_access(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can revoke access' USING ERRCODE = '42501';
  END IF;
  IF public.has_role(_user_id, 'admin') THEN
    RAISE EXCEPTION 'Admin access cannot be changed from the app';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'viewer';
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_viewer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_viewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_access(uuid) TO authenticated;