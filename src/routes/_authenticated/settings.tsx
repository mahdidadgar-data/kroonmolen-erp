import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
import { myRoleQuery } from "@/lib/queries";

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
    </>
  );
}
