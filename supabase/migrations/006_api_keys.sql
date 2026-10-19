-- Server-to-server API (/api/v1, used by Make.com and similar automation).
--
-- API keys are bearer secrets. The server stores only their SHA-256 hex digest and a short display
-- prefix, never the key itself. Owners and admins create and revoke keys through SECURITY INVOKER
-- wrappers that check auth.uid(), like 002–004.
--
-- API requests are not Supabase users, so the Next.js server calls the api_* functions with the
-- service-role key, like 005. They are executable by service_role only and re-check inside a row
-- lock that the key is active and belongs to the document's organization, so a bug in the route
-- handlers cannot reach another tenant's documents.
--
-- Sending is shared with the dashboard: app_private.apply_send holds the one copy of the send rules.
-- Errors: 42501 not authenticated/forbidden, P0002 not found, 55000 invalid state, 22023 invalid input.

alter table public.documents
  add column metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  key_prefix text not null check (key_prefix ~ '^sk_live_[A-Za-z0-9_-]{4}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_keys_organization_created_idx on public.api_keys (organization_id, created_at desc);
create index api_keys_created_by_idx on public.api_keys (created_by);

alter table public.api_keys enable row level security;

create policy "api_keys_select_admin"
on public.api_keys for select to authenticated
using (public.is_organization_admin(organization_id));

-- The hash stays server-side even for admins.
grant select (id, organization_id, name, key_prefix, created_by, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;

-- Replay records for POST requests sent with an Idempotency-Key header. Service-role only (no policies).
-- Responses stored here must never contain secrets such as signing URLs.
create table public.api_idempotency_keys (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 255),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_status integer check (response_status is null or response_status between 200 and 599),
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, idempotency_key)
);

create index api_idempotency_keys_created_idx on public.api_idempotency_keys (created_at);

alter table public.api_idempotency_keys enable row level security;

grant usage on schema app_private to service_role;

-- ---------------------------------------------------------------------------------------------
-- Key management (signed-in owners and admins)
-- ---------------------------------------------------------------------------------------------

create function app_private.create_api_key(p_organization_id uuid, p_name text, p_key_prefix text, p_key_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_members as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = v_user_id
      and membership.role in ('owner', 'admin')
  ) then
    raise exception 'only organization owners and admins can manage API keys' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'key name must be 1 to 80 characters' using errcode = '22023';
  end if;
  if (
    select count(*) from public.api_keys
    where organization_id = p_organization_id and revoked_at is null
  ) >= 20 then
    raise exception 'an organization can have at most 20 active API keys' using errcode = '55000';
  end if;
  insert into public.api_keys (organization_id, name, key_prefix, key_hash, created_by)
  values (p_organization_id, btrim(p_name), p_key_prefix, p_key_hash, v_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

create function app_private.revoke_api_key(p_api_key_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_key public.api_keys%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_key from public.api_keys where id = p_api_key_id for update;
  if not found or not exists (
    select 1 from public.organization_members as membership
    where membership.organization_id = v_key.organization_id
      and membership.user_id = v_user_id
      and membership.role in ('owner', 'admin')
  ) then
    raise exception 'API key not found' using errcode = 'P0002';
  end if;
  update public.api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_api_key_id;
end;
$$;

revoke all on function app_private.create_api_key(uuid, text, text, text) from public, anon;
revoke all on function app_private.revoke_api_key(uuid) from public, anon;
grant execute on function app_private.create_api_key(uuid, text, text, text) to authenticated;
grant execute on function app_private.revoke_api_key(uuid) to authenticated;

create function public.create_api_key(p_organization_id uuid, p_name text, p_key_prefix text, p_key_hash text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.create_api_key(p_organization_id, p_name, p_key_prefix, p_key_hash);
$$;

create function public.revoke_api_key(p_api_key_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.revoke_api_key(p_api_key_id);
$$;

revoke all on function public.create_api_key(uuid, text, text, text) from public, anon;
revoke all on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.create_api_key(uuid, text, text, text) to authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Shared send rules (dashboard and API)
-- ---------------------------------------------------------------------------------------------

-- Sends a draft the caller has already locked and authorized. Validates the link hashes and
-- signature fields, then moves the document to sent and the first signers to sent.
-- p_token_hashes: {"<recipient id>": "<sha-256 hex>", ...} covering every recipient exactly once.
create function app_private.apply_send(
  p_document public.documents,
  p_token_hashes jsonb,
  p_expires_in_days integer,
  out expires_at timestamptz,
  out recipient_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first_order integer;
begin
  if p_document.status <> 'draft' then
    raise exception 'only draft documents can be sent' using errcode = '55000';
  end if;
  if p_expires_in_days is null or p_expires_in_days not between 1 and 90 then
    raise exception 'link expiry must be between 1 and 90 days' using errcode = '22023';
  end if;
  if jsonb_typeof(p_token_hashes) is distinct from 'object' then
    raise exception 'signing link hashes are invalid' using errcode = '22023';
  end if;

  select count(*), min(signing_order) into recipient_count, v_first_order
  from public.recipients where document_id = p_document.id;
  if recipient_count = 0 then
    raise exception 'add at least one recipient before sending' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_token_hashes)) <> recipient_count
    or exists (
      select 1 from public.recipients as recipient
      where recipient.document_id = p_document.id
        and coalesce(p_token_hashes ->> recipient.id::text, '') !~ '^[0-9a-f]{64}$'
    )
    or (select count(distinct value) from jsonb_each_text(p_token_hashes)) <> recipient_count then
    raise exception 'signing link hashes must cover each recipient exactly once' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.recipients as recipient
    where recipient.document_id = p_document.id
      and not exists (
        select 1 from public.fields as field
        where field.recipient_id = recipient.id and field.type = 'signature' and field.required
      )
  ) then
    raise exception 'every recipient needs at least one required signature field' using errcode = '22023';
  end if;

  expires_at := now() + make_interval(days => p_expires_in_days);
  update public.documents
  set status = 'sent', sent_at = now(), expires_at = apply_send.expires_at
  where id = p_document.id;

  update public.recipients as recipient
  set signing_token_hash = p_token_hashes ->> recipient.id::text,
      status = case when recipient.signing_order = v_first_order
        then 'sent'::public.recipient_status else 'waiting'::public.recipient_status end
  where recipient.document_id = p_document.id;
end;
$$;

-- Same contract as 004; the rules now live in apply_send.
create or replace function app_private.send_document(p_document_id uuid, p_token_hashes jsonb, p_expires_in_days integer)
returns table (recipient_id uuid, status public.recipient_status, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_sent record;
begin
  v_document := app_private.lock_member_document(p_document_id);
  select * into v_sent from app_private.apply_send(v_document, p_token_hashes, p_expires_in_days);

  perform app_private.record_user_audit_event(
    p_document_id, 'document.sent',
    jsonb_build_object('recipient_count', v_sent.recipient_count, 'expires_at', v_sent.expires_at)
  );

  return query
    select recipient.id, recipient.status, v_sent.expires_at
    from public.recipients as recipient
    where recipient.document_id = p_document_id
    order by recipient.signing_order, recipient.created_at;
end;
$$;

-- Only reachable through the SECURITY DEFINER callers above and below, which authorize first.
revoke all on function app_private.apply_send(public.documents, jsonb, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- API requests (service role only)
-- ---------------------------------------------------------------------------------------------

-- Resolves a presented key's hash to an active key and records when it was last used.
create function app_private.authenticate_api_key(p_key_hash text)
returns table (api_key_id uuid, organization_id uuid, organization_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys%rowtype;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid API key' using errcode = '42501';
  end if;
  select * into v_key from public.api_keys where key_hash = p_key_hash and revoked_at is null;
  if not found then
    raise exception 'invalid API key' using errcode = '42501';
  end if;
  -- Throttled so busy integrations do not write on every request.
  if v_key.last_used_at is null or v_key.last_used_at < now() - interval '1 minute' then
    update public.api_keys set last_used_at = now() where id = v_key.id;
  end if;
  return query
    select v_key.id, v_key.organization_id, organization.name
    from public.organizations as organization
    where organization.id = v_key.organization_id;
end;
$$;

-- The active key, locked so a concurrent revoke waits for the request to finish.
create function app_private.lock_active_api_key(p_api_key_id uuid)
returns public.api_keys
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys%rowtype;
begin
  select * into v_key from public.api_keys where id = p_api_key_id for share;
  if not found or v_key.revoked_at is not null then
    raise exception 'invalid API key' using errcode = '42501';
  end if;
  return v_key;
end;
$$;

-- Locks a document owned by the key's organization. Raises P0002 for any other document.
create function app_private.lock_api_document(p_api_key_id uuid, p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys%rowtype;
  v_document public.documents%rowtype;
begin
  v_key := app_private.lock_active_api_key(p_api_key_id);
  select * into v_document from public.documents
  where id = p_document_id and organization_id = v_key.organization_id
  for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  return v_document;
end;
$$;

create function app_private.record_api_audit_event(
  p_api_key_id uuid,
  p_document public.documents,
  p_event_type text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (organization_id, document_id, actor_type, event_type, metadata)
  values (
    p_document.organization_id, p_document.id, 'api_key', p_event_type,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('api_key_id', p_api_key_id)
  );
end;
$$;

-- Creates a draft with its recipients and fields in one transaction.
-- p_recipients: [{"id", "name", "email", "role"}] in signing order; every recipient gets delivery 'link'.
-- p_fields: [{"id", "recipientId", "type", "page", "x", "y", "w", "h", "required", "label", "source"}].
create function app_private.api_create_document(
  p_api_key_id uuid,
  p_document_id uuid,
  p_title text,
  p_external_id text,
  p_metadata jsonb,
  p_original_file_name text,
  p_original_pdf_path text,
  p_page_count integer,
  p_recipients jsonb,
  p_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys%rowtype;
  v_document public.documents%rowtype;
begin
  v_key := app_private.lock_active_api_key(p_api_key_id);
  if jsonb_typeof(p_recipients) is distinct from 'array'
    or jsonb_array_length(p_recipients) not between 1 and 20 then
    raise exception 'recipients must be an array of 1 to 20 entries' using errcode = '22023';
  end if;
  if jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields) > 100 then
    raise exception 'fields must be an array of at most 100 entries' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_fields) as field
    where (field ->> 'page')::integer > p_page_count
  ) then
    raise exception 'a field references a page outside this document' using errcode = '22023';
  end if;
  if p_original_pdf_path is null or split_part(p_original_pdf_path, '/', 1) <> v_key.organization_id::text then
    raise exception 'original PDF path is invalid' using errcode = '22023';
  end if;

  insert into public.documents (
    id, organization_id, title, created_by, page_count, external_id, metadata,
    original_file_name, original_pdf_path
  )
  values (
    p_document_id, v_key.organization_id, btrim(p_title), v_key.created_by, p_page_count,
    nullif(btrim(p_external_id), ''), coalesce(p_metadata, '{}'::jsonb),
    p_original_file_name, p_original_pdf_path
  )
  returning * into v_document;

  insert into public.document_versions (
    organization_id, document_id, version_number, original_pdf_path, page_count, created_by
  )
  values (v_key.organization_id, p_document_id, 1, p_original_pdf_path, p_page_count, v_key.created_by);

  insert into public.recipients (
    id, organization_id, document_id, name, email, role, signing_order, delivery
  )
  select
    (recipient ->> 'id')::uuid,
    v_key.organization_id,
    p_document_id,
    btrim(recipient ->> 'name'),
    lower(btrim(recipient ->> 'email')),
    btrim(recipient ->> 'role'),
    position::integer,
    'link'
  from jsonb_array_elements(p_recipients) with ordinality as entries (recipient, position);

  -- The recipient foreign key (document_id, recipient_id) rejects recipients from other documents.
  insert into public.fields (
    id, organization_id, document_id, recipient_id, type, page, x, y, w, h, required, label, source
  )
  select
    (field ->> 'id')::uuid,
    v_key.organization_id,
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
  from jsonb_array_elements(p_fields) as field;

  perform app_private.record_api_audit_event(
    p_api_key_id, v_document, 'document.created',
    jsonb_build_object(
      'recipient_count', jsonb_array_length(p_recipients),
      'field_count', jsonb_array_length(p_fields),
      'page_count', p_page_count
    )
  );
end;
$$;

create function app_private.api_send_document(
  p_api_key_id uuid,
  p_document_id uuid,
  p_token_hashes jsonb,
  p_expires_in_days integer
)
returns table (recipient_id uuid, status public.recipient_status, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_sent record;
begin
  v_document := app_private.lock_api_document(p_api_key_id, p_document_id);
  select * into v_sent from app_private.apply_send(v_document, p_token_hashes, p_expires_in_days);

  perform app_private.record_api_audit_event(
    p_api_key_id, v_document, 'document.sent',
    jsonb_build_object('recipient_count', v_sent.recipient_count, 'expires_at', v_sent.expires_at)
  );

  return query
    select recipient.id, recipient.status, v_sent.expires_at
    from public.recipients as recipient
    where recipient.document_id = p_document_id
    order by recipient.signing_order, recipient.created_at;
end;
$$;

-- Claims an idempotency key for a request. Returns:
--   claimed     – proceed, then call api_complete_idempotency or api_release_idempotency
--   replay      – return the stored response
--   mismatch    – the key was used with a different request
--   in_progress – another request with this key has not finished
-- Keys are kept for 24 hours; an unfinished claim older than 5 minutes is treated as abandoned.
create function app_private.api_claim_idempotency(p_api_key_id uuid, p_idempotency_key text, p_request_hash text)
returns table (state text, response_status integer, response_body jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys%rowtype;
  v_record public.api_idempotency_keys%rowtype;
begin
  v_key := app_private.lock_active_api_key(p_api_key_id);
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 255 then
    raise exception 'Idempotency-Key must be 1 to 255 characters' using errcode = '22023';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'request hash is invalid' using errcode = '22023';
  end if;

  delete from public.api_idempotency_keys as record
  where record.organization_id = v_key.organization_id
    and record.idempotency_key = p_idempotency_key
    and record.created_at < now() - interval '24 hours';

  insert into public.api_idempotency_keys (organization_id, idempotency_key, request_hash)
  values (v_key.organization_id, p_idempotency_key, p_request_hash)
  on conflict do nothing;
  if found then
    return query select 'claimed'::text, null::integer, null::jsonb;
    return;
  end if;

  select * into v_record from public.api_idempotency_keys as record
  where record.organization_id = v_key.organization_id and record.idempotency_key = p_idempotency_key
  for update;
  if v_record.request_hash <> p_request_hash then
    return query select 'mismatch'::text, null::integer, null::jsonb;
  elsif v_record.response_status is not null then
    return query select 'replay'::text, v_record.response_status, v_record.response_body;
  elsif v_record.created_at < now() - interval '5 minutes' then
    update public.api_idempotency_keys as record set created_at = now()
    where record.organization_id = v_key.organization_id and record.idempotency_key = p_idempotency_key;
    return query select 'claimed'::text, null::integer, null::jsonb;
  else
    return query select 'in_progress'::text, null::integer, null::jsonb;
  end if;
end;
$$;

create function app_private.api_complete_idempotency(
  p_api_key_id uuid,
  p_idempotency_key text,
  p_response_status integer,
  p_response_body jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys%rowtype;
begin
  select * into v_key from public.api_keys where id = p_api_key_id;
  if not found then
    raise exception 'invalid API key' using errcode = '42501';
  end if;
  update public.api_idempotency_keys
  set response_status = p_response_status, response_body = p_response_body
  where organization_id = v_key.organization_id and idempotency_key = p_idempotency_key;
end;
$$;

-- Frees a claim after a failure that is safe to retry, so the client can repeat the request.
create function app_private.api_release_idempotency(p_api_key_id uuid, p_idempotency_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys%rowtype;
begin
  select * into v_key from public.api_keys where id = p_api_key_id;
  if not found then
    return;
  end if;
  delete from public.api_idempotency_keys
  where organization_id = v_key.organization_id
    and idempotency_key = p_idempotency_key
    and response_status is null;
end;
$$;

revoke all on function app_private.authenticate_api_key(text) from public, anon, authenticated;
revoke all on function app_private.lock_active_api_key(uuid) from public, anon, authenticated;
revoke all on function app_private.lock_api_document(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.record_api_audit_event(uuid, public.documents, text, jsonb) from public, anon, authenticated;
revoke all on function app_private.api_create_document(uuid, uuid, text, text, jsonb, text, text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function app_private.api_send_document(uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function app_private.api_claim_idempotency(uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.api_complete_idempotency(uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function app_private.api_release_idempotency(uuid, text) from public, anon, authenticated;
grant execute on function app_private.authenticate_api_key(text) to service_role;
grant execute on function app_private.api_create_document(uuid, uuid, text, text, jsonb, text, text, integer, jsonb, jsonb) to service_role;
grant execute on function app_private.api_send_document(uuid, uuid, jsonb, integer) to service_role;
grant execute on function app_private.api_claim_idempotency(uuid, text, text) to service_role;
grant execute on function app_private.api_complete_idempotency(uuid, text, integer, jsonb) to service_role;
grant execute on function app_private.api_release_idempotency(uuid, text) to service_role;

create function public.api_authenticate_key(p_key_hash text)
returns table (api_key_id uuid, organization_id uuid, organization_name text)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.authenticate_api_key(p_key_hash);
$$;

create function public.api_create_document(
  p_api_key_id uuid,
  p_document_id uuid,
  p_title text,
  p_external_id text,
  p_metadata jsonb,
  p_original_file_name text,
  p_original_pdf_path text,
  p_page_count integer,
  p_recipients jsonb,
  p_fields jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.api_create_document(
    p_api_key_id, p_document_id, p_title, p_external_id, p_metadata,
    p_original_file_name, p_original_pdf_path, p_page_count, p_recipients, p_fields
  );
$$;

create function public.api_send_document(p_api_key_id uuid, p_document_id uuid, p_token_hashes jsonb, p_expires_in_days integer)
returns table (recipient_id uuid, status public.recipient_status, expires_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.api_send_document(p_api_key_id, p_document_id, p_token_hashes, p_expires_in_days);
$$;

create function public.api_claim_idempotency(p_api_key_id uuid, p_idempotency_key text, p_request_hash text)
returns table (state text, response_status integer, response_body jsonb)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.api_claim_idempotency(p_api_key_id, p_idempotency_key, p_request_hash);
$$;

create function public.api_complete_idempotency(p_api_key_id uuid, p_idempotency_key text, p_response_status integer, p_response_body jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.api_complete_idempotency(p_api_key_id, p_idempotency_key, p_response_status, p_response_body);
$$;

create function public.api_release_idempotency(p_api_key_id uuid, p_idempotency_key text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.api_release_idempotency(p_api_key_id, p_idempotency_key);
$$;

revoke all on function public.api_authenticate_key(text) from public, anon, authenticated;
revoke all on function public.api_create_document(uuid, uuid, text, text, jsonb, text, text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.api_send_document(uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.api_claim_idempotency(uuid, text, text) from public, anon, authenticated;
revoke all on function public.api_complete_idempotency(uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.api_release_idempotency(uuid, text) from public, anon, authenticated;
grant execute on function public.api_authenticate_key(text) to service_role;
grant execute on function public.api_create_document(uuid, uuid, text, text, jsonb, text, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.api_send_document(uuid, uuid, jsonb, integer) to service_role;
grant execute on function public.api_claim_idempotency(uuid, text, text) to service_role;
grant execute on function public.api_complete_idempotency(uuid, text, integer, jsonb) to service_role;
grant execute on function public.api_release_idempotency(uuid, text) to service_role;
