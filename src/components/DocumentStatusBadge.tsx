/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DocumentStatus } from '../types';
import { RefreshCw, CheckCircle2, AlertTriangle, CloudLightning, FileText, Binary } from 'lucide-react';

interface Props {
  status: DocumentStatus;
  size?: 'sm' | 'md';
}

export default function DocumentStatusBadge({ status, size = 'md' }: Props) {
  const isSm = size === 'sm';
  const paddingClass = isSm ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  const iconSize = isSm ? 13 : 15;

  const config: Record<DocumentStatus, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    uploading: {
      bg: 'bg-blue-50/70 border border-blue-100',
      text: 'text-blue-700 font-medium',
      label: 'Téléversement',
      icon: <RefreshCw size={iconSize} className="animate-spin text-blue-600" />
    },
    pending: {
      bg: 'bg-gray-100/80 border border-gray-200/50',
      text: 'text-gray-700 font-medium',
      label: 'En attente',
      icon: <CloudLightning size={iconSize} className="text-gray-500" />
    },
    extracting: {
      bg: 'bg-amber-50/70 border border-amber-100',
      text: 'text-amber-700 font-medium',
      label: 'Extraction du texte',
      icon: <FileText size={iconSize} className="animate-pulse text-amber-600" />
    },
    indexing: {
      bg: 'bg-indigo-50/70 border border-indigo-100',
      text: 'text-indigo-700 font-medium',
      label: "Création de l'index",
      icon: <Binary size={iconSize} className="animate-pulse text-indigo-600" />
    },
    ready: {
      bg: 'bg-emerald-50/70 border border-emerald-100',
      text: 'text-emerald-700 font-medium',
      label: 'Prêt pour Claude',
      icon: <CheckCircle2 size={iconSize} className="text-emerald-600" />
    },
    failed: {
      bg: 'bg-rose-50/70 border border-rose-100',
      text: 'text-rose-700 font-medium',
      label: 'Échec',
      icon: <AlertTriangle size={iconSize} className="text-rose-600" />
    }
  };

  const current = config[status] || config.pending;

  return (
    <span id={`status-badge-${status}`} className={`inline-flex items-center gap-1.5 rounded-full ${current.bg} ${current.text} ${paddingClass}`}>
      {current.icon}
      <span>{current.label}</span>
    </span>
  );
}
