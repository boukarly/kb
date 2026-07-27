-- Fix InsForge Backend Advisor Performance Issues
-- This migration addresses 24 performance warnings

-- ============================================================================
-- SECTION 1: Create indexes for foreign key columns (Issues 1-4)
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_document_id
ON public.document_chunks(document_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_version_id
ON public.document_chunks(version_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_documents_document_id
ON public.collection_documents(document_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_jobs_document_id
ON public.processing_jobs(document_id);

-- ============================================================================
-- SECTION 2: Optimize RLS policies - wrap auth.uid() in subquery (Issues 5-19)
-- ============================================================================

-- audit_logs
DROP POLICY IF EXISTS audit_insert_own ON public.audit_logs;
CREATE POLICY audit_insert_own ON public.audit_logs
  FOR INSERT
  WITH CHECK ((select auth.uid()) = actor_id);

DROP POLICY IF EXISTS audit_select_own ON public.audit_logs;
CREATE POLICY audit_select_own ON public.audit_logs
  FOR SELECT
  USING ((select auth.uid()) = actor_id);

-- collection_documents
DROP POLICY IF EXISTS collection_documents_all_own ON public.collection_documents;
CREATE POLICY collection_documents_all_own ON public.collection_documents
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- collections
DROP POLICY IF EXISTS collections_all_own ON public.collections;
CREATE POLICY collections_all_own ON public.collections
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- document_chunks
DROP POLICY IF EXISTS chunks_all_own ON public.document_chunks;
CREATE POLICY chunks_all_own ON public.document_chunks
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- document_versions
DROP POLICY IF EXISTS versions_delete_own ON public.document_versions;
CREATE POLICY versions_delete_own ON public.document_versions
  FOR DELETE
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS versions_insert_own ON public.document_versions;
CREATE POLICY versions_insert_own ON public.document_versions
  FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS versions_select_own ON public.document_versions;
CREATE POLICY versions_select_own ON public.document_versions
  FOR SELECT
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS versions_update_own ON public.document_versions;
CREATE POLICY versions_update_own ON public.document_versions
  FOR UPDATE
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

-- documents
DROP POLICY IF EXISTS documents_all_own ON public.documents;
CREATE POLICY documents_all_own ON public.documents
  FOR ALL
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

-- mcp_clients
DROP POLICY IF EXISTS mcp_clients_all_own ON public.mcp_clients;
CREATE POLICY mcp_clients_all_own ON public.mcp_clients
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- processing_jobs
DROP POLICY IF EXISTS jobs_all_own ON public.processing_jobs;
CREATE POLICY jobs_all_own ON public.processing_jobs
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- profiles
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- SECTION 3: Create indexes for RLS policy columns (Issues 20-24)
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_documents_owner_id
ON public.collection_documents(owner_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_versions_owner_id
ON public.document_versions(owner_id);

-- ============================================================================
-- Summary of fixes:
-- - 4 indexes on foreign key columns (prevents full table scans on JOINs)
-- - 15 optimized RLS policies (wraps auth.uid() to evaluate once per query)
-- - 2 indexes on RLS policy columns (prevents sequential scans on filtered queries)
-- ============================================================================
