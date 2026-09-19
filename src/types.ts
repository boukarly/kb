export type DocumentStatus =
  | 'uploading'
  | 'uploaded'
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'indexing'
  | 'ready'
  | 'failed'
  | 'deleting'
  | 'deleted';

export interface AuthUser {
  id: string;
  email: string;
  profile?: {
    name?: string;
    avatar_url?: string;
  };
}

export interface KnowledgeDocument {
  id: string;
  owner_id: string;
  title: string;
  original_filename: string;
  mime_type: string;
  extension: string;
  size_bytes: number;
  bucket_name: string;
  object_key: string;
  storage_url: string | null;
  checksum_sha256: string | null;
  status: DocumentStatus;
  progress: number;
  current_stage: string | null;
  page_count: number | null;
  chunk_count: number;
  language: string | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  owner_id: string;
  chunk_index: number;
  content: string;
  heading: string | null;
  page_start: number | null;
  page_end: number | null;
  token_count: number | null;
  created_at: string;
}

export interface DashboardStats {
  totalCount: number;
  readyCount: number;
  processingCount: number;
  errorCount: number;
}
