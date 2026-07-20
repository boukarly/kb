/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  documentName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function DeleteDocumentDialog({ isOpen, documentName, onConfirm, onCancel, isDeleting = false }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs transition-opacity duration-300">
      <div
        id="delete-confirm-dialog"
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md p-6 bg-white border border-gray-100 shadow-xl rounded-3xl animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-all"
          disabled={isDeleting}
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              Suppression définitive
            </h3>
            <p className="text-xs text-gray-400">Cette action est irréversible.</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 leading-relaxed">
            Êtes-vous sûr de vouloir supprimer définitivement le document <strong className="text-gray-800 font-semibold">« {documentName} »</strong> ?
          </p>
          <p className="text-xs text-rose-600 bg-rose-50/30 border border-rose-100/30 p-2.5 rounded-xl mt-3">
            Cela supprimera également tous les passages indexés associés ({documentName}) et le fichier physique du stockage SQLite.
          </p>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4.5 py-2.5 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-gray-700 font-medium rounded-full text-xs transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 active:scale-98 text-white font-medium rounded-full text-xs transition-all shadow-xs"
          >
            {isDeleting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Suppression...</span>
              </>
            ) : (
              <>
                <Trash2 size={13} />
                <span>Confirmer la suppression</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
