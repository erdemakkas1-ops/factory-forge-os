-- Reject all privileged and operational access for disabled profiles.
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_active = true);
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select _user_id = (select auth.uid()) and public.is_active_user()
    and exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.has_permission(_user_id uuid, _permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select _user_id = (select auth.uid()) and public.is_active_user()
    and exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role = ur.role
      where ur.user_id = _user_id and rp.permission_key = _permission
    );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.has_permission(uuid, text) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'departments', 'units', 'product_categories', 'products', 'warehouses',
    'warehouse_locations', 'inventory', 'stock_movements', 'suppliers',
    'purchase_orders', 'purchase_order_items', 'machines', 'faults',
    'maintenance_orders', 'periodic_maintenance_plans', 'bill_of_materials',
    'bill_of_material_items', 'production_orders',
    'production_consumptions', 'production_outputs'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists active_users_only on public.%I', table_name);
      execute format(
        'create policy active_users_only on public.%I as restrictive for all to authenticated using (public.is_active_user()) with check (public.is_active_user())',
        table_name
      );
    end if;
  end loop;
end;
$$;
