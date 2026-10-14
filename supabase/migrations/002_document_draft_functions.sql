-- Draft document operations as single-transaction functions.
--
-- The database only lets signed-in users insert drafts, recipients and fields (RLS, draft-only).
-- Status changes, document updates and audit events are reserved for trusted code, so those
-- steps run in SECURITY DEFINER helpers in the private `app_private` schema. That schema is not
-- exposed through the Data API; the helpers can only be reached through the public functions
-- below, and each one checks auth.uid() and organization membership itself.
--
-- The public functions are SECURITY INVOKER, so their own reads and writes stay under RLS.
-- Errors use SQLSTATEs the API maps to HTTP statuses:
--   42501 not authenticated, P0002 not found, 55000 invalid state, 22023 invalid input.

alter table public.documents
  add column original_file_name text
    check (original_file_name is null or char_length(original_file_name) between 1 and 255);

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

-- Locks a draft the caller can access, bumps updated_at, and returns its organization and page count.
create function app_private.begin_draft_edit(p_document_id uuid)
returns table (organization_id uuid, page_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_document public.documents%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found or not exists (
    select 1 from public.organization_members as membership
    where membership.organization_id = v_document.organization_id and membership.user_id = v_user_id
  ) then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if v_document.status <> 'draft' then
    raise exception 'only draft documents can be changed' using errcode = '55000';
  end if;
  update public.documents set updated_at = now() where id = p_document_id;
  return query select v_document.organization_id, v_document.page_count;
end;
$$;

-- Appends a user audit event for a document the caller can access.
create function app_private.record_user_audit_event(p_document_id uuid, p_event_type text, p_metadata jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_event_type not in ('document.created', 'document.fields_updated', 'document.cancelled') then
    raise exception 'unsupported audit event' using errcode = '22023';
  end if;
  select document.organization_id into v_organization_id
  from public.documents as document
  join public.organization_members as membership
    on membership.organization_id = document.organization_id and membership.user_id = v_user_id
  where document.id = p_document_id;
  if v_organization_id is null then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  insert into public.audit_events (organization_id, document_id, actor_user_id, actor_type, event_type, metadata)
  values (v_organization_id, p_document_id, v_user_id, 'user', p_event_type, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Cancels a document the caller can access and records the audit event.
create function app_private.cancel_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_document public.documents%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found or not exists (
    select 1 from public.organization_members as membership
    where membership.organization_id = v_document.organization_id and membership.user_id = v_user_id
  ) then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if v_document.status not in ('draft', 'sent', 'in_progress') then
    raise exception 'this document cannot be cancelled from its current state' using errcode = '55000';
  end if;
  update public.documents set status = 'cancelled' where id = p_document_id;
  perform app_private.record_user_audit_event(p_document_id, 'document.cancelled', '{}'::jsonb);
end;
$$;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;

create function public.create_draft_document(
  p_document_id uuid,
  p_organization_id uuid,
  p_title text,
  p_external_id text,
  p_original_file_name text,
  p_original_pdf_path text,
  p_page_count integer,
  p_recipients jsonb
)
returns setof public.recipients
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_recipients) is distinct from 'array'
    or jsonb_array_length(p_recipients) not between 1 and 20 then
    raise exception 'recipients must be an array of 1 to 20 entries' using errcode = '22023';
  end if;

  insert into public.documents (
    id, organization_id, title, created_by, page_count, external_id,
    original_file_name, original_pdf_path
  )
  values (
    p_document_id, p_organization_id, btrim(p_title), v_user_id, p_page_count,
    nullif(btrim(p_external_id), ''), p_original_file_name, p_original_pdf_path
  );

  insert into public.document_versions (
    organization_id, document_id, version_number, original_pdf_path, page_count, created_by
  )
  values (p_organization_id, p_document_id, 1, p_original_pdf_path, p_page_count, v_user_id);

  insert into public.recipients (
    organization_id, document_id, name, email, role, signing_order, delivery
  )
  select
    p_organization_id,
    p_document_id,
    btrim(recipient ->> 'name'),
    lower(btrim(recipient ->> 'email')),
    btrim(recipient ->> 'role'),
    position::integer,
    recipient ->> 'delivery'
  from jsonb_array_elements(p_recipients) with ordinality as entries (recipient, position);

  perform app_private.record_user_audit_event(
    p_document_id,
    'document.created',
    jsonb_build_object('recipient_count', jsonb_array_length(p_recipients), 'page_count', p_page_count)
  );

  return query
    select * from public.recipients
    where document_id = p_document_id
    order by signing_order;
end;
$$;

create function public.replace_document_fields(p_document_id uuid, p_fields jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_page_count integer;
  v_field_count integer;
  v_written integer;
begin
  if jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields) > 100 then
    raise exception 'fields must be an array of at most 100 entries' using errcode = '22023';
  end if;
  v_field_count := jsonb_array_length(p_fields);

  select draft.organization_id, draft.page_count into v_organization_id, v_page_count
  from app_private.begin_draft_edit(p_document_id) as draft;

  if exists (
    select 1 from jsonb_array_elements(p_fields) as field
    where (field ->> 'page')::integer > v_page_count
  ) then
    raise exception 'a field references a page outside this document' using errcode = '22023';
  end if;

  delete from public.fields
  where document_id = p_document_id
    and id not in (select (field ->> 'id')::uuid from jsonb_array_elements(p_fields) as field);

  -- The recipient foreign key (document_id, recipient_id) rejects recipients from other documents.
  insert into public.fields as existing (
    id, organization_id, document_id, recipient_id, type, page, x, y, w, h, required, label, source
  )
  select
    (field ->> 'id')::uuid,
    v_organization_id,
    p_document_id,
    (field ->> 'recipientId')::uuid,
    field ->> 'type',
    (field ->> 'page')::integer,
    (field ->> 'x')::double precision,
    (field ->> 'y')::double precision,
    (field ->> 'w')::double precision,
    (field ->> 'h')::double precision,
    (field ->> 'required')::boolean,
    field ->> 'label',
    field ->> 'source'
  from jsonb_array_elements(p_fields) as field
  on conflict (id) do update
    set recipient_id = excluded.recipient_id,
        type = excluded.type,
        page = excluded.page,
        x = excluded.x,
        y = excluded.y,
        w = excluded.w,
        h = excluded.h,
        required = excluded.required,
        label = excluded.label,
        source = excluded.source
    where existing.document_id = excluded.document_id;
  get diagnostics v_written = row_count;
  if v_written <> v_field_count then
    -- A field ID already belongs to another document.
    raise exception 'field IDs must be unique to this document' using errcode = '22023';
  end if;

  perform app_private.record_user_audit_event(
    p_document_id, 'document.fields_updated', jsonb_build_object('field_count', v_field_count)
  );
  return v_field_count;
end;
$$;

create function public.cancel_document(p_document_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.cancel_document(p_document_id);
$$;

revoke all on function public.create_draft_document(uuid, uuid, text, text, text, text, integer, jsonb) from public, anon;
revoke all on function public.replace_document_fields(uuid, jsonb) from public, anon;
revoke all on function public.cancel_document(uuid) from public, anon;
grant execute on function public.create_draft_document(uuid, uuid, text, text, text, text, integer, jsonb) to authenticated;
grant execute on function public.replace_document_fields(uuid, jsonb) to authenticated;
grant execute on function public.cancel_document(uuid) to authenticated;
