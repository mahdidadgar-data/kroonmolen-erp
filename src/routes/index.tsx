import { createFileRoute, redirect } from "@tanstack/react-router";

// The back office has no public landing page: / forwards to the dashboard,
// which sends signed-out visitors to the sign-in page.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kroonmolen ERP — Back office" },
      { name: "description", content: "Orders, shipments, stock and invoices for Kroonmolen Feeds B.V. (fictional demo)." },
      { property: "og:title", content: "Kroonmolen ERP — Back office" },
      { property: "og:description", content: "Orders, shipments, stock and invoices for Kroonmolen Feeds B.V. (fictional demo)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
