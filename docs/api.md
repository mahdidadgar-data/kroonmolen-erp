# Read-only API (v1)

External systems and AI agents can query ERP data through a small read-only REST API.
The full contract is in [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0.3, importable into
Salesforce External Services).

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/v1/orders/{orderId}` | Order status, lines, shipments, invoices |
| GET | `/api/v1/customers/{customerId}/orders` | The customer's orders, newest first |
| GET | `/api/v1/products/{productId}/stock` | Stock per warehouse and stock status (`productId` is the SKU, e.g. `PRD-2001`) |
| GET | `/api/v1/shipments/{shipmentId}` | Status, planned/actual date, delay reason |
| GET | `/api/v1/invoices/{invoiceId}` | Amounts, due date, status (overdue is derived from the due date) |

```sh
curl -H "Authorization: Bearer $ERP_API_KEY" https://<your-app>/api/v1/orders/SO-24001
```

## Behaviour

- Every request needs `Authorization: Bearer <key>`; the key is compared timing-safe against `ERP_API_KEY`. Missing or wrong key → `401 {"error":"unauthorized"}`.
- Only `GET` is supported; any other method → `405 {"error":"method_not_allowed"}`.
- Unknown and malformed IDs both return the same `404 {"error":"not_found"}`, so the API does not reveal which IDs exist.
- Errors are always `{"error":"<code>"}`; unexpected failures return `500 {"error":"server_error"}` without details.
- Derived values (`is_late`, invoice `overdue`, `stock_status`) use the same rules as the back office ([`src/lib/erp-rules.ts`](../src/lib/erp-rules.ts)).

Code: route files in [`src/routes/api/v1/`](../src/routes/api/v1/), logic in [`src/lib/api/`](../src/lib/api/) (`*.server.ts`), tests in [`src/test/api-v1.test.ts`](../src/test/api-v1.test.ts).

## Setting `ERP_API_KEY` in Lovable

1. Generate a long random key, e.g. `openssl rand -base64 32` (or `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
2. In the Lovable editor, add a secret named `ERP_API_KEY` with that value (Cloud → Secrets, or ask Lovable in chat to add the secret; it opens a secure input). Never commit the key or put it in a `VITE_` variable.
3. Publish/redeploy so the server picks it up. Until the secret is set, the API refuses every request with `500 {"error":"server_error"}`.
4. Give the key to the consuming system only (for Salesforce: store it in an External Credential / Named Credential that sends the `Authorization: Bearer …` header).

## Key rotation

To rotate the key, set a new value and update the consumers at the same time; there is no grace period for the old key.

## Security notes

- The API reads with the Supabase **service-role key on the server**, which **bypasses RLS**. The key never reaches the browser: it is only loaded inside server route handlers in `*.server.ts` modules.
- This is mitigated by: GET-only handlers (no writes), explicit column lists and field-by-field responses (no `select *`, no internal columns such as notes or timestamps), strict ID formats, and the API key check before anything else runs.
- Recommended next step: replace the service-role client with a **dedicated read-only database role** that can `SELECT` only the tables and columns the API exposes, so a bug in the API cannot read or change anything else.
- There is **no rate limiting yet**. A leaked key allows unlimited reads until it is rotated; add rate limiting (per key / per IP) before exposing the API more widely.
- One shared key for all consumers: there is no per-client identity or audit trail of API calls yet.

## MCP server

The [MCP server](../mcp-server/README.md) is a read-only client of this API; it has no database access of its own.
