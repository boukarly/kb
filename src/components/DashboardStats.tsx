/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DashboardStats as StatsType } from '../types';
import { FileText, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  stats: StatsType;
  onFilterChange?: (status: string) => void;
  activeStatusFilter?: string;
}

export default function DashboardStats({ stats, onFilterChange, activeStatusFilter }: Props) {
  const cards = [
    {
      id: 'stat-total',
      label: 'Nombre de documents',
      value: stats.totalCount,
      icon: <FileText size={24} className="text-gray-600" />,
      bg: 'bg-white',
      border: 'border border-gray-100',
      filterValue: 'All',
      colorClass: 'text-gray-900',
    },
    {
      id: 'stat-ready',
      label: 'Prêt pour Claude',
      value: stats.readyCount,
      icon: <CheckCircle2 size={24} className="text-emerald-600" />,
      bg: 'bg-white',
      border: 'border border-gray-100',
      filterValue: 'ready',
      colorClass: 'text-emerald-600',
    },
    {
      id: 'stat-processing',
      label: 'En traitement',
      value: stats.processingCount,
      icon: <RefreshCw size={24} className={`text-indigo-600 ${stats.processingCount > 0 ? 'animate-spin' : ''}`} />,
      bg: 'bg-white',
      border: 'border border-gray-100',
      filterValue: 'processing',
      colorClass: 'text-indigo-600',
    },
    {
      id: 'stat-failed',
      label: 'Échecs',
      value: stats.errorCount,
      icon: <AlertTriangle size={24} className="text-rose-600" />,
      bg: 'bg-white',
      border: 'border border-gray-100',
      filterValue: 'failed',
      colorClass: 'text-rose-600',
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {cards.map((card) => {
        const isActive = activeStatusFilter === card.filterValue;
        return (
          <button
            key={card.id}
            id={card.id}
            onClick={() => onFilterChange?.(card.filterValue)}
            disabled={!onFilterChange}
            className={`flex flex-col p-5 md:p-6 text-left rounded-3xl transition-all outline-none ${card.bg} ${card.border} ${
              onFilterChange 
                ? 'cursor-pointer hover:shadow-md active:scale-98' 
                : ''
            } ${
              isActive 
                ? 'ring-2 ring-indigo-500/50 shadow-sm border-indigo-200 bg-indigo-50/5' 
                : 'shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-4">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className="p-2 rounded-2xl bg-gray-50/80">
                {card.icon}
              </div>
            </div>
            <span className={`text-3xl md:text-4xl font-semibold tracking-tight ${card.colorClass}`}>
              {card.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}
