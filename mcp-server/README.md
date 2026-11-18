# Kroonmolen ERP MCP server

A read-only [MCP](https://modelcontextprotocol.io) server that lets Claude (or any MCP client)
query Kroonmolen ERP data. It calls the live **REST API v1** (`docs/openapi.yaml`) with the
`ERP_API_KEY` bearer token. It has no database access and cannot change anything.

This folder is a standalone Bun package. It is not part of the app build, the root
`tsconfig`/vitest/eslint, or Lovable.

## Tools

| Tool | Input | Returns |
|---|---|---|
| `get_order` | `order_id` (`SO-24001`) | Status, dates, `is_late`, totals, lines, shipments, invoices |
| `list_customer_orders` | `customer_id` (`CUST-1001`) | The customer's orders, newest first (summaries) |
| `get_product_stock` | `product_id` (`PRD-2001`) | Total and per-warehouse stock, stock status |
| `get_shipment` | `shipment_id` (`SHP-30001`) | Status, carrier, planned/actual date, delay reason |
| `get_invoice` | `invoice_id` (`INV-50001`) | Amounts, VAT, due/paid date, status (overdue derived), days overdue |

All tools are annotated `readOnlyHint: true`. IDs are validated against the same patterns as
the API (`PREFIX-<1..10 digits>`), so malformed input is rejected before any request is sent.

Errors are returned as short, fixed messages; API response bodies are never passed through:

| Situation | Message |
|---|---|
| 404 | `Not found: no <thing> with ID <id>.` |
| 401 / 403 | `Unauthorized: the ERP API rejected the API key. Check ERP_API_KEY.` |
| 5xx | `ERP server error. Try again later.` |
| Timeout (default 10 s) | `The ERP API did not respond in time. Try again later.` |
| DNS / network / redirect | `Could not reach the ERP API. Check ERP_API_BASE_URL and the network connection.` |
| Anything else | `Unexpected response from the ERP API.` |

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ERP_API_BASE_URL` | yes | Published app URL, e.g. `https://your-app.lovable.app`. Must be `https://` (`http://` only for localhost). |
| `ERP_API_KEY` | yes | The same value as the `ERP_API_KEY` secret in Lovable. |
| `ERP_API_TIMEOUT_MS` | no | Request timeout in ms (100–120000, default 10000). |

The key is only ever read from the environment. Never put it in `.mcp.json`, a `.env` file
inside the repo, or a command line.

### Windows (PowerShell): set user environment variables

Run once in PowerShell. The key is read with a hidden prompt, so it does not end up in your
PowerShell history:

```powershell
[Environment]::SetEnvironmentVariable("ERP_API_BASE_URL", "https://your-app.lovable.app", "User")

$secure = Read-Host "ERP_API_KEY" -AsSecureString
[Environment]::SetEnvironmentVariable("ERP_API_KEY", [Net.NetworkCredential]::new("", $secure).Password, "User")
Remove-Variable secure
```

**Then fully restart VS Code.** Close every VS Code window (File → Exit), and start it again.
Reloading the window or opening a new terminal is not enough. VS Code reads the environment
once at startup and passes it to its terminals and to Claude Code. A VS Code process that was
already running does not see the new variables.

Check in a new PowerShell terminal (prints only `True`/`False`, not the value):

```powershell
[bool]$env:ERP_API_BASE_URL; [bool]$env:ERP_API_KEY
```

To rotate the key, run the two `$secure` lines again with the new value. To remove the
variables, set them to `$null` the same way.

### macOS / Linux

Add to your shell profile (e.g. `~/.zshrc`) and open a new terminal:

```sh
export ERP_API_BASE_URL="https://your-app.lovable.app"
export ERP_API_KEY="..."   # or load it from your password manager / keychain
```

## Install

```sh
cd mcp-server
bun install
```

## Use in Claude Code

The repo root contains `.mcp.json`, which registers the server as `kroonmolen-erp`:

```json
"command": "bun",
"args": ["mcp-server/src/index.ts"],
"env": { "ERP_API_BASE_URL": "${ERP_API_BASE_URL:-}", "ERP_API_KEY": "${ERP_API_KEY:-}" }
```

Claude Code fills in `${...}` from your environment when it starts the server, so no secret is
committed. If a variable is missing, the server exits with `ERP_API_KEY is not set.` (or the
base URL equivalent) instead of failing silently.

1. Set the environment variables (see above) and run `bun install` in `mcp-server/`.
2. Start Claude Code from the **repo root** (the `args` path is relative to it).
3. Approve the project MCP server when Claude Code asks (project `.mcp.json` servers need a
   one-time approval).
4. Run `/mcp`: `kroonmolen-erp` should show as connected with 5 tools.
5. Ask, for example:
   - "What is the status of order SO-24042, and is it late?"
   - "Which orders does customer CUST-1006 have, and which are late?"
   - "Is PRD-2008 low on stock in any warehouse?"
   - "Why is shipment SHP-30042 delayed?"
   - "Is invoice INV-50039 overdue, and by how many days?"

If `/mcp` shows the server as failed, open its details. The first stderr line says what is
wrong (for example a missing variable). On Windows, the usual cause is that VS Code was not
fully restarted after setting the variables.

## Test with the MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a browser UI for
calling tools by hand. From `mcp-server/`, in a terminal where the variables are set:

```sh
bunx @modelcontextprotocol/inspector bun src/index.ts
```

It opens the Inspector in your browser (the terminal prints the URL with a session token).
Then:

1. Click **Connect**. Transport is `STDIO`, command `bun`, args `src/index.ts`.
2. If the connection fails with `ERP_API_KEY is not set`, the Inspector did not pass your shell
   environment through. Add `ERP_API_BASE_URL` and `ERP_API_KEY` under **Environment Variables**
   in the left panel and connect again. They stay in the browser session only.
3. Open **Tools → List Tools**. You should see the five tools with their descriptions and
   read-only annotations.
4. Call `get_order` with `SO-24042`. You should get the order JSON.
5. Try `SO-ABC`. You should get a validation error, and no request is sent to the API.
   Try `SO-99999999`. You should get `Not found: no sales order with ID SO-99999999.`

## Smoke test against the live API

```sh
cd mcp-server
bun run smoke
```

This starts the real server over stdio and calls each tool once (`SO-24042`, `CUST-1006`,
`PRD-2008`, `SHP-30042`, `INV-50039`). It prints only the tool name and `ok` or `error`. It never
prints data or the key. The exit code is non-zero if any call fails. The IDs come from the demo
seed; after a demo reset they still exist.

```
get_order              ok
list_customer_orders   ok
get_product_stock      ok
get_shipment           ok
get_invoice            ok
```

To see why a call fails, use the Inspector (above).

## Unit tests

```sh
bun run test        # vitest, fetch mocked, no network
bun run typecheck
```

The tests cover:

- Config validation
- ID validation for every tool, including path-traversal and query-injection attempts, with
  no request sent
- Mapping each HTTP status, timeouts and network errors to the safe messages
- That the key is sent as `Authorization: Bearer`
- That the key never appears in tool results, error results, logs or the tool listing, even
  when the mocked API echoes it back

## Security notes

- **Read-only by construction.** Only `GET` requests to the five v1 endpoints. There is no
  database client and no write path.
- **The key stays in the environment.** It is sent only in the `Authorization` header. It is
  never logged, never in an error message, and redacted from tool output as a defence in depth.
  Redirects are refused, so the header cannot follow a redirect to another host.
- **Logs go to stderr only.** stdout is the MCP protocol. Log lines contain the tool name and
  an error kind, never the ID data, response bodies or headers.
- **Everything the API returns is passed to the model.** The API already limits fields to an
  explicit column list. Anyone who can use this MCP server can read all orders, stock, shipments
  and invoices.
