-- Organization onboarding without the service-role key.
--
-- Signed-in users cannot insert organizations or memberships directly (no RLS insert policies),
-- so the privileged step runs in a SECURITY DEFINER helper in the unexposed `app_private` schema,
-- reached only through the public SECURITY INVOKER wrapper. The helper creates the caller's
-- profile if it is missing (accounts created before the schema existed), then the organization
-- and the caller's owner membership, in one transaction.
-- Errors: 42501 not authenticated, 22023 invalid name, 23505 already in an organization.

create function app_private.create_organization(p_name text)
returns table (id uuid, name text, role public.organization_member_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception 'organization name must be 2-120 characters' using errcode = '22023';
  end if;

  -- Serialize concurrent requests from the same user so only one organization is created.
  perform pg_advisory_xact_lock(hashtextextended('create_organization:' || v_user_id::text, 0));
  if exists (select 1 from public.organization_members where user_id = v_user_id) then
    raise exception 'you already belong to an organization' using errcode = '23505';
  end if;

  insert into public.profiles (id, email, display_name)
  select users.id, users.email, nullif(btrim(users.raw_user_meta_data ->> 'full_name'), '')
  from auth.users as users
  where users.id = v_user_id
  on conflict on constraint profiles_pkey do nothing;

  insert into public.organizations (name, created_by)
  values (v_name, v_user_id)
  returning organizations.id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, v_user_id, 'owner');

  return query select v_organization_id, v_name, 'owner'::public.organization_member_role;
end;
$$;

revoke all on function app_private.create_organization(text) from public, anon;
grant execute on function app_private.create_organization(text) to authenticated;

create function public.create_organization(p_name text)
returns table (id uuid, name text, role public.organization_member_role)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.create_organization(p_name);
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- Event trigger function from the project setup; it never needs to be called through the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
