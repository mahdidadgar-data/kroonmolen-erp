import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Kroonmolen ERP" },
      { name: "description", content: "Staff sign-in for the Kroonmolen ERP back office (fictional demo)." },
      { property: "og:title", content: "Sign in — Kroonmolen ERP" },
      { property: "og:description", content: "Staff sign-in for the Kroonmolen ERP back office (fictional demo)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else setSentTo(email);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-between bg-sidebar p-8 text-sidebar-foreground lg:p-12">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-sidebar-primary font-bold text-sidebar-primary-foreground">
            K
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sidebar-accent-foreground">Kroonmolen ERP</div>
            <div className="text-xs text-sidebar-muted">Kroonmolen Feeds B.V.</div>
          </div>
        </div>
        <div className="my-10 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
            Compound feed, from mill to farm.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-muted">
            Sales orders, production, shipments and invoicing for bagged and bulk feed across the
            Netherlands and Belgium — in one back office.
          </p>
        </div>
        <Badge variant="demo" className="w-fit">Demo – fictional company and data</Badge>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {sentTo ? (
            <div className="rounded-lg border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>.
                Open it to activate your account, then sign in.
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => { setSentTo(null); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value={mode} className="mt-4">
                <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6 shadow-card">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {mode === "signin" ? "Welcome back" : "Create a staff account"}
                    </h2>
                    <p className="text-sm text-muted-foreground">Use your email and a password.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      minLength={6}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    {mode === "signin" ? "Sign in" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
