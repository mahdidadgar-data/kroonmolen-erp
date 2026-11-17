// Live database regression checks: run with the project's Lovable Cloud connection.
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type ResultRow = {
  old_role_removed?: boolean;
  old_staff_removed?: boolean;
  definition?: string;
  staff_can_check?: boolean;
  anon_can_check?: boolean;
  cmd?: string;
  tablename?: string;
  qual?: string;
  with_check?: string;
  callable?: boolean;
  anon_callable?: boolean;
  proname?: string;
  signup?: string;
  staff_seed?: boolean;
  anon_seed?: boolean;
};

function query(sql: string): ResultRow[] {
  const result = execFileSync("lovable", ["supabase", "query", "--json", sql], { encoding: "utf8" });
  return JSON.parse(result).rows;
}

describe("Database role access", () => {
  it("checks only auth.uid() and cannot accept another user's ID", () => {
    const [row] = query(`SELECT
      to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL AS old_role_removed,
      to_regprocedure('public.is_staff(uuid)') IS NULL AS old_staff_removed,
      pg_get_functiondef('public.has_role(public.app_role)'::regprocedure) AS definition,
      has_function_privilege('authenticated','public.has_role(public.app_role)','EXECUTE') AS staff_can_check,
      has_function_privilege('anon','public.has_role(public.app_role)','EXECUTE') AS anon_can_check`);
    expect(row?.old_role_removed).toBe(true);
    expect(row?.old_staff_removed).toBe(true);
    expect(row?.definition).toContain("user_id = auth.uid()");
    expect(row?.staff_can_check).toBe(true);
    expect(row?.anon_can_check).toBe(false);
  }, 30000);

  it("keeps all nine data read policies viewer/admin only and all three writes admin only", () => {
    const rows = query(`SELECT tablename, cmd, qual, with_check FROM pg_policies
      WHERE schemaname='public' AND tablename <> 'user_roles' ORDER BY tablename, cmd`);
    const reads = rows.filter((r) => r.cmd === "SELECT");
    const writes = rows.filter((r) => r.cmd === "UPDATE");
    expect(reads.map((r) => r.tablename)).toEqual([
      "customers", "inventory", "invoices", "order_activity", "products",
      "sales_order_lines", "sales_orders", "shipments", "warehouses",
    ]);
    for (const row of reads) expect(row.qual).toBe("(has_role('viewer'::app_role) OR has_role('admin'::app_role))");
    expect(writes.map((r) => r.tablename)).toEqual(["invoices", "sales_orders", "shipments"]);
    for (const row of writes) {
      expect(row.qual).toBe("has_role('admin'::app_role)");
      expect(row.with_check).toBe("has_role('admin'::app_role)");
    }
  }, 30000);

  it("preserves admin-only Users functions and reset with current-user authorization", () => {
    const rows = query(`SELECT p.proname, pg_get_functiondef(p.oid) AS definition,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS callable,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_callable
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN
      ('admin_list_users','admin_approve_viewer','admin_revoke_access','reset_demo_data')`);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.definition).toContain("IF NOT public.has_role('admin'::public.app_role) THEN");
      expect(row.callable).toBe(true);
      expect(row.anon_callable).toBe(false);
    }
    const revoke = rows.find((r) => r.proname === "admin_revoke_access");
    expect(revoke?.definition).toContain("user_id = _user_id AND role = 'admin'::public.app_role");
  }, 30000);

  it("keeps pending signups without roles and demo_seed private", () => {
    const [row] = query(`SELECT
      pg_get_functiondef('public.handle_new_user_role()'::regprocedure) AS signup,
      has_schema_privilege('authenticated','demo_seed','USAGE') AS staff_seed,
      has_schema_privilege('anon','demo_seed','USAGE') AS anon_seed`);
    expect(row?.signup).not.toContain("INSERT INTO");
    expect(row?.staff_seed).toBe(false);
    expect(row?.anon_seed).toBe(false);
  }, 30000);
});