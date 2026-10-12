create type public.document_status as enum (
  'draft',
  'sent',
  'in_progress',
  'completed',
  'declined',
  'cancelled',
  'expired'
);

create type public.recipient_status as enum (
  'waiting',
  'sent',
  'viewed',
  'signed',
  'declined'
);

create type public.organization_member_role as enum ('owner', 'admin', 'member');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_by uuid not null references public.profiles (id) on delete restrict,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  roles jsonb not null default '[]'::jsonb,
  fields jsonb not null default '[]'::jsonb,
  variables jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  status public.document_status not null default 'draft',
  created_by uuid not null references public.profiles (id) on delete restrict,
  version integer not null default 1 check (version > 0),
  sent_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  original_pdf_path text,
  final_pdf_path text,
  final_pdf_sha256 text check (final_pdf_sha256 is null or final_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer not null check (page_count between 1 and 100),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  version_number integer not null check (version_number > 0),
  original_pdf_path text,
  final_pdf_path text,
  final_pdf_sha256 text check (final_pdf_sha256 is null or final_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer not null check (page_count between 1 and 100),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (document_id, version_number),
  unique (document_id, id),
  foreign key (organization_id, document_id)
    references public.documents (organization_id, id) on delete cascade
);

create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  role text not null check (char_length(btrim(role)) between 1 and 80),
  signing_order integer not null check (signing_order > 0),
  delivery text not null default 'email' check (delivery in ('email', 'link')),
  status public.recipient_status not null default 'waiting',
  signing_token_hash text unique check (signing_token_hash is null or signing_token_hash ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, id),
  foreign key (organization_id, document_id)
    references public.documents (organization_id, id) on delete cascade
);

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  recipient_id uuid not null,
  type text not null check (type in ('signature', 'initials', 'date', 'text', 'checkbox')),
  page integer not null check (page > 0),
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  w double precision not null check (w > 0 and w <= 1),
  h double precision not null check (h > 0 and h <= 1),
  required boolean not null default true,
  label text check (label is null or char_length(label) <= 160),
  source text not null default 'manual' check (source in ('manual', 'anchor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, document_id)
    references public.documents (organization_id, id) on delete cascade,
  foreign key (document_id, recipient_id)
    references public.recipients (document_id, id) on delete cascade,
  check (x + w <= 1.001 and y + h <= 1.001)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  recipient_id uuid,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'recipient', 'system', 'api_key')),
  event_type text not null check (
    event_type in (
      'document.created',
      'document.fields_updated',
      'document.sent',
      'document.viewed',
      'document.signed',
      'document.completed',
      'document.cancelled',
      'document.declined',
      'document.expired',
      'recipient.viewed',
      'recipient.signed',
      'recipient.declined'
    )
  ),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, document_id)
    references public.documents (organization_id, id) on delete cascade,
  foreign key (document_id, recipient_id)
    references public.recipients (document_id, id) on delete set null (recipient_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);
create index templates_organization_updated_idx on public.templates (organization_id, updated_at desc);
create index documents_organization_updated_idx on public.documents (organization_id, updated_at desc);
create index documents_created_by_idx on public.documents (created_by);
create index document_versions_organization_document_idx on public.document_versions (organization_id, document_id);
create index recipients_document_order_idx on public.recipients (document_id, signing_order);
create index recipients_email_idx on public.recipients (lower(email));
create index fields_document_page_idx on public.fields (document_id, page);
create index fields_recipient_idx on public.fields (recipient_id);
create index audit_events_document_created_idx on public.audit_events (document_id, created_at desc);
create index audit_events_organization_created_idx on public.audit_events (organization_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger templates_set_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create trigger recipients_set_updated_at
before update on public.recipients
for each row execute function public.set_updated_at();

create trigger fields_set_updated_at
before update on public.fields
for each row execute function public.set_updated_at();

create function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
  );
$$;

create function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  );
$$;

create function public.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members as target_membership
      join public.organization_members as current_membership
        on current_membership.organization_id = target_membership.organization_id
      where target_membership.user_id = target_user_id
        and current_membership.user_id = (select auth.uid())
    );
$$;

create function public.is_organization_member_for_storage(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  organization_folder text;
begin
  organization_folder := (storage.foldername(object_name))[1];
  if organization_folder is null or organization_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_organization_member(organization_folder::uuid);
end;
$$;

create function public.is_organization_admin_for_storage(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  organization_folder text;
begin
  organization_folder := (storage.foldername(object_name))[1];
  if organization_folder is null or organization_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_organization_admin(organization_folder::uuid);
end;
$$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.is_organization_admin(uuid) from public;
revoke all on function public.can_view_profile(uuid) from public;
revoke all on function public.is_organization_member_for_storage(text) from public;
revoke all on function public.is_organization_admin_for_storage(text) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.is_organization_member_for_storage(text) to authenticated;
grant execute on function public.is_organization_admin_for_storage(text) to authenticated;

create function public.prevent_audit_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events are append-only';
end;
$$;

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.prevent_audit_event_mutation();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.templates enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.recipients enable row level security;
alter table public.fields enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_shared_org"
on public.profiles for select to authenticated
using (public.can_view_profile(id));

create policy "profiles_insert_self"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "organizations_select_member"
on public.organizations for select to authenticated
using (public.is_organization_member(id));

create policy "organization_members_select_member"
on public.organization_members for select to authenticated
using (public.is_organization_member(organization_id));

create policy "templates_select_member"
on public.templates for select to authenticated
using (public.is_organization_member(organization_id));

create policy "templates_insert_member"
on public.templates for insert to authenticated
with check (
  public.is_organization_member(organization_id)
  and created_by = (select auth.uid())
);

create policy "templates_update_member"
on public.templates for update to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "templates_delete_admin"
on public.templates for delete to authenticated
using (public.is_organization_admin(organization_id));

create policy "documents_select_member"
on public.documents for select to authenticated
using (public.is_organization_member(organization_id));

create policy "documents_insert_member"
on public.documents for insert to authenticated
with check (
  public.is_organization_member(organization_id)
  and created_by = (select auth.uid())
);

create policy "documents_update_member"
on public.documents for update to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "document_versions_select_member"
on public.document_versions for select to authenticated
using (public.is_organization_member(organization_id));

create policy "document_versions_insert_member"
on public.document_versions for insert to authenticated
with check (
  public.is_organization_member(organization_id)
  and created_by = (select auth.uid())
);

create policy "recipients_select_member"
on public.recipients for select to authenticated
using (public.is_organization_member(organization_id));

create policy "recipients_insert_member"
on public.recipients for insert to authenticated
with check (public.is_organization_member(organization_id));

create policy "recipients_update_member"
on public.recipients for update to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "recipients_delete_admin"
on public.recipients for delete to authenticated
using (public.is_organization_admin(organization_id));

create policy "fields_select_member"
on public.fields for select to authenticated
using (public.is_organization_member(organization_id));

create policy "fields_insert_member"
on public.fields for insert to authenticated
with check (public.is_organization_member(organization_id));

create policy "fields_update_member"
on public.fields for update to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "fields_delete_member"
on public.fields for delete to authenticated
using (public.is_organization_member(organization_id));

create policy "audit_events_select_member"
on public.audit_events for select to authenticated
using (public.is_organization_member(organization_id));

create policy "audit_events_insert_member"
on public.audit_events for insert to authenticated
with check (
  public.is_organization_member(organization_id)
  and actor_type = 'user'
  and actor_user_id = (select auth.uid())
);

grant select, insert, update on public.profiles to authenticated;
grant select on public.organizations, public.organization_members to authenticated;
grant select, insert, update, delete on public.templates to authenticated;
grant select, insert, update on public.documents to authenticated;
grant select, insert on public.document_versions to authenticated;
grant select, insert, update, delete on public.recipients, public.fields to authenticated;
grant select, insert on public.audit_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('original-pdfs', 'original-pdfs', false, 26214400, array['application/pdf']),
  ('signed-pdfs', 'signed-pdfs', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "original_pdfs_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'original-pdfs'
  and public.is_organization_member_for_storage(name)
);

create policy "original_pdfs_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'original-pdfs'
  and public.is_organization_member_for_storage(name)
);

create policy "original_pdfs_update_admin"
on storage.objects for update to authenticated
using (
  bucket_id = 'original-pdfs'
  and public.is_organization_admin_for_storage(name)
)
with check (
  bucket_id = 'original-pdfs'
  and public.is_organization_admin_for_storage(name)
);

create policy "original_pdfs_delete_admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'original-pdfs'
  and public.is_organization_admin_for_storage(name)
);

create policy "signed_pdfs_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'signed-pdfs'
  and public.is_organization_member_for_storage(name)
);

create policy "signed_pdfs_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'signed-pdfs'
  and public.is_organization_member_for_storage(name)
);

create policy "signed_pdfs_update_admin"
on storage.objects for update to authenticated
using (
  bucket_id = 'signed-pdfs'
  and public.is_organization_admin_for_storage(name)
)
with check (
  bucket_id = 'signed-pdfs'
  and public.is_organization_admin_for_storage(name)
);

create policy "signed_pdfs_delete_admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'signed-pdfs'
  and public.is_organization_admin_for_storage(name)
);
