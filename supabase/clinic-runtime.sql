create schema if not exists clinic_private;
revoke all on schema clinic_private from public, anon, authenticated;
create table clinic_private.gateway_credentials (id boolean primary key default true check (id), key_hash text not null);
alter table clinic_private.gateway_credentials enable row level security;
revoke all on clinic_private.gateway_credentials from public, anon, authenticated;
create table clinic_private.requests (
  uid text not null, request_id uuid not null, body_hash text not null,
  created_at timestamptz not null default now(), primary key (uid, request_id)
);
alter table clinic_private.requests enable row level security;
revoke all on clinic_private.requests from public, anon, authenticated;

do $$
declare name text;
begin
  foreach name in array array['patients','visits','pharmacy','medicine_history','settings','settings_diagnosis','settings_dosage','settings_services','settings_unit'] loop
    execute format('alter table clinic.%I add column if not exists version bigint not null default 1', name);
  end loop;
end $$;

create or replace function clinic_private.gateway(p_key text, p_uid text, p_request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  allowed constant text[] := array['patients','visits','pharmacy','medicine_history','settings','settings_diagnosis','settings_dosage','settings_services','settings_unit'];
  action text := p_request->>'action';
  name text := p_request->>'collection';
  row_id text := p_request->>'id';
  item jsonb;
  current_data jsonb;
  new_data jsonb;
  result jsonb;
  actual_version bigint;
  expected_version bigint;
  operation_id uuid;
  request_hash text;
  saved_hash text;
  conditions text := '';
  ordering text := 'id';
  field text;
  operator text;
  generated_cn text;
begin
  if p_key is null or p_uid is null or p_uid = '' or not exists (
    select 1 from clinic_private.gateway_credentials
    where key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
  ) then raise exception 'CLINIC_FORBIDDEN' using errcode = '42501'; end if;

  if action = 'migration_status' then
    return jsonb_build_object('ready',(select ready from clinic_private.cutover where id));
  end if;
  if action in ('migration_begin','migration_upload','migration_finish') then
    perform pg_advisory_xact_lock(hashtextextended('clinic:write',0));
    if (select ready from clinic_private.cutover where id) then return jsonb_build_object('ready',true); end if;
    if action='migration_begin' then
      if exists(select 1 from clinic_private.cutover where id and owner_uid is not null and owner_uid<>p_uid) then raise exception 'MIGRATION_BUSY'; end if;
      if not (p_request->'expected') ?& allowed or (select count(*) from jsonb_object_keys(p_request->'expected'))<>9 then raise exception 'INVALID_MANIFEST'; end if;
      update clinic_private.cutover set owner_uid=p_uid,job_id=(p_request->>'jobId')::uuid,expected=p_request->'expected' where id;
      delete from clinic_private.import_rows;
    else
      if not exists(select 1 from clinic_private.cutover where id and owner_uid=p_uid and job_id=(p_request->>'jobId')::uuid) then raise exception 'INVALID_MIGRATION'; end if;
      if action='migration_upload' then
        if name is null or not name=any(allowed) then raise exception 'INVALID_COLLECTION'; end if;
        insert into clinic_private.import_rows(collection,id,data)
        select name,x.id,x.data from jsonb_to_recordset(p_request->'rows') as x(id text,data jsonb)
        on conflict(collection,id) do update set data=excluded.data;
      else
        foreach name in array allowed loop
          if (select count(*) from clinic_private.import_rows where collection=name) <> (select (expected->>name)::bigint from clinic_private.cutover where id) then raise exception 'INCOMPLETE_MIGRATION'; end if;
        end loop;
        foreach name in array allowed loop
          execute format('delete from clinic.%I where id not in (select id from clinic_private.import_rows where collection=$1)',name) using name;
          execute format('insert into clinic.%I(id,data,firestore_document) select id,data,''{}''::jsonb from clinic_private.import_rows where collection=$1 on conflict(id) do update set data=excluded.data,version=clinic.%I.version+1',name,name) using name;
        end loop;
        update clinic_private.cutover set ready=true,finished_at=now() where id;
        delete from clinic_private.import_rows;
      end if;
    end if;
    return jsonb_build_object('ok',true);
  end if;
  if not (select ready from clinic_private.cutover where id) then raise exception 'MIGRATION_REQUIRED'; end if;

  if action = 'read' then
    if name is null or not name = any(allowed) then raise exception 'INVALID_COLLECTION'; end if;
    if row_id is not null then conditions := format(' and id = %L', row_id); end if;
    if name = 'visits' then
      conditions := conditions || format(' and (data->>''ownerUid'' is null or data->>''workflowStatus'' = ''paid'' or data->>''ownerUid'' = %L)', p_uid);
    end if;
    for item in select value from jsonb_array_elements(coalesce(p_request->'constraints', '[]'::jsonb)) loop
      field := item->>'field';
      if field is null or length(field) > 100 then raise exception 'INVALID_FIELD'; end if;
      if item->>'kind' = 'where' then
        operator := item->>'op';
        if operator not in ('==','!=') then raise exception 'INVALID_OPERATOR'; end if;
        conditions := conditions || format(' and data ? %L and data->%L %s %L::jsonb', field, field, case operator when '==' then '=' else '<>' end, (item->'value')::text);
      elsif item->>'kind' = 'order' then
        ordering := format('data->>%L %s, id', field, case item->>'op' when 'desc' then 'desc' else 'asc' end);
      else raise exception 'INVALID_CONSTRAINT'; end if;
    end loop;
    execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''data'',data,''version'',version::text) order by %s), ''[]''::jsonb) from clinic.%I where true %s', ordering, name, conditions) into result;
    return result;
  end if;

  if action is distinct from 'commit' or jsonb_typeof(p_request->'writes') is distinct from 'array'
     or jsonb_array_length(p_request->'writes') > 300 then raise exception 'INVALID_ACTION'; end if;
  operation_id := (p_request->>'requestId')::uuid;
  if operation_id is null then raise exception 'INVALID_REQUEST_ID'; end if;
  request_hash := encode(sha256(convert_to(p_request::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('clinic:write',0));
  select body_hash into saved_hash from clinic_private.requests where uid=p_uid and request_id=operation_id;
  if found then
    if saved_hash <> request_hash then raise exception 'INVALID_REPLAY'; end if;
    return jsonb_build_object('ok',true,'replayed',true);
  end if;
  for item in select value from jsonb_array_elements(coalesce(p_request->'reads','[]'::jsonb)) loop
    name := item->>'collection';
    if name is null or not name = any(allowed) then raise exception 'INVALID_COLLECTION'; end if;
    actual_version := null;
    execute format('select version from clinic.%I where id=$1',name) into actual_version using item->>'id';
    expected_version := (item->>'version')::bigint;
    if actual_version is distinct from expected_version then raise exception 'CLINIC_CONFLICT' using errcode='40001'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_request->'writes') loop
    name := item->>'collection'; row_id := item->>'id';
    if name is null or not name = any(allowed) or row_id is null or row_id='' or length(row_id)>1500 then raise exception 'INVALID_DOCUMENT'; end if;
    current_data := null;
    execute format('select data from clinic.%I where id=$1',name) into current_data using row_id;
    if name='visits' and current_data->>'ownerUid' is not null and current_data->>'ownerUid'<>p_uid then raise exception 'CLINIC_FORBIDDEN' using errcode='42501'; end if;
    if item->>'action'='delete' then
      if name='visits' and (current_data->>'workflowStatus' not in ('draft','awaiting_medicine') or current_data->>'workflowStatus' is null or current_data ? 'dispensedAt' or current_data ? 'paidAt') then
        if not exists(select 1 from clinic.visits where id=current_data->>'episodeId' and data->>'workflowStatus'='paid' and data->>'ownerUid'=p_uid) then raise exception 'INVALID_VISIT_DELETE'; end if;
      end if;
      execute format('delete from clinic.%I where id=$1',name) using row_id;
      continue;
    end if;
    if jsonb_typeof(item->'data') is distinct from 'object' then raise exception 'INVALID_DATA'; end if;
    if item->>'action'='create' and current_data is not null then raise exception 'CLINIC_CONFLICT' using errcode='40001'; end if;
    if item->>'action'='update' and current_data is null then raise exception 'DOCUMENT_NOT_FOUND'; end if;
    if item->>'action' is null or item->>'action' not in ('create','set','merge','update') then raise exception 'INVALID_WRITE'; end if;
    new_data := case when item->>'action' in ('update','merge') then coalesce(current_data,'{}'::jsonb) || (item->'data') else item->'data' end;
    if name='patients' and current_data is null then
      select 'CN' || lpad((coalesce(max(substring(data->>'cn' from '^CN([0-9]+)$')::bigint),0)+1)::text,5,'0') into generated_cn from clinic.patients;
      new_data := new_data || jsonb_build_object('cn',generated_cn);
    end if;
    if name='visits' and new_data->>'ownerUid' is not null and new_data->>'ownerUid'<>p_uid then raise exception 'CLINIC_FORBIDDEN' using errcode='42501'; end if;
    if name='pharmacy' and ((new_data->>'stockQty')::numeric<0 or (new_data->>'stockQty')::numeric='NaN'::numeric) then raise exception 'INVALID_STOCK'; end if;
    execute format('insert into clinic.%I(id,data,firestore_document) values($1,$2,''{}''::jsonb) on conflict(id) do update set data=excluded.data,version=clinic.%I.version+1',name,name) using row_id,new_data;
  end loop;
  insert into clinic_private.requests(uid,request_id,body_hash) values(p_uid,operation_id,request_hash);
  return jsonb_build_object('ok',true);
end $$;
revoke all on function clinic_private.gateway(text,text,jsonb) from public;
grant usage on schema clinic_private to anon, authenticated;
grant execute on function clinic_private.gateway(text,text,jsonb) to anon, authenticated;
create or replace function public.clinic_gateway(p_key text,p_uid text,p_request jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select clinic_private.gateway(p_key,p_uid,p_request);
$$;
revoke all on function public.clinic_gateway(text,text,jsonb) from public;
grant execute on function public.clinic_gateway(text,text,jsonb) to anon, authenticated;
