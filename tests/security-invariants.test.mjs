import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public signup never bootstraps an administrator", async () => {
  const migration = await read("supabase/migrations/20260820153814_harden_auth_audit_profiles.sql");
  assert.match(migration, /values \(new\.id, 'staff'\)/i);
  assert.doesNotMatch(migration, /values \(new\.id, 'admin'\)/i);
});

test("authenticated clients cannot insert audit evidence", async () => {
  const migration = await read("supabase/migrations/20260820153814_harden_auth_audit_profiles.sql");
  assert.match(migration, /revoke insert on public\.audit_logs from authenticated/i);
  assert.match(migration, /create trigger audit_row_change/i);
});

test("server responses include baseline browser security headers", async () => {
  const server = await read("src/server.ts");
  for (const header of [
    "content-security-policy",
    "permissions-policy",
    "referrer-policy",
    "x-content-type-options",
    "x-frame-options",
  ]) {
    assert.match(server, new RegExp(`\\"${header}\\"`, "i"));
  }
});

test("public signup UI is disabled and employee creation uses invitations", async () => {
  const login = await read("src/routes/giris.tsx");
  const employees = await read("src/routes/_authenticated/personel.tsx");
  assert.doesNotMatch(login, /auth\.signUp/i);
  assert.match(employees, /"invite-employee"/);
  assert.doesNotMatch(employees, /form\.password/);
});

test("inactive users are rejected by database authorization helpers", async () => {
  const migration = await read("supabase/migrations/20260820160258_enforce_active_users.sql");
  assert.match(migration, /create or replace function public\.is_active_user/i);
  assert.match(migration, /and public\.is_active_user\(\)/i);
  assert.match(migration, /as restrictive for all to authenticated/i);
});

test("sign out clears cached data and returns to login", async () => {
  const header = await read("src/components/layout/app-header.tsx");
  assert.match(header, /await signOut\(\)/);
  assert.match(header, /queryClient\.clear\(\)/);
  assert.match(header, /to: "\/giris"/);
  assert.match(header, /replace: true/);
});

test("KVKK notice and optional explicit consent remain separate", async () => {
  const kvkk = await read("src/components/legal/kvkk-notices.tsx");
  assert.match(kvkk, /KVKK Aydınlatma Metni/);
  assert.match(kvkk, /İsteğe Bağlı Açık Rıza Metni/);
  assert.match(kvkk, /giriş yapmak için zorunlu değildir/i);
  assert.match(kvkk, /Açık rızayı geri al/);
  assert.match(kvkk, /KVKK_TEXT_VERSION/);
});

test("packaged app checks and installs signed release updates", async () => {
  const electronMain = await read("electron/main.cjs");
  const releaseWorkflow = await read(".github/workflows/release-windows.yml");
  assert.match(electronMain, /autoUpdater\.autoDownload\s*=\s*true/);
  assert.match(electronMain, /autoUpdater\.autoInstallOnAppQuit\s*=\s*true/);
  assert.match(electronMain, /UPDATE_CHECK_INTERVAL_MS/);
  assert.match(electronMain, /quitAndInstall/);
  assert.match(releaseWorkflow, /latest|release:win|GH_TOKEN/i);
});

test("role loading uses the current-user RPC instead of direct role-table reads", async () => {
  const authHook = await read("src/hooks/use-auth.tsx");
  const repair = await read("supabase/migrations/20260820213205_repair_missing_admin_role.sql");

  assert.match(authHook, /\.rpc\(\s*"current_user_roles"/);
  assert.doesNotMatch(authHook, /\.from\(\s*"user_roles"\s*\)\s*\.select\(\s*"role"/);
  assert.match(repair, /where ur\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(
    repair,
    /grant execute on function public\.current_user_roles\(\) to authenticated/i,
  );
});

test("profile self-service cannot change administrative fields", async () => {
  const migration = await read("supabase/migrations/20260822215703_pentest_workflow_hardening.sql");
  const activeUsers = await read("supabase/migrations/20260820160258_enforce_active_users.sql");

  assert.match(migration, /profile_protected_fields_unchanged/i);
  for (const column of [
    "is_active",
    "employee_no",
    "department_id",
    "unit_id",
    "manager_id",
    "hired_at",
  ]) {
    assert.match(migration, new RegExp(`current_profile\\.${column}`, "i"));
  }
  assert.match(activeUsers, /'profiles',\s*'departments'/i);
});

test("production status transitions are RPC-only", async () => {
  const route = await read("src/routes/_authenticated/uretim-emirleri.tsx");
  const migration = await read("supabase/migrations/20260822215703_pentest_workflow_hardening.sql");

  assert.doesNotMatch(route, /status:\s*values\.status/);
  assert.doesNotMatch(route, /name="status"/);
  assert.match(route, /"start_production_order"/);
  assert.match(route, /"complete_production_order"/);
  assert.match(migration, /revoke insert, update on public\.production_orders/i);
});

test("purchase cancellation and status changes are server-controlled", async () => {
  const route = await read("src/routes/_authenticated/satinalma-siparisleri.tsx");
  const migration = await read("supabase/migrations/20260822215703_pentest_workflow_hardening.sql");

  assert.doesNotMatch(route, /name="status"/);
  assert.match(route, /\.rpc\(\s*"cancel_purchase_order"/);
  assert.doesNotMatch(route, /\.update\(\{[\s\S]{0,200}status:\s*"cancelled"/);
  assert.match(migration, /create or replace function public\.cancel_purchase_order/i);
  assert.match(migration, /item\.received_quantity > 0/i);
});

test("stock entry uses atomic partial-index upserts", async () => {
  const stockRpc = await read("supabase/migrations/20260817_phase2_stock_rpc.sql");
  const stockEntry = stockRpc.split(/create or replace function public\.stock_exit/i)[0];

  assert.match(
    stockEntry,
    /on conflict \(product_id, warehouse_id\)\s*where location_id is null\s*do update/i,
  );
  assert.match(
    stockEntry,
    /on conflict \(product_id, warehouse_id, location_id\)\s*where location_id is not null\s*do update/i,
  );
  assert.doesNotMatch(stockEntry, /if not found then/i);
});
