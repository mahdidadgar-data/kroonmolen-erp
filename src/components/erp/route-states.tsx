import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="rounded-lg border bg-card p-8 text-center shadow-card">
      <AlertTriangle className="mx-auto size-6 text-danger" />
      <h2 className="mt-2 font-semibold">This page couldn't load</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Unexpected error"}
      </p>
      <Button size="sm" className="mt-4" onClick={() => router.invalidate()}>
        Try again
      </Button>
    </div>
  );
}

export function RecordNotFound({ what, backTo, backLabel }: { what: string; backTo: "/orders" | "/customers"; backLabel: string }) {
  return (
    <div className="rounded-lg border bg-card p-8 text-center shadow-card">
      <h2 className="font-semibold">{what} not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">It may have been removed or the link is wrong.</p>
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link to={backTo}>{backLabel}</Link>
      </Button>
    </div>
  );
}

export function NoRecords() {
  return <div className="p-8 text-center text-sm text-muted-foreground">Nothing to show.</div>;
}

export function pageHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Kroonmolen ERP` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Kroonmolen ERP` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
