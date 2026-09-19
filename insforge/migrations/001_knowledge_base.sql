-- Mansour Knowledge Base — complete InsForge database schema
-- Safe to run from the InsForge SQL Editor.
-- No BEGIN / COMMIT statements are used.
-- The script is idempotent and repairs a partially executed earlier migration.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- TABLES
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  description text,
  color text,
  document_count integer not null default 0
    check (document_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  original_filename text not null,
  mime_type text not null,
  extension text not null,
  size_bytes bigint not null
    check (size_bytes >= 0),
  bucket_name text not null default 'knowledge-documents',
  object_key text not null,
  storage_url text,
  checksum_sha256 text,
  status text not null default 'uploaded'
    check (
      status in (
        'uploading',
        'uploaded',
        'queued',
        'extracting',
        'chunking',
        'indexing',
        'ready',
        'failed',
        'deleting',
        'deleted'
      )
    ),
  progress integer not null default 0
    check (progress between 0 and 100),
  current_stage text,
  page_count integer
    check (page_count is null or page_count >= 0),
  chunk_count integer not null default 0
    check (chunk_count >= 0),
  language text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.documents(id) on delete cascade,
  owner_id uuid not null,
  version_number integer not null
    check (version_number > 0),
  object_key text not null,
  checksum_sha256 text,
  size_bytes bigint not null
    check (size_bytes >= 0),
  page_count integer
    check (page_count is null or page_count >= 0),
  extracted_text text,
  extraction_engine text,
  extraction_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.documents(id) on delete cascade,
  version_id uuid
    references public.document_versions(id) on delete cascade,
  owner_id uuid not null,
  chunk_index integer not null
    check (chunk_index >= 0),
  content text not null,
  heading text,
  page_start integer
    check (page_start is null or page_start >= 0),
  page_end integer
    check (page_end is null or page_end >= 0),
  token_count integer
    check (token_count is null or token_count >= 0),
  chunk_hash text,
  search_vector tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(heading, '') || ' ' || coalesce(content, '')
    )
  ) stored,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_documents (
  collection_id uuid not null
    references public.collections(id) on delete cascade,
  document_id uuid not null
    references public.documents(id) on delete cascade,
  added_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (collection_id, document_id)
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.documents(id) on delete cascade,
  owner_id uuid not null,
  job_type text not null
    check (job_type in ('process', 'reindex', 'delete')),
  status text not null default 'queued'
    check (
      status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
    ),
  stage text,
  progress integer not null default 0
    check (progress between 0 and 100),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  max_attempts integer not null default 3
    check (max_attempts > 0),
  locked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  token_hash text not null unique,
  scopes text[] not null default array['read']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- REPAIR / UPGRADE A PARTIALLY CREATED SCHEMA
-- -----------------------------------------------------------------------------

alter table public.collections
  add column if not exists document_count integer not null default 0;

alter table public.document_chunks
  add column if not exists version_id uuid;

alter table public.document_chunks
  add column if not exists embedding vector(1536);

alter table public.document_chunks
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.processing_jobs
  add column if not exists locked_at timestamptz;

alter table public.processing_jobs
  add column if not exists started_at timestamptz;

alter table public.processing_jobs
  add column if not exists finished_at timestamptz;

alter table public.document_chunks
  drop constraint if exists document_chunks_document_id_chunk_index_key;

DO $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_chunks_version_id_fkey'
      and conrelid = 'public.document_chunks'::regclass
  ) then
    alter table public.document_chunks
      add constraint document_chunks_version_id_fkey
      foreign key (version_id)
      references public.document_versions(id)
      on delete cascade;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

create unique index if not exists documents_object_key_uq
  on public.documents(object_key);

create unique index if not exists documents_owner_checksum_uq
  on public.documents(owner_id, checksum_sha256)
  where checksum_sha256 is not null
    and deleted_at is null;

create index if not exists documents_owner_created_idx
  on public.documents(owner_id, created_at desc);

create index if not exists documents_owner_status_idx
  on public.documents(owner_id, status);

create index if not exists documents_title_search_idx
  on public.documents
  using gin (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(original_filename, '')
    )
  );

create index if not exists document_versions_document_idx
  on public.document_versions(document_id, version_number desc);

create unique index if not exists document_chunks_without_version_uq
  on public.document_chunks(document_id, chunk_index)
  where version_id is null;

create unique index if not exists document_chunks_with_version_uq
  on public.document_chunks(document_id, version_id, chunk_index)
  where version_id is not null;

create index if not exists document_chunks_search_idx
  on public.document_chunks using gin(search_vector);

create index if not exists document_chunks_owner_document_idx
  on public.document_chunks(owner_id, document_id, chunk_index);

create index if not exists processing_jobs_queue_idx
  on public.processing_jobs(status, created_at);

create index if not exists processing_jobs_owner_idx
  on public.processing_jobs(owner_id, created_at desc);

create index if not exists audit_logs_actor_created_idx
  on public.audit_logs(actor_id, created_at desc);

create index if not exists mcp_clients_owner_idx
  on public.mcp_clients(owner_id, created_at desc);

-- -----------------------------------------------------------------------------
-- FUNCTIONS
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.increment_collection_document_count()
returns trigger
language plpgsql
as $$
begin
  update public.collections
  set document_count = document_count + 1
  where id = new.collection_id;

  return new;
end;
$$;

create or replace function public.decrement_collection_document_count()
returns trigger
language plpgsql
as $$
begin
  update public.collections
  set document_count = greatest(document_count - 1, 0)
  where id = old.collection_id;

  return old;
end;
$$;

create or replace function public.increment_document_chunk_count()
returns trigger
language plpgsql
as $$
begin
  update public.documents
  set chunk_count = chunk_count + 1
  where id = new.document_id;

  return new;
end;
$$;

create or replace function public.decrement_document_chunk_count()
returns trigger
language plpgsql
as $$
begin
  update public.documents
  set chunk_count = greatest(chunk_count - 1, 0)
  where id = old.document_id;

  return old;
end;
$$;

create or replace function public.get_dashboard_stats()
returns table (
  total_count bigint,
  ready_count bigint,
  processing_count bigint,
  error_count bigint
)
language sql
stable
security invoker
as $$
  select
    count(*) filter (where deleted_at is null) as total_count,
    count(*) filter (
      where status = 'ready'
        and deleted_at is null
    ) as ready_count,
    count(*) filter (
      where status in (
        'uploading',
        'uploaded',
        'queued',
        'extracting',
        'chunking',
        'indexing'
      )
        and deleted_at is null
    ) as processing_count,
    count(*) filter (
      where status = 'failed'
        and deleted_at is null
    ) as error_count
  from public.documents
  where owner_id = auth.uid();
$$;

create or replace function public.search_document_chunks(
  search_query text,
  result_limit integer default 20
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  heading text,
  content text,
  page_start integer,
  page_end integer,
  rank real
)
language sql
stable
security invoker
as $$
  with ranked_results as (
    select
      c.id as chunk_id,
      c.document_id,
      d.title as document_title,
      c.heading,
      c.content,
      c.page_start,
      c.page_end,
      c.chunk_index,
      ts_rank_cd(
        c.search_vector,
        websearch_to_tsquery('simple', search_query)
      )::real as search_rank
    from public.document_chunks c
    join public.documents d
      on d.id = c.document_id
    where c.owner_id = auth.uid()
      and d.deleted_at is null
      and length(trim(search_query)) > 0
      and c.search_vector @@ websearch_to_tsquery(
        'simple',
        search_query
      )
  )
  select
    ranked_results.chunk_id,
    ranked_results.document_id,
    ranked_results.document_title,
    ranked_results.heading,
    ranked_results.content,
    ranked_results.page_start,
    ranked_results.page_end,
    ranked_results.search_rank as rank
  from ranked_results
  order by
    ranked_results.search_rank desc,
    ranked_results.chunk_index asc
  limit greatest(1, least(coalesce(result_limit, 20), 100));
$$;

-- -----------------------------------------------------------------------------
-- TRIGGERS
-- -----------------------------------------------------------------------------

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists processing_jobs_updated_at on public.processing_jobs;
create trigger processing_jobs_updated_at
before update on public.processing_jobs
for each row execute function public.set_updated_at();

drop trigger if exists collection_documents_after_insert
  on public.collection_documents;
create trigger collection_documents_after_insert
after insert on public.collection_documents
for each row
execute function public.increment_collection_document_count();

drop trigger if exists collection_documents_after_delete
  on public.collection_documents;
create trigger collection_documents_after_delete
after delete on public.collection_documents
for each row
execute function public.decrement_collection_document_count();

drop trigger if exists document_chunks_after_insert
  on public.document_chunks;
create trigger document_chunks_after_insert
after insert on public.document_chunks
for each row
execute function public.increment_document_chunk_count();

drop trigger if exists document_chunks_after_delete
  on public.document_chunks;
create trigger document_chunks_after_delete
after delete on public.document_chunks
for each row
execute function public.decrement_document_chunk_count();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_chunks enable row level security;
alter table public.collection_documents enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.mcp_clients enable row level security;

-- Remove older policy names so this migration can be rerun safely.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists collections_owner_policy on public.collections;
drop policy if exists collections_all_own on public.collections;
drop policy if exists documents_owner_policy on public.documents;
drop policy if exists documents_all_own on public.documents;
drop policy if exists versions_select_own on public.document_versions;
drop policy if exists versions_insert_own on public.document_versions;
drop policy if exists versions_update_own on public.document_versions;
drop policy if exists versions_delete_own on public.document_versions;
drop policy if exists chunks_owner_policy on public.document_chunks;
drop policy if exists chunks_all_own on public.document_chunks;
drop policy if exists collection_documents_owner_policy
  on public.collection_documents;
drop policy if exists collection_documents_all_own
  on public.collection_documents;
drop policy if exists jobs_owner_policy on public.processing_jobs;
drop policy if exists jobs_all_own on public.processing_jobs;
drop policy if exists audit_owner_select on public.audit_logs;
drop policy if exists audit_owner_insert on public.audit_logs;
drop policy if exists audit_select_own on public.audit_logs;
drop policy if exists audit_insert_own on public.audit_logs;
drop policy if exists mcp_clients_all_own on public.mcp_clients;

create policy profiles_select_own
on public.profiles
for select
using (id = auth.uid());

create policy profiles_insert_own
on public.profiles
for insert
with check (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy collections_all_own
on public.collections
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy documents_all_own
on public.documents
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy versions_select_own
on public.document_versions
for select
using (owner_id = auth.uid());

create policy versions_insert_own
on public.document_versions
for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.owner_id = auth.uid()
  )
);

create policy versions_update_own
on public.document_versions
for update
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.owner_id = auth.uid()
  )
);

create policy versions_delete_own
on public.document_versions
for delete
using (owner_id = auth.uid());

create policy chunks_all_own
on public.document_chunks
for all
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.owner_id = auth.uid()
  )
);

create policy collection_documents_all_own
on public.collection_documents
for all
using (
  exists (
    select 1
    from public.collections c
    where c.id = collection_id
      and c.owner_id = auth.uid()
  )
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.owner_id = auth.uid()
  )
)
with check (
  added_by = auth.uid()
  and exists (
    select 1
    from public.collections c
    where c.id = collection_id
      and c.owner_id = auth.uid()
  )
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.owner_id = auth.uid()
  )
);

create policy jobs_all_own
on public.processing_jobs
for all
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.owner_id = auth.uid()
  )
);

create policy audit_select_own
on public.audit_logs
for select
using (actor_id = auth.uid());

create policy audit_insert_own
on public.audit_logs
for insert
with check (actor_id = auth.uid());

create policy mcp_clients_all_own
on public.mcp_clients
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
