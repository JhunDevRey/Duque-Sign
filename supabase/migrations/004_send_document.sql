-- Sending documents and issuing signing links.
--
-- The server generates a random token per recipient and passes only its SHA-256 hex digest;
-- raw tokens are never stored. A link is valid while its hash is stored on the recipient, the
-- recipient has not signed or declined, the document is sent/in progress, and documents.expires_at
-- has not passed. Cancelling revokes every link by clearing the hashes; reissuing replaces one.
-- Privileged steps run in app_private (SECURITY DEFINER, not exposed through the Data API) behind
-- SECURITY INVOKER wrappers, like 002/003.
-- Errors: 42501 not authenticated, P0002 not found, 55000 invalid state, 22023 invalid input.

alter table public.audit_events drop constraint audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (
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
    'recipient.declined',
    'recipient.link_reissued'
  )
);

-- Adds an optional recipient and the sending events to the user audit helper from 002.
drop function app_private.record_user_audit_event(uuid, text, jsonb);
create function app_private.record_user_audit_event(
  p_document_id uuid,
  p_event_type text,
  p_metadata jsonb,
  p_recipient_id uuid default null
)
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
  if p_event_type not in (
    'document.created', 'document.fields_updated', 'document.cancelled',
    'document.sent', 'recipient.link_reissued'
  ) then
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
  insert into public.audit_events (
    organization_id, document_id, recipient_id, actor_user_id, actor_type, event_type, metadata
  )
  values (
    v_organization_id, p_document_id, p_recipient_id, v_user_id, 'user', p_event_type,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Locks a document the caller can access. Raises P0002 when missing or not a member.
create function app_private.lock_member_document(p_document_id uuid)
returns public.documents
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
  return v_document;
end;
$$;

-- p_token_hashes: {"<recipient id>": "<sha-256 hex>", ...} covering every recipient exactly once.
create function app_private.send_document(p_document_id uuid, p_token_hashes jsonb, p_expires_in_days integer)
returns table (recipient_id uuid, status public.recipient_status, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_recipient_count integer;
  v_first_order integer;
  v_expires_at timestamptz;
begin
  v_document := app_private.lock_member_document(p_document_id);
  if v_document.status <> 'draft' then
    raise exception 'only draft documents can be sent' using errcode = '55000';
  end if;
  if p_expires_in_days is null or p_expires_in_days not between 1 and 90 then
    raise exception 'link expiry must be between 1 and 90 days' using errcode = '22023';
  end if;
  if jsonb_typeof(p_token_hashes) is distinct from 'object' then
    raise exception 'signing link hashes are invalid' using errcode = '22023';
  end if;

  select count(*), min(signing_order) into v_recipient_count, v_first_order
  from public.recipients where document_id = p_document_id;
  if v_recipient_count = 0 then
    raise exception 'add at least one recipient before sending' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_token_hashes)) <> v_recipient_count
    or exists (
      select 1 from public.recipients as recipient
      where recipient.document_id = p_document_id
        and coalesce(p_token_hashes ->> recipient.id::text, '') !~ '^[0-9a-f]{64}$'
    )
    or (select count(distinct value) from jsonb_each_text(p_token_hashes)) <> v_recipient_count then
    raise exception 'signing link hashes must cover each recipient exactly once' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.recipients as recipient
    where recipient.document_id = p_document_id
      and not exists (
        select 1 from public.fields as field
        where field.recipient_id = recipient.id and field.type = 'signature' and field.required
      )
  ) then
    raise exception 'every recipient needs at least one required signature field' using errcode = '22023';
  end if;

  v_expires_at := now() + make_interval(days => p_expires_in_days);
  update public.documents
  set status = 'sent', sent_at = now(), expires_at = v_expires_at
  where id = p_document_id;

  update public.recipients as recipient
  set signing_token_hash = p_token_hashes ->> recipient.id::text,
      status = case when recipient.signing_order = v_first_order
        then 'sent'::public.recipient_status else 'waiting'::public.recipient_status end
  where recipient.document_id = p_document_id;

  perform app_private.record_user_audit_event(
    p_document_id, 'document.sent',
    jsonb_build_object('recipient_count', v_recipient_count, 'expires_at', v_expires_at)
  );

  return query
    select recipient.id, recipient.status, v_expires_at
    from public.recipients as recipient
    where recipient.document_id = p_document_id
    order by recipient.signing_order, recipient.created_at;
end;
$$;

create function app_private.reissue_signing_link(p_document_id uuid, p_recipient_id uuid, p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_recipient_status public.recipient_status;
begin
  v_document := app_private.lock_member_document(p_document_id);
  if v_document.status not in ('sent', 'in_progress') or v_document.expires_at <= now() then
    raise exception 'signing links can only be reissued for documents awaiting signature' using errcode = '55000';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'signing link hash is invalid' using errcode = '22023';
  end if;
  select recipient.status into v_recipient_status
  from public.recipients as recipient
  where recipient.id = p_recipient_id and recipient.document_id = p_document_id
  for update;
  if not found then
    raise exception 'recipient not found' using errcode = 'P0002';
  end if;
  if v_recipient_status in ('signed', 'declined') then
    raise exception 'this recipient has already finished' using errcode = '55000';
  end if;
  update public.recipients set signing_token_hash = p_token_hash where id = p_recipient_id;
  perform app_private.record_user_audit_event(p_document_id, 'recipient.link_reissued', '{}'::jsonb, p_recipient_id);
end;
$$;

-- Same as 002, plus revoking every signing link.
create or replace function app_private.cancel_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
begin
  v_document := app_private.lock_member_document(p_document_id);
  if v_document.status not in ('draft', 'sent', 'in_progress') then
    raise exception 'this document cannot be cancelled from its current state' using errcode = '55000';
  end if;
  update public.documents set status = 'cancelled' where id = p_document_id;
  update public.recipients set signing_token_hash = null where document_id = p_document_id;
  perform app_private.record_user_audit_event(p_document_id, 'document.cancelled', '{}'::jsonb);
end;
$$;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;

create function public.send_document(p_document_id uuid, p_token_hashes jsonb, p_expires_in_days integer)
returns table (recipient_id uuid, status public.recipient_status, expires_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.send_document(p_document_id, p_token_hashes, p_expires_in_days);
$$;

create function public.reissue_signing_link(p_document_id uuid, p_recipient_id uuid, p_token_hash text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.reissue_signing_link(p_document_id, p_recipient_id, p_token_hash);
$$;

revoke all on function public.send_document(uuid, jsonb, integer) from public, anon;
revoke all on function public.reissue_signing_link(uuid, uuid, text) from public, anon;
grant execute on function public.send_document(uuid, jsonb, integer) to authenticated;
grant execute on function public.reissue_signing_link(uuid, uuid, text) to authenticated;
