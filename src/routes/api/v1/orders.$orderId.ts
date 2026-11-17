import { createFileRoute } from "@tanstack/react-router";

// Read-only API endpoint (server route, no UI). Logic lives in src/lib/api/v1.server.ts.
// GET is served; HEAD and every other method get 405 (ANY catches them).
async function handle({ request, params }: { request: Request; params: Record<string, string> }) {
  const { handleApiRequest } = await import("@/lib/api/v1.server");
  return handleApiRequest(request, "order", params);
}

export const Route = createFileRoute("/api/v1/orders/$orderId")({
  server: { handlers: { GET: handle, HEAD: handle, ANY: handle } },
});
