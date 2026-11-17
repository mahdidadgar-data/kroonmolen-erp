import { createFileRoute } from "@tanstack/react-router";

// Catch-all for unknown /api/v1 paths: JSON 404 (after the API key check) instead of the HTML app page.
async function handle({ request, params }: { request: Request; params: Record<string, string> }) {
  const { handleApiRequest } = await import("@/lib/api/v1.server");
  return handleApiRequest(request, "unknown", params);
}

export const Route = createFileRoute("/api/v1/$")({
  server: { handlers: { GET: handle, HEAD: handle, ANY: handle } },
});
