/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Document } from '../types';
import DocumentStatusBadge from './DocumentStatusBadge';
import { FileText, Calendar, Eye, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  documents: Document[];
  onSelect: (id: string) => void;
  onReindex: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function DocumentTable({ documents, onSelect, onReindex, onDelete }: Props) {
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

  return (
    <div className="hidden md:block bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table id="documents-table-raw" className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/30">
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Taille</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pages</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Passages</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ajouté le</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {documents.map((doc) => {
              const isProcessing = ['pending', 'extracting', 'indexing', 'uploading'].includes(doc.status);

              return (
                <tr
                  key={doc.id}
                  id={`table-row-${doc.id}`}
                  className="hover:bg-gray-50/50 transition-all duration-150"
                >
                  {/* Title and Original Filename */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-50/50 text-indigo-500">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 max-w-xs lg:max-w-md">
                        <p
                          onClick={() => onSelect(doc.id)}
                          className="font-medium text-gray-800 truncate hover:text-indigo-600 cursor-pointer text-sm"
                          title={doc.name}
                        >
                          {doc.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate" title={doc.originalFilename}>
                          {doc.originalFilename}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-6">
                    <DocumentStatusBadge status={doc.status} size="sm" />
                  </td>

                  {/* File Size */}
                  <td className="py-4 px-6 text-sm text-gray-600">
                    {formatSize(doc.fileSize)}
                  </td>

                  {/* Pages Count */}
                  <td className="py-4 px-6 text-sm font-medium text-gray-700">
                    {doc.pageCount || '—'}
                  </td>

                  {/* Chunks Count */}
                  <td className="py-4 px-6 text-sm font-medium text-gray-700">
                    {doc.chunkCount || '—'}
                  </td>

                  {/* Creation Date */}
                  <td className="py-4 px-6 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-gray-400" />
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                  </td>

                  {/* Actions column */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSelect(doc.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/50 hover:bg-indigo-100/80 text-indigo-700 font-medium text-xs rounded-xl transition-all"
                        title="Consulter les détails"
                      >
                        <Eye size={13} />
                        <span>Consulter</span>
                      </button>

                      <button
                        onClick={() => onReindex(doc.id)}
                        disabled={isProcessing}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 disabled:opacity-50 disabled:hover:text-gray-500 disabled:hover:bg-transparent rounded-xl transition-all"
                        title="Relancer le traitement"
                      >
                        <RefreshCw size={13} className={isProcessing ? 'animate-spin' : ''} />
                      </button>

                      <button
                        onClick={() => onDelete(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Supprimer définitivement"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
