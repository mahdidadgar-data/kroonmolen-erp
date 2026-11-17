import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/erp/app-shell";
import { PendingApproval } from "@/components/erp/pending-approval";
import { myRoleQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated")({
  // The session lives in browser storage, so the gate runs client-side only.
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    // UI only: the database already returns no rows to users without a role.
    const role = await context.queryClient.fetchQuery({ ...myRoleQuery, staleTime: 0 });
    return { user: data.user, role };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, role } = Route.useRouteContext();
  if (role === "pending") return <PendingApproval email={user.email ?? ""} />;
  return (
    <AppShell email={user.email ?? "staff"}>
      <Outlet />
    </AppShell>
  );
}
