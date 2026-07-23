begin;
create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  original_filename text not null,
  mime_type text not null,
  extension text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  bucket_name text not null default 'knowledge-documents',
  object_key text not null,
  storage_url text,
  checksum_sha256 text,
  status text not null default 'uploaded' check (status in ('uploading','uploaded','queued','extracting','chunking','indexing','ready','failed','deleting','deleted')),
  progress integer not null default 0 check (progress between 0 and 100),
  current_stage text,
  page_count integer,
  chunk_count integer not null default 0,
  language text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid not null,
  chunk_index integer not null,
  content text not null,
  heading text,
  page_start integer,
  page_end integer,
  token_count integer,
  chunk_hash text,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(heading,'') || ' ' || coalesce(content,''))) stored,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  description text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

create table if not exists public.collection_documents (
  collection_id uuid not null references public.collections(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  added_by uuid not null,
  created_at timestamptz not null default now(),
  primary key(collection_id, document_id)
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid not null,
  job_type text not null check (job_type in ('process','reindex','delete')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  stage text,
  progress integer not null default 0,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
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

create index if not exists documents_owner_created_idx on public.documents(owner_id, created_at desc);
create index if not exists documents_owner_status_idx on public.documents(owner_id, status);
create index if not exists document_chunks_search_idx on public.document_chunks using gin(search_vector);
create index if not exists document_chunks_owner_idx on public.document_chunks(owner_id, document_id, chunk_index);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at before update on public.documents for each row execute function public.set_updated_at();
drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at before update on public.collections for each row execute function public.set_updated_at();
drop trigger if exists processing_jobs_updated_at on public.processing_jobs;
create trigger processing_jobs_updated_at before update on public.processing_jobs for each row execute function public.set_updated_at();

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.collections enable row level security;
alter table public.collection_documents enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.audit_logs enable row level security;

create policy documents_owner_policy on public.documents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy chunks_owner_policy on public.document_chunks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy collections_owner_policy on public.collections for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy collection_documents_owner_policy on public.collection_documents for all using (
  exists(select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
) with check (
  added_by = auth.uid() and exists(select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
);
create policy jobs_owner_policy on public.processing_jobs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy audit_owner_select on public.audit_logs for select using (actor_id = auth.uid());
create policy audit_owner_insert on public.audit_logs for insert with check (actor_id = auth.uid());

create or replace function public.search_document_chunks(search_query text, result_limit integer default 20)
returns table(chunk_id uuid, document_id uuid, document_title text, heading text, content text, page_start integer, page_end integer, rank real)
language sql stable security invoker as $$
  select c.id,c.document_id,d.title,c.heading,c.content,c.page_start,c.page_end,
         ts_rank_cd(c.search_vector, websearch_to_tsquery('simple',search_query))::real
  from public.document_chunks c join public.documents d on d.id=c.document_id
  where c.owner_id=auth.uid() and d.deleted_at is null
    and c.search_vector @@ websearch_to_tsquery('simple',search_query)
  order by rank desc,c.chunk_index asc limit greatest(1,least(result_limit,100));
$$;
commit;
