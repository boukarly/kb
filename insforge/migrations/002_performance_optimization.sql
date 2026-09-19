-- InsForge performance + RLS hardening
-- Safe for InsForge transactional migrations: intentionally NO CONCURRENTLY.

-- ---------------------------------------------------------------------------
-- Foreign-key / ownership indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_document_chunks_document_id
  on public.document_chunks(document_id);

create index if not exists idx_document_chunks_version_id
  on public.document_chunks(version_id);

create index if not exists idx_collection_documents_document_id
  on public.collection_documents(document_id);

create index if not exists idx_collection_documents_collection_id
  on public.collection_documents(collection_id);

create index if not exists idx_processing_jobs_document_id
  on public.processing_jobs(document_id);

create index if not exists idx_document_versions_owner_id
  on public.document_versions(owner_id);

create index if not exists idx_collections_owner_id
  on public.collections(owner_id);

create index if not exists idx_documents_owner_id
  on public.documents(owner_id);

create index if not exists idx_document_chunks_owner_id
  on public.document_chunks(owner_id);

create index if not exists idx_processing_jobs_owner_id
  on public.processing_jobs(owner_id);

create index if not exists idx_mcp_clients_owner_id
  on public.mcp_clients(owner_id);

-- ---------------------------------------------------------------------------
-- RLS policies.
-- (select auth.uid()) lets PostgreSQL evaluate the auth helper once per query.
-- Column names match 001_knowledge_base.sql exactly.
-- ---------------------------------------------------------------------------

drop policy if exists audit_insert_own on public.audit_logs;
create policy audit_insert_own on public.audit_logs
  for insert
  with check ((select auth.uid()) = actor_id);

drop policy if exists audit_select_own on public.audit_logs;
create policy audit_select_own on public.audit_logs
  for select
  using ((select auth.uid()) = actor_id);

drop policy if exists collections_all_own on public.collections;
create policy collections_all_own on public.collections
  for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists documents_all_own on public.documents;
create policy documents_all_own on public.documents
  for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists chunks_all_own on public.document_chunks;
create policy chunks_all_own on public.document_chunks
  for all
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  );

drop policy if exists versions_select_own on public.document_versions;
create policy versions_select_own on public.document_versions
  for select
  using ((select auth.uid()) = owner_id);

drop policy if exists versions_insert_own on public.document_versions;
create policy versions_insert_own on public.document_versions
  for insert
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  );

drop policy if exists versions_update_own on public.document_versions;
create policy versions_update_own on public.document_versions
  for update
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  );

drop policy if exists versions_delete_own on public.document_versions;
create policy versions_delete_own on public.document_versions
  for delete
  using ((select auth.uid()) = owner_id);

drop policy if exists collection_documents_all_own on public.collection_documents;
create policy collection_documents_all_own on public.collection_documents
  for all
  using (
    exists (
      select 1
      from public.collections c
      where c.id = collection_id
        and c.owner_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  )
  with check (
    added_by = (select auth.uid())
    and exists (
      select 1
      from public.collections c
      where c.id = collection_id
        and c.owner_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  );

drop policy if exists jobs_all_own on public.processing_jobs;
create policy jobs_all_own on public.processing_jobs
  for all
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  );

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists mcp_clients_all_own on public.mcp_clients;
create policy mcp_clients_all_own on public.mcp_clients
  for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
