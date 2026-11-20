create table clinic_private.cutover (
  id boolean primary key default true check (id), ready boolean not null default false,
  owner_uid text, job_id uuid, expected jsonb, finished_at timestamptz
);
alter table clinic_private.cutover enable row level security;
revoke all on clinic_private.cutover from public, anon, authenticated;
insert into clinic_private.cutover(id) values(true);
create table clinic_private.import_rows (
  collection text not null, id text not null, data jsonb not null,
  primary key(collection,id)
);
alter table clinic_private.import_rows enable row level security;
revoke all on clinic_private.import_rows from public, anon, authenticated;
