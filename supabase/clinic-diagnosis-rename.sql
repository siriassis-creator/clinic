create or replace function clinic_private.propagate_diagnosis_label()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if nullif(btrim(new.data->>'label'),'') is null then raise exception 'INVALID_DIAGNOSIS'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinic:write',0));
  update clinic.visits set data=jsonb_set(data,'{diagnosis}',to_jsonb(new.data->>'label'))
    || case when data->>'workflowStatus'='draft' then jsonb_build_object('revision',coalesce((data->>'revision')::bigint,0)+1) else '{}'::jsonb end,
    version=version+1 where data->>'diagnosis'=old.data->>'label';
  return new;
end $$;
revoke all on function clinic_private.propagate_diagnosis_label() from public,anon,authenticated;
create trigger propagate_diagnosis_label after update of data on clinic.settings_diagnosis
for each row when (old.data->>'label' is distinct from new.data->>'label')
execute function clinic_private.propagate_diagnosis_label();
