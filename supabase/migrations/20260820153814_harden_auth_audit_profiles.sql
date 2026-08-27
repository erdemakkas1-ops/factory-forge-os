-- Security hardening: deterministic signup roles, tamper-resistant audit logs,
-- and least-privilege profile reads.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
begin
  -- Serialize employee number allocation to avoid duplicate values during
  -- concurrent signups. User metadata is used only as display data, never for
  -- authorization.
  perform pg_advisory_xact_lock(hashtext('profiles_employee_no_sequence'));

  select coalesce(max(nullif(regexp_replace(employee_no, '\D', '', 'g'), '')::integer), 0) + 1
    into seq
    from public.profiles;

  insert into public.profiles (id, email, first_name, last_name, employee_no)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'PER-' || lpad(seq::text, 6, '0')
  );

  -- Never bootstrap an administrator from a public signup. Administrators
  -- must be assigned through a trusted service-role/dashboard operation.
  insert into public.user_roles (user_id, role)
  values (new.id, 'staff');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read_authorized"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.has_permission((select auth.uid()), 'employees.view')
  or public.has_permission((select auth.uid()), 'employees.manage')
  or public.has_permission((select auth.uid()), 'org.manage')
);

-- Audit rows are evidence and must never be supplied by an untrusted client.
drop policy if exists "audit_logs_insert" on public.audit_logs;
revoke insert on public.audit_logs from authenticated;

create or replace function public.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_row jsonb;
  new_row jsonb;
  row_id text;
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_id := coalesce(new_row->>'id', old_row->>'id');

  insert into public.audit_logs (
    user_id,
    action,
    module,
    record_id,
    old_data,
    new_data,
    description
  ) values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    row_id,
    old_row,
    new_row,
    format('%I tablosunda %s işlemi', tg_table_name, lower(tg_op))
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.capture_audit_log() from public, anon, authenticated;

-- Install the trigger only for tables present in the target project. This
-- keeps the migration compatible with installations that have not enabled all
-- factory modules yet.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'departments', 'units', 'profiles', 'user_roles', 'role_permissions',
    'product_categories', 'products', 'warehouses', 'warehouse_locations',
    'inventory', 'stock_movements', 'suppliers', 'purchase_orders',
    'purchase_order_items', 'machines', 'faults', 'maintenance_orders',
    'periodic_maintenance_plans', 'bill_of_materials',
    'bill_of_material_items', 'production_orders',
    'production_consumptions', 'production_outputs'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop trigger if exists audit_row_change on public.%I', table_name);
      execute format(
        'create trigger audit_row_change after insert or update or delete on public.%I for each row execute function public.capture_audit_log()',
        table_name
      );
    end if;
  end loop;
end;
$$;
