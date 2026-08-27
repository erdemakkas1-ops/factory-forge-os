-- Keep role reads independent from user_roles RLS policy changes and repair
-- legacy profiles whose role row was never created. Existing roles (including
-- administrator roles) are never replaced or downgraded.

create or replace function public.current_user_roles()
returns setof public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ur.role
  from public.user_roles as ur
  join public.profiles as p on p.id = ur.user_id
  where ur.user_id = (select auth.uid())
    and p.is_active = true;
$$;

revoke all on function public.current_user_roles() from public, anon;
grant execute on function public.current_user_roles() to authenticated;

insert into public.user_roles (user_id, role)
select p.id, 'staff'::public.app_role
from public.profiles as p
where p.is_active = true
  and not exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = p.id
  )
on conflict (user_id, role) do nothing;
