-- Recipient signing, decline, and finalization.
--
-- Recipients are not Supabase users. The Next.js server hashes the token from the signing URL and
-- calls these functions with the service-role key, so they are executable by service_role only and
-- never by anon or authenticated. Every function re-checks the link, the document state, expiry,
-- and signing order inside a row lock, so the server cannot be tricked into an invalid transition.
-- Privileged steps run in app_private (SECURITY DEFINER) behind SECURITY INVOKER wrappers, like 002–004.
-- Errors: P0002 link not found, 55000 invalid state, 22023 invalid input.

alter table public.recipients
  add column viewed_at timestamptz,
  add column declined_at timestamptz,
  add column decline_reason text check (decline_reason is null or char_length(decline_reason) <= 500);

-- One value per field, written once by the field's recipient when they sign.
-- Signature and initials values are PNG data URLs; checkboxes are 'true' or 'false'.
create table public.field_values (
  field_id uuid primary key references public.fields (id) on delete cascade,
  organization_id uuid not null,
  document_id uuid not null,
  recipient_id uuid not null,
  value text not null check (char_length(value) <= 300000),
  created_at timestamptz not null default now(),
  foreign key (organization_id, document_id)
    references public.documents (organization_id, id) on delete cascade,
  foreign key (document_id, recipient_id)
    references public.recipients (document_id, id) on delete cascade
);

create index field_values_document_id_idx on public.field_values (document_id);

alter table public.field_values enable row level security;

create policy "field_values_select_member"
on public.field_values for select to authenticated
using (public.is_organization_member(organization_id));

grant select on public.field_values to authenticated;

grant usage on schema app_private to service_role;

-- Parses a client IP for audit records, ignoring values that are not valid addresses.
create function app_private.try_inet(p_value text)
returns inet
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(btrim(p_value), '')::inet;
exception when others then
  return null;
end;
$$;

-- The recipient (locked) for a signing token hash, with its document (locked first, so concurrent
-- signers of one document serialize). Raises P0002 for unknown or revoked links.
create function app_private.lock_signing_link(p_token_hash text, out recipient public.recipients, out document public.documents)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'signing link not found' using errcode = 'P0002';
  end if;
  select r.document_id into v_document_id from public.recipients as r where r.signing_token_hash = p_token_hash;
  if v_document_id is null then
    raise exception 'signing link not found' using errcode = 'P0002';
  end if;
  select * into document from public.documents where id = v_document_id for update;
  select * into recipient from public.recipients where signing_token_hash = p_token_hash for update;
  if recipient.id is null then
    raise exception 'signing link not found' using errcode = 'P0002';
  end if;
end;
$$;

-- What the recipient may do now:
-- ready | waiting (earlier signers first) | signed | declined | completed | expired | closed.
create function app_private.signing_state(p_recipient public.recipients, p_document public.documents)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_recipient.status = 'declined' then 'declined'
    when p_document.status = 'completed' then 'completed'
    when p_recipient.status = 'signed' then 'signed'
    when p_document.status = 'expired'
      or (p_document.status in ('sent', 'in_progress') and p_document.expires_at <= now()) then 'expired'
    when p_document.status not in ('sent', 'in_progress') then 'closed'
    when p_recipient.status = 'waiting' then 'waiting'
    else 'ready'
  end;
$$;

-- Marks an expired document and revokes its links. Returns true when it did so.
create function app_private.expire_if_due(p_document public.documents)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_document.status not in ('sent', 'in_progress') or p_document.expires_at > now() then
    return false;
  end if;
  update public.documents set status = 'expired' where id = p_document.id;
  insert into public.audit_events (organization_id, document_id, actor_type, event_type, metadata)
  values (p_document.organization_id, p_document.id, 'system', 'document.expired',
    jsonb_build_object('expires_at', p_document.expires_at));
  return true;
end;
$$;

create function app_private.signing_session_json(p_recipient public.recipients, p_document public.documents, p_state text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'state', p_state,
    'document', jsonb_build_object(
      'id', p_document.id,
      'organizationId', p_document.organization_id,
      'title', p_document.title,
      'pageCount', p_document.page_count,
      'expiresAt', p_document.expires_at,
      'completedAt', p_document.completed_at,
      'originalPdfPath', p_document.original_pdf_path,
      'finalPdfPath', p_document.final_pdf_path,
      'finalSha256', p_document.final_pdf_sha256
    ),
    'recipient', jsonb_build_object(
      'id', p_recipient.id,
      'name', p_recipient.name,
      'email', p_recipient.email,
      'role', p_recipient.role,
      'status', p_recipient.status,
      'signedAt', p_recipient.signed_at
    ),
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', field.id, 'type', field.type, 'page', field.page,
        'x', field.x, 'y', field.y, 'w', field.w, 'h', field.h,
        'required', field.required, 'label', field.label
      ) order by field.page, field.y, field.x)
      from public.fields as field
      where field.recipient_id = p_recipient.id
    ), '[]'::jsonb),
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', other.name, 'order', other.signing_order, 'status', other.status, 'isYou', other.id = p_recipient.id
      ) order by other.signing_order, other.created_at)
      from public.recipients as other
      where other.document_id = p_document.id
    ), '[]'::jsonb)
  );
$$;

-- Opens a signing link. Records the first view of an actionable link.
create function app_private.open_signing_session(p_token_hash text, p_ip text, p_user_agent text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link record;
  v_recipient public.recipients;
  v_document public.documents;
  v_state text;
begin
  select * into v_link from app_private.lock_signing_link(p_token_hash);
  v_recipient := v_link.recipient;
  v_document := v_link.document;
  if app_private.expire_if_due(v_document) then
    select * into v_document from public.documents where id = v_document.id;
  end if;
  v_state := app_private.signing_state(v_recipient, v_document);

  if v_state = 'ready' and v_recipient.status = 'sent' then
    update public.recipients set status = 'viewed', viewed_at = now()
    where id = v_recipient.id
    returning * into v_recipient;
    insert into public.audit_events (
      organization_id, document_id, recipient_id, actor_type, event_type, ip_address, user_agent
    )
    values (
      v_document.organization_id, v_document.id, v_recipient.id, 'recipient', 'recipient.viewed',
      app_private.try_inet(p_ip), left(p_user_agent, 500)
    );
  end if;

  return app_private.signing_session_json(v_recipient, v_document, v_state);
end;
$$;

-- Validates one submitted value against its field type. Returns an error message, or null.
create function app_private.field_value_error(p_type text, p_required boolean, p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or btrim(p_value) = '' or (p_type = 'checkbox' and p_value = 'false') then
    return case when p_required then 'complete every required field' end;
  end if;
  if p_type in ('signature', 'initials') then
    if p_value !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' or char_length(p_value) > 300000 then
      return 'signatures must be PNG images under 200 KB';
    end if;
  elsif p_type = 'checkbox' then
    if p_value not in ('true', 'false') then
      return 'checkbox values must be true or false';
    end if;
  elsif p_type = 'date' then
    if char_length(p_value) > 40 then
      return 'dates must be 40 characters or fewer';
    end if;
  elsif char_length(p_value) > 500 then
    return 'text fields must be 500 characters or fewer';
  end if;
  return null;
end;
$$;

-- p_values: {"<field id>": "<value>", ...} for the recipient's own fields.
-- Returns {"documentId", "organizationId", "allSigned"}. When allSigned is true the server must
-- generate the final PDF and call finalize_document.
create function app_private.submit_signature(
  p_token_hash text,
  p_values jsonb,
  p_consent boolean,
  p_ip text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link record;
  v_recipient public.recipients;
  v_document public.documents;
  v_state text;
  v_field record;
  v_error text;
  v_remaining integer;
  v_next_order integer;
begin
  select * into v_link from app_private.lock_signing_link(p_token_hash);
  v_recipient := v_link.recipient;
  v_document := v_link.document;
  if app_private.expire_if_due(v_document) then
    raise exception 'this signing link has expired' using errcode = '55000';
  end if;
  v_state := app_private.signing_state(v_recipient, v_document);
  if v_state = 'waiting' then
    raise exception 'earlier recipients must sign first' using errcode = '55000';
  elsif v_state <> 'ready' then
    raise exception 'this document can no longer be signed' using errcode = '55000';
  end if;
  if p_consent is distinct from true then
    raise exception 'agree to sign electronically to continue' using errcode = '22023';
  end if;
  if jsonb_typeof(p_values) is distinct from 'object' then
    raise exception 'field values are invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(p_values) as entry
    where jsonb_typeof(entry.value) <> 'string'
      or not exists (
        select 1 from public.fields as field
        where field.recipient_id = v_recipient.id and field.id::text = entry.key
      )
  ) then
    raise exception 'field values must belong to this recipient' using errcode = '22023';
  end if;

  for v_field in
    select field.id, field.type, field.required, p_values ->> field.id::text as value
    from public.fields as field
    where field.recipient_id = v_recipient.id
  loop
    v_error := app_private.field_value_error(v_field.type, v_field.required, v_field.value);
    if v_error is not null then
      raise exception '%', v_error using errcode = '22023';
    end if;
    if v_field.value is not null and btrim(v_field.value) <> '' then
      insert into public.field_values (field_id, organization_id, document_id, recipient_id, value)
      values (v_field.id, v_document.organization_id, v_document.id, v_recipient.id, v_field.value);
    end if;
  end loop;

  update public.recipients set status = 'signed', signed_at = now() where id = v_recipient.id;
  insert into public.audit_events (
    organization_id, document_id, recipient_id, actor_type, event_type, ip_address, user_agent, metadata
  )
  values (
    v_document.organization_id, v_document.id, v_recipient.id, 'recipient', 'recipient.signed',
    app_private.try_inet(p_ip), left(p_user_agent, 500),
    jsonb_build_object('electronic_consent', true, 'field_count', (select count(*) from jsonb_object_keys(p_values)))
  );

  select count(*), min(signing_order) into v_remaining, v_next_order
  from public.recipients
  where document_id = v_document.id and status <> 'signed';

  update public.documents set status = 'in_progress' where id = v_document.id and status = 'sent';
  if v_remaining > 0 and not exists (
    select 1 from public.recipients
    where document_id = v_document.id and signing_order = v_next_order and status in ('sent', 'viewed')
  ) then
    update public.recipients set status = 'sent'
    where document_id = v_document.id and signing_order = v_next_order and status = 'waiting';
  end if;

  return jsonb_build_object(
    'documentId', v_document.id,
    'organizationId', v_document.organization_id,
    'allSigned', v_remaining = 0
  );
end;
$$;

-- Declines the document for every recipient and revokes the other recipients' links.
create function app_private.decline_signing(p_token_hash text, p_reason text, p_ip text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link record;
  v_recipient public.recipients;
  v_document public.documents;
  v_state text;
begin
  select * into v_link from app_private.lock_signing_link(p_token_hash);
  v_recipient := v_link.recipient;
  v_document := v_link.document;
  if app_private.expire_if_due(v_document) then
    raise exception 'this signing link has expired' using errcode = '55000';
  end if;
  v_state := app_private.signing_state(v_recipient, v_document);
  if v_state not in ('ready', 'waiting') then
    raise exception 'this document can no longer be declined' using errcode = '55000';
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'the reason must be 500 characters or fewer' using errcode = '22023';
  end if;

  update public.recipients
  set status = 'declined', declined_at = now(), decline_reason = nullif(btrim(p_reason), '')
  where id = v_recipient.id;
  update public.recipients set signing_token_hash = null
  where document_id = v_document.id and id <> v_recipient.id;
  update public.documents set status = 'declined' where id = v_document.id;

  insert into public.audit_events (
    organization_id, document_id, recipient_id, actor_type, event_type, ip_address, user_agent, metadata
  )
  values
    (v_document.organization_id, v_document.id, v_recipient.id, 'recipient', 'recipient.declined',
      app_private.try_inet(p_ip), left(p_user_agent, 500),
      jsonb_build_object('has_reason', nullif(btrim(p_reason), '') is not null)),
    (v_document.organization_id, v_document.id, v_recipient.id, 'recipient', 'document.declined',
      app_private.try_inet(p_ip), left(p_user_agent, 500), '{}'::jsonb);
end;
$$;

-- Everything the server needs to stamp the final PDF: the original's path and each filled field.
create function app_private.finalization_payload(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents;
begin
  select * into v_document from public.documents where id = p_document_id;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if v_document.status <> 'in_progress' or v_document.final_pdf_path is not null
    or exists (select 1 from public.recipients where document_id = p_document_id and status <> 'signed') then
    raise exception 'the document is not ready to finalize' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'organizationId', v_document.organization_id,
    'version', v_document.version,
    'originalPdfPath', v_document.original_pdf_path,
    'title', v_document.title,
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', field.type, 'page', field.page,
        'x', field.x, 'y', field.y, 'w', field.w, 'h', field.h,
        'value', field_value.value
      ))
      from public.fields as field
      join public.field_values as field_value on field_value.field_id = field.id
      where field.document_id = p_document_id
    ), '[]'::jsonb),
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', recipient.name, 'email', recipient.email, 'signedAt', recipient.signed_at
      ) order by recipient.signing_order, recipient.signed_at)
      from public.recipients as recipient
      where recipient.document_id = p_document_id
    ), '[]'::jsonb)
  );
end;
$$;

create function app_private.finalize_document(p_document_id uuid, p_final_pdf_path text, p_sha256 text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents;
begin
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if v_document.status <> 'in_progress' or v_document.final_pdf_path is not null
    or exists (select 1 from public.recipients where document_id = p_document_id and status <> 'signed') then
    raise exception 'the document is not ready to finalize' using errcode = '55000';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'final PDF hash is invalid' using errcode = '22023';
  end if;
  if p_final_pdf_path is null or split_part(p_final_pdf_path, '/', 1) <> v_document.organization_id::text then
    raise exception 'final PDF path is invalid' using errcode = '22023';
  end if;
  update public.documents
  set status = 'completed', completed_at = now(), final_pdf_path = p_final_pdf_path, final_pdf_sha256 = p_sha256
  where id = p_document_id;
  update public.document_versions
  set final_pdf_path = p_final_pdf_path, final_pdf_sha256 = p_sha256
  where document_id = p_document_id and version_number = v_document.version;
  insert into public.audit_events (organization_id, document_id, actor_type, event_type, metadata)
  values (v_document.organization_id, p_document_id, 'system', 'document.completed',
    jsonb_build_object('final_pdf_sha256', p_sha256));
end;
$$;

revoke all on function app_private.try_inet(text) from public, anon, authenticated;
revoke all on function app_private.lock_signing_link(text) from public, anon, authenticated;
revoke all on function app_private.signing_state(public.recipients, public.documents) from public, anon, authenticated;
revoke all on function app_private.expire_if_due(public.documents) from public, anon, authenticated;
revoke all on function app_private.signing_session_json(public.recipients, public.documents, text) from public, anon, authenticated;
revoke all on function app_private.open_signing_session(text, text, text) from public, anon, authenticated;
revoke all on function app_private.field_value_error(text, boolean, text) from public, anon, authenticated;
revoke all on function app_private.submit_signature(text, jsonb, boolean, text, text) from public, anon, authenticated;
revoke all on function app_private.decline_signing(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.finalization_payload(uuid) from public, anon, authenticated;
revoke all on function app_private.finalize_document(uuid, text, text) from public, anon, authenticated;
grant execute on function app_private.open_signing_session(text, text, text) to service_role;
grant execute on function app_private.submit_signature(text, jsonb, boolean, text, text) to service_role;
grant execute on function app_private.decline_signing(text, text, text, text) to service_role;
grant execute on function app_private.finalization_payload(uuid) to service_role;
grant execute on function app_private.finalize_document(uuid, text, text) to service_role;

create function public.open_signing_session(p_token_hash text, p_ip text, p_user_agent text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.open_signing_session(p_token_hash, p_ip, p_user_agent);
$$;

create function public.submit_signature(p_token_hash text, p_values jsonb, p_consent boolean, p_ip text, p_user_agent text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.submit_signature(p_token_hash, p_values, p_consent, p_ip, p_user_agent);
$$;

create function public.decline_signing(p_token_hash text, p_reason text, p_ip text, p_user_agent text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.decline_signing(p_token_hash, p_reason, p_ip, p_user_agent);
$$;

create function public.finalization_payload(p_document_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.finalization_payload(p_document_id);
$$;

create function public.finalize_document(p_document_id uuid, p_final_pdf_path text, p_sha256 text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.finalize_document(p_document_id, p_final_pdf_path, p_sha256);
$$;

revoke all on function public.open_signing_session(text, text, text) from public, anon, authenticated;
revoke all on function public.submit_signature(text, jsonb, boolean, text, text) from public, anon, authenticated;
revoke all on function public.decline_signing(text, text, text, text) from public, anon, authenticated;
revoke all on function public.finalization_payload(uuid) from public, anon, authenticated;
revoke all on function public.finalize_document(uuid, text, text) from public, anon, authenticated;
grant execute on function public.open_signing_session(text, text, text) to service_role;
grant execute on function public.submit_signature(text, jsonb, boolean, text, text) to service_role;
grant execute on function public.decline_signing(text, text, text, text) to service_role;
grant execute on function public.finalization_payload(uuid) to service_role;
grant execute on function public.finalize_document(uuid, text, text) to service_role;
