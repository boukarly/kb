/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Document } from '../types';
import DocumentStatusBadge from './DocumentStatusBadge';
import { Calendar, Eye, Trash2, RefreshCw, FileText } from 'lucide-react';

interface Props {
  key?: React.Key;
  document: Document;
  onSelect: (id: string) => void;
  onReindex: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function DocumentCard({ document, onSelect, onReindex, onDelete }: Props) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const isProcessing = ['pending', 'extracting', 'indexing', 'uploading'].includes(document.status);

  return (
    <div
      id={`doc-card-${document.id}`}
      className="flex flex-col bg-white border border-gray-100 rounded-2xl shadow-xs p-4 hover:shadow-sm hover:border-indigo-100/50 transition-all md:hidden"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-500 mt-0.5">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h4
              onClick={() => onSelect(document.id)}
              className="text-sm font-semibold text-gray-800 truncate hover:text-indigo-600 cursor-pointer"
              title={document.name}
            >
              {document.name}
            </h4>
            <p className="text-xs text-gray-400 truncate">{document.originalFilename}</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <DocumentStatusBadge status={document.status} size="sm" />
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-b border-gray-50 py-3 mb-4 text-xs text-gray-500">
        <div>
          <span className="text-gray-400 block mb-0.5">Taille</span>
          <span className="font-medium text-gray-700">{formatSize(document.fileSize)}</span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5 font-sans">Pages</span>
          <span className="font-medium text-gray-700">{document.pageCount || '—'}</span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5 font-sans">Passages</span>
          <span className="font-medium text-gray-700">{document.chunkCount || '—'}</span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5">Créé le</span>
          <span className="font-medium text-gray-700 inline-flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(document.createdAt)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={() => onSelect(document.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-xl transition-all"
        >
          <Eye size={13} />
          <span>Consulter</span>
        </button>

        <button
          onClick={() => onReindex(document.id)}
          disabled={isProcessing}
          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:text-gray-500 disabled:hover:bg-transparent border border-gray-100 rounded-xl transition-all"
          title="Réindexer le document"
        >
          <RefreshCw size={13} className={isProcessing ? 'animate-spin' : ''} />
        </button>

        <button
          onClick={() => onDelete(document.id)}
          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50/50 border border-gray-100 rounded-xl transition-all"
          title="Supprimer définitivement"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
