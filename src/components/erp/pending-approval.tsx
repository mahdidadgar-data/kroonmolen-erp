import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function PendingApproval({ email }: { email: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-card">
        <Badge variant="demo" className="mb-4">Demo – fictional company and data</Badge>
        <h1 className="text-lg font-semibold">Your account is waiting for approval</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in as <span className="font-medium text-foreground">{email}</span>. An admin needs to
          approve your account before you can see any data. Sign in again once you have been approved.
        </p>
        <Button variant="outline" className="mt-4 w-full" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </div>
    </div>
  );
}
