import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Field, PageHeader, Panel } from "@/components/erp/page-header";
import { NoRecords, RouteError, pageHead } from "@/components/erp/route-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { adminUsersQuery, myRoleQuery } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myRoleQuery),
  head: () => pageHead("Settings", "Your access level and demo data tools."),
  component: SettingsPage,
  errorComponent: RouteError,
  notFoundComponent: NoRecords,
});

function SettingsPage() {
  const { data: role } = useSuspenseQuery(myRoleQuery);
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const isAdmin = role === "admin";

  async function reset() {
    setBusy(true);
    const { error } = await supabase.rpc("reset_demo_data");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries();
    toast.success("Demo data reset with dates relative to today");
  }

  return (
    <>
      <PageHeader title="Settings" description="Your access and demo data tools." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Your access" bodyClassName="p-4">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Signed in as">{user.email}</Field>
            <Field label="Role">
              <Badge variant={isAdmin ? "success" : "neutral"}>{isAdmin ? "Admin" : "Viewer"}</Badge>
            </Field>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            {isAdmin
              ? "You can change order, shipment and invoice statuses."
              : "You can view all modules. Ask an admin if you need to change data."}
          </p>
        </Panel>
        <Panel title="Demo data" bodyClassName="p-4">
          <p className="text-sm text-muted-foreground">
            Rebuild all customers, products, stock, orders, shipments and invoices with dates relative to today.
            Includes delayed and partial shipments, cancelled orders, low and out-of-stock products, overdue
            invoices and a customer over its credit limit. All changes made since will be lost.
          </p>
          {isAdmin ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="mt-4" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset demo data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every record and the activity log are replaced with fresh demo data. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={reset}>Reset demo data</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">Only admins can reset demo data.</p>
          )}
        </Panel>
      </div>
      {isAdmin && <UsersPanel currentUserId={user.id} />}
    </>
  );
}

function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const { data: users = [], isLoading, error } = useQuery(adminUsersQuery);
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(fn: "admin_approve_viewer" | "admin_revoke_access", id: string, ok: string) {
    setBusyId(id);
    const { error } = await supabase.rpc(fn, { _user_id: id });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: adminUsersQuery.queryKey });
    toast.success(ok);
  }

  const label = { admin: "Admin", viewer: "Viewer", pending: "Pending" } as Record<string, string>;
  const variant = { admin: "success", viewer: "neutral", pending: "warning" } as const;

  return (
    <Panel title="Users" className="mt-4">
      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">Loading users…</p>
      ) : error ? (
        <p className="p-4 text-sm text-destructive">{error.message}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Signed up</th>
              <th className="px-4 py-2 font-medium">Access</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {u.email}
                  {!u.email_confirmed && <span className="ml-2 text-xs text-muted-foreground">(email not confirmed)</span>}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{formatDate(u.created_at)}</td>
                <td className="px-4 py-2">
                  <Badge variant={variant[u.role as keyof typeof variant] ?? "neutral"}>{label[u.role] ?? u.role}</Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  {u.role === "pending" && (
                    <Button size="sm" disabled={busyId === u.user_id} onClick={() => act("admin_approve_viewer", u.user_id, `${u.email} approved as viewer`)}>
                      Approve as viewer
                    </Button>
                  )}
                  {u.role === "viewer" && u.user_id !== currentUserId && (
                    <Button size="sm" variant="outline" disabled={busyId === u.user_id} onClick={() => act("admin_revoke_access", u.user_id, `Access revoked for ${u.email}`)}>
                      Revoke access
                    </Button>
                  )}
                  {u.role === "admin" && <span className="text-xs text-muted-foreground">Admin rights can't be changed here</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
