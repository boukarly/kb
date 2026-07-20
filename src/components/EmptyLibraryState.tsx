/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileQuestion, UploadCloud } from 'lucide-react';

interface Props {
  hasFilters: boolean;
  onClearFilters?: () => void;
  onUploadClick?: () => void;
}

export default function EmptyLibraryState({ hasFilters, onClearFilters, onUploadClick }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-16 bg-white border border-gray-100 rounded-3xl shadow-xs">
      <div className="p-4 bg-gray-50 text-gray-400 rounded-2xl mb-4">
        <FileQuestion size={36} />
      </div>

      <h3 className="text-lg font-semibold text-gray-800 mb-1">
        {hasFilters ? 'Aucun document trouvé' : 'Votre bibliothèque est vide'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {hasFilters
          ? 'Aucun document ne correspond à vos filtres actuels. Essayez de réinitialiser la recherche ou de changer les statuts sélectionnés.'
          : 'Déposez votre premier document (PDF, Word, Texte ou Markdown) pour commencer à indexer votre savoir pour Claude.'}
      </p>

      {hasFilters ? (
        onClearFilters && (
          <button
            onClick={onClearFilters}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-full text-sm transition-all"
          >
            Réinitialiser les filtres
          </button>
        )
      ) : (
        onUploadClick && (
          <button
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-medium rounded-full text-sm transition-all shadow-sm"
          >
            <UploadCloud size={16} />
            <span>Ajouter des documents</span>
          </button>
        )
      )}
    </div>
  );
}
