/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FilterState } from '../types';
import { Search, SlidersHorizontal, EyeOff } from 'lucide-react';

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export default function SearchAndFilters({ filters, onChange }: Props) {
  const formats = [
    { value: 'All', label: 'Tous les formats' },
    { value: 'PDF', label: 'PDF' },
    { value: 'DOCX', label: 'DOCX' },
    { value: 'TXT', label: 'TXT' },
    { value: 'Markdown', label: 'Markdown' },
  ];

  const statuses = [
    { value: 'All', label: 'Tous les statuts' },
    { value: 'ready', label: 'Prêt pour Claude' },
    { value: 'processing', label: 'En traitement' },
    { value: 'failed', label: 'Échec' },
  ];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value });
  };

  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, format: e.target.value });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, status: e.target.value });
  };

  const clearFilters = () => {
    onChange({ search: '', format: 'All', status: 'All' });
  };

  const hasActiveFilters = filters.search !== '' || filters.format !== 'All' || filters.status !== 'All';

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-xs w-full">
      {/* Search Input */}
      <div className="relative w-full md:flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Rechercher par nom de document..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm text-gray-800 outline-none transition-all placeholder:text-gray-400"
        />
      </div>

      {/* Select Filters Container */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="relative flex-1 md:flex-initial">
          <select
            value={filters.format}
            onChange={handleFormatChange}
            className="w-full md:w-44 px-3.5 py-2.5 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm text-gray-700 outline-none transition-all appearance-none cursor-pointer"
          >
            {formats.map((fmt) => (
              <option key={fmt.value} value={fmt.value}>
                {fmt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-gray-400">
            <SlidersHorizontal size={14} />
          </div>
        </div>

        <div className="relative flex-1 md:flex-initial">
          <select
            value={filters.status}
            onChange={handleStatusChange}
            className="w-full md:w-44 px-3.5 py-2.5 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm text-gray-700 outline-none transition-all appearance-none cursor-pointer"
          >
            {statuses.map((stat) => (
              <option key={stat.value} value={stat.value}>
                {stat.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-gray-400">
            <SlidersHorizontal size={14} />
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3.5 py-2.5 text-sm font-medium text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-2xl transition-all"
            title="Réinitialiser les filtres"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
