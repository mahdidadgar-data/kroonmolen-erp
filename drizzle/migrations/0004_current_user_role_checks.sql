CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated, service_role;

DO $$
DECLARE t text; f regprocedure; definition text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'products', 'warehouses', 'inventory', 'sales_orders', 'sales_order_lines', 'shipments', 'invoices', 'order_activity'] LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (public.has_role(''viewer''::public.app_role) OR public.has_role(''admin''::public.app_role))', 'Approved staff can view ' || t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['sales_orders', 'shipments', 'invoices'] LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (public.has_role(''admin''::public.app_role)) WITH CHECK (public.has_role(''admin''::public.app_role))', 'Admins can update ' || t, t);
  END LOOP;
  -- Preserve the existing routine bodies and privileges, changing only their role checks.
  FOREACH f IN ARRAY ARRAY['public.admin_list_users()'::regprocedure, 'public.admin_approve_viewer(uuid)'::regprocedure, 'public.admin_revoke_access(uuid)'::regprocedure, 'public.reset_demo_data()'::regprocedure] LOOP
    definition := pg_get_functiondef(f);
    definition := replace(definition, 'public.has_role(auth.uid(), ''admin'')', 'public.has_role(''admin''::public.app_role)');
    definition := replace(definition, 'public.has_role(_user_id, ''admin'')', 'EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ''admin''::public.app_role)');
    EXECUTE definition;
  END LOOP;
END $$;

DROP FUNCTION public.is_staff(uuid);
DROP FUNCTION public.has_role(uuid, public.app_role);