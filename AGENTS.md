<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Back-office pages live under `src/routes/_authenticated/` (client-only gate, redirects to `/auth`); `/` only redirects to `/dashboard`. Why: the whole app is staff-only.
- Data is read with the browser client through `queryOptions` in `src/lib/queries.ts`, primed in route loaders and read with `useSuspenseQuery`. Why: RLS allows reads only for the viewer or admin role (pending users see nothing), so the browser client is safe and no server functions are needed.
- Business rules (overdue, late, shipping today, stock status) live as pure functions in `src/lib/erp-rules.ts` with tests in `src/test/erp-rules.test.ts`. Why: one definition shared by dashboard and lists.
- Invoice "overdue" is derived from the due date at read time, not stored by a job. Why: avoids scheduled work and stays correct as days pass.
- Order/shipment/invoice status changes are logged to `order_activity` by database triggers. Why: the log stays complete whatever client makes the change.
- List pages keep search, sort and filters in the URL via `listSearch()` and render with the shared `DataTable`. Why: shareable, linkable filtered views (dashboard links into them).
- Status labels and badge colours come from `src/lib/status.ts` and badge variants in `src/components/ui/badge.tsx`. Why: consistent colours across modules.
- Records use human-readable text primary keys (CUST-, PRD-, SO-, SHP-, INV-). Why: stable IDs for a future API.
- Roles live in `public.user_roles` (enum viewer/admin); RLS uses `public.has_role(app_role)` bound to `auth.uid()`, and ID-taking role helpers do not exist. Sign-ups get no role (pending); SELECT requires viewer/admin and UPDATE requires admin. Only admin-only `admin_*` RPCs approve/revoke viewers (never grant admin); UI role hints do not enforce access. Why: enforce data permissions without exposing other accounts' roles.
- Demo reset is the admin-only `public.reset_demo_data()` RPC, copying a private `demo_seed` snapshot (anchored 2026-11-17) with every date shifted to today; `app.seeding` suppresses the order-created trigger. Why: same exceptions, always relative to today.
- The read-only REST API lives in `src/routes/api/v1/` (thin server routes) with logic in `src/lib/api/*.server.ts`; GET only, `Authorization: Bearer` checked timing-safe against the `ERP_API_KEY` secret, explicit columns only, identical 404 for unknown/malformed IDs; contract in `docs/openapi.yaml`. Why: external agents need ERP data without a staff login, and the service-role client must stay server-side.
- The MCP server in `mcp-server/` is a standalone Bun package (own `package.json`/lockfile, excluded from the app build, root tsconfig/vitest and eslint) that only calls the REST API v1 with `ERP_API_BASE_URL`/`ERP_API_KEY` from the environment; no database access, read-only tools, safe fixed error messages, key never logged or returned. `.mcp.json` uses `${VAR}` expansion only. Why: Claude can query the ERP without a second data path or committed secrets.
