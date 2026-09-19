-- Repair migration for deployments where the original broken
-- 002_performance_optimization.sql may have been attempted/applied.
-- Idempotent: reassert the valid policies by rerunning the corrected policy set.

-- The corrected 002 file is the source of truth. This migration intentionally
-- repeats only the policy repairs that were invalid in the old 002.

drop policy if exists collection_documents_all_own on public.collection_documents;
create policy collection_documents_all_own on public.collection_documents
  for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and c.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  )
  with check (
    added_by = (select auth.uid())
    and exists (
      select 1 from public.collections c
      where c.id = collection_id
        and c.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  );

drop policy if exists collections_all_own on public.collections;
create policy collections_all_own on public.collections
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
      select 1 from public.documents d
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
      select 1 from public.documents d
      where d.id = document_id
        and d.owner_id = (select auth.uid())
    )
  );

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (id = (select auth.uid()));

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

create index if not exists idx_collection_documents_document_id
  on public.collection_documents(document_id);
create index if not exists idx_processing_jobs_document_id
  on public.processing_jobs(document_id);
create index if not exists idx_document_versions_owner_id
  on public.document_versions(owner_id);
