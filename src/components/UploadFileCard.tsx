/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UploadingFile } from '../types';
import { FileText, X, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface Props {
  key?: React.Key;
  file: UploadingFile;
  onCancel: (id: string) => void;
}

export default function UploadFileCard({ file, onCancel }: Props) {
  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFormatIcon = (format: string) => {
    return <FileText className="text-indigo-500" size={20} />;
  };

  const getStatusColor = (status: UploadingFile['status']) => {
    switch (status) {
      case 'failed': return 'text-rose-600';
      case 'ready': return 'text-emerald-600';
      default: return 'text-gray-500';
    }
  };

  return (
    <div
      id={`upload-file-card-${file.id}`}
      className="flex items-start gap-4 p-4 bg-white border border-gray-100 shadow-xs rounded-2xl transition-all"
    >
      <div className="p-3 rounded-xl bg-indigo-50/50">
        {getFormatIcon(file.format)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>
            {file.name}
          </p>
          <button
            onClick={() => onCancel(file.id)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-all"
            title="Annuler le téléversement"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
          <span className="uppercase font-semibold tracking-wider text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-sm">
            {file.format}
          </span>
          <span>•</span>
          <span>{formatSize(file.size)}</span>
          <span>•</span>
          <span className={`capitalize ${getStatusColor(file.status)}`}>
            {file.status === 'uploading' && 'Téléversement...'}
            {file.status === 'pending' && 'En attente...'}
            {file.status === 'ready' && 'Terminé'}
            {file.status === 'failed' && 'Échec'}
          </span>
        </div>

        {file.status === 'uploading' && (
          <div className="w-full">
            <div className="flex justify-between items-center mb-1 text-[11px] text-gray-500">
              <span>Progression</span>
              <span className="font-semibold">{file.progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${file.progress}%` }}
              />
            </div>
          </div>
        )}

        {file.status === 'failed' && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50/50 p-2 rounded-xl border border-rose-100/50 mt-1">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span className="truncate">{file.error || 'Erreur inconnue'}</span>
          </div>
        )}

        {file.status === 'ready' && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
            <CheckCircle size={14} />
            <span>Fichier téléversé avec succès. Indexation lancée.</span>
          </div>
        )}
      </div>
    </div>
  );
}
