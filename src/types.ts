/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DocumentStatus = 'uploading' | 'pending' | 'extracting' | 'indexing' | 'ready' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export interface Document {
  id: string;
  userId: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  checksum: string | null;
  status: DocumentStatus;
  pageCount: number | null;
  chunkCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  userId: string;
  chunkIndex: number;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  heading: string | null;
  tokenCount: number | null;
  metadata: string | null;
  createdAt: string;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalCount: number;
  readyCount: number;
  processingCount: number; // pending, extracting, indexing
  errorCount: number;
}

export interface FilterState {
  search: string;
  format: string; // 'All' | 'PDF' | 'DOCX' | 'TXT' | 'Markdown'
  status: string; // 'All' | 'ready' | 'failed' | 'processing'
}

export interface UploadingFile {
  id: string; // temporary upload id
  name: string;
  format: string; // pdf, docx, txt, md
  size: number;
  progress: number; // 0 to 100
  status: 'uploading' | 'pending' | 'failed' | 'ready';
  error?: string;
  cancelToken?: string;
}

export interface TreatmentStep {
  name: string;
  status: 'complete' | 'active' | 'pending' | 'failed';
  label: string;
  description: string;
  timestamp?: string;
}
