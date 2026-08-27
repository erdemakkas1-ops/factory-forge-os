-- ============================================================
-- 9. RLS
-- ============================================================

alter table public.bill_of_materials
    enable row level security;

alter table public.bill_of_material_items
    enable row level security;

alter table public.production_orders
    enable row level security;

alter table public.production_consumptions
    enable row level security;

alter table public.production_outputs
    enable row level security;


-- ============================================================
-- 10. BOM / REÇETE POLICIES
-- ============================================================

drop policy if exists
    "bom_read"
    on public.bill_of_materials;

create policy
    "bom_read"
on public.bill_of_materials
for select
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.view'
    )
    or
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


drop policy if exists
    "bom_manage"
    on public.bill_of_materials;

create policy
    "bom_manage"
on public.bill_of_materials
for all
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
)
with check (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


-- ============================================================
-- 11. BOM ITEMS POLICIES
-- ============================================================

drop policy if exists
    "bom_items_read"
    on public.bill_of_material_items;

create policy
    "bom_items_read"
on public.bill_of_material_items
for select
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.view'
    )
    or
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


drop policy if exists
    "bom_items_manage"
    on public.bill_of_material_items;

create policy
    "bom_items_manage"
on public.bill_of_material_items
for all
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
)
with check (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


-- ============================================================
-- 12. PRODUCTION ORDERS POLICIES
-- ============================================================

drop policy if exists
    "production_orders_read"
    on public.production_orders;

create policy
    "production_orders_read"
on public.production_orders
for select
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.view'
    )
    or
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


drop policy if exists
    "production_orders_manage"
    on public.production_orders;

create policy
    "production_orders_manage"
on public.production_orders
for all
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
)
with check (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


-- ============================================================
-- 13. PRODUCTION CONSUMPTIONS POLICIES
-- ============================================================

drop policy if exists
    "production_consumptions_read"
    on public.production_consumptions;

create policy
    "production_consumptions_read"
on public.production_consumptions
for select
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.view'
    )
    or
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


drop policy if exists
    "production_consumptions_manage"
    on public.production_consumptions;

create policy
    "production_consumptions_manage"
on public.production_consumptions
for all
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
)
with check (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


-- ============================================================
-- 14. PRODUCTION OUTPUTS POLICIES
-- ============================================================

drop policy if exists
    "production_outputs_read"
    on public.production_outputs;

create policy
    "production_outputs_read"
on public.production_outputs
for select
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.view'
    )
    or
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


drop policy if exists
    "production_outputs_manage"
    on public.production_outputs;

create policy
    "production_outputs_manage"
on public.production_outputs
for all
to authenticated
using (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
)
with check (
    public.has_permission(
        auth.uid(),
        'production.manage'
    )
);


-- ============================================================
-- 15. GRANTS
-- ============================================================

grant select, insert, update
on public.bill_of_materials
to authenticated;

grant select, insert, update
on public.bill_of_material_items
to authenticated;

grant select, insert, update
on public.production_orders
to authenticated;

grant select, insert, update
on public.production_consumptions
to authenticated;

grant select, insert, update
on public.production_outputs
to authenticated;


grant all
on public.bill_of_materials,
   public.bill_of_material_items,
   public.production_orders,
   public.production_consumptions,
   public.production_outputs
to service_role;


-- ============================================================
-- END
-- ============================================================