/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DocumentStatus } from '../types';
import { CheckCircle2, Clock, FileText, Binary, Sparkles, AlertTriangle } from 'lucide-react';

interface Props {
  status: DocumentStatus;
  errorMessage?: string | null;
  updatedAt?: string;
}

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export default function ProcessingTimeline({ status, errorMessage, updatedAt }: Props) {
  const steps: Step[] = [
    {
      id: 'upload',
      label: 'Téléversement',
      description: 'Le document est transféré vers le serveur et enregistré de façon sécurisée.',
      icon: <CheckCircle2 size={16} />
    },
    {
      id: 'pending',
      label: 'En attente',
      description: 'Le fichier est placé dans la file d\'attente de traitement vectoriel.',
      icon: <Clock size={16} />
    },
    {
      id: 'extracting',
      label: 'Extraction du texte',
      description: 'Analyse du fichier et extraction du contenu textuel structuré.',
      icon: <FileText size={16} />
    },
    {
      id: 'indexing',
      label: 'Création de l\'index',
      description: 'Découpage du texte en blocs cohérents et indexation dans SQLite.',
      icon: <Binary size={16} />
    },
    {
      id: 'ready',
      label: 'Prêt pour Claude',
      description: 'Le savoir est indexé et interrogeable via le protocole serveur MCP.',
      icon: <Sparkles size={16} />
    }
  ];

  const getStepStatus = (stepId: string): 'complete' | 'active' | 'pending' | 'failed' => {
    // Determine status of each step based on document status
    const statusOrder: DocumentStatus[] = ['uploading', 'pending', 'extracting', 'indexing', 'ready'];
    
    const docIndex = statusOrder.indexOf(status === 'failed' ? 'indexing' : status); // If failed, we stop at last processing step

    if (status === 'failed' && stepId === 'ready') {
      return 'pending';
    }

    if (status === 'failed' && stepId === 'indexing') {
      return 'failed';
    }

    const stepIndexMap: Record<string, number> = {
      'upload': 0,
      'pending': 1,
      'extracting': 2,
      'indexing': 3,
      'ready': 4
    };

    const stepIdx = stepIndexMap[stepId];

    if (stepIdx < docIndex) {
      return 'complete';
    } else if (stepIdx === docIndex) {
      return status === 'failed' ? 'failed' : 'active';
    } else {
      return 'pending';
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-white border border-gray-100 rounded-3xl shadow-xs">
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
        Historique et Traitement du Document
      </h3>

      <div className="relative flex flex-col pl-6 border-l-2 border-gray-100/80 ml-3 gap-8">
        {steps.map((step) => {
          const stepStatus = getStepStatus(step.id);

          let circleBg = 'bg-gray-100 text-gray-400';
          let borderRing = 'border-transparent';
          let textClass = 'text-gray-500';
          let titleClass = 'text-gray-600 font-medium';

          if (stepStatus === 'complete') {
            circleBg = 'bg-emerald-50 text-emerald-600';
            textClass = 'text-gray-500';
            titleClass = 'text-gray-800 font-semibold';
          } else if (stepStatus === 'active') {
            circleBg = 'bg-indigo-600 text-white animate-pulse';
            borderRing = 'ring-4 ring-indigo-100';
            textClass = 'text-gray-600';
            titleClass = 'text-indigo-600 font-semibold';
          } else if (stepStatus === 'failed') {
            circleBg = 'bg-rose-50 text-rose-600';
            borderRing = 'ring-4 ring-rose-100';
            textClass = 'text-gray-500';
            titleClass = 'text-rose-600 font-semibold';
          }

          return (
            <div key={step.id} className="relative flex items-start gap-4">
              {/* Timeline marker node */}
              <div className={`absolute -left-[35px] top-0.5 flex items-center justify-center w-6 h-6 rounded-full border border-white ${circleBg} ${borderRing} transition-all duration-300 z-10`}>
                {stepStatus === 'complete' ? <CheckCircle2 size={14} /> : step.icon}
              </div>

              {/* Step text info */}
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm ${titleClass} flex items-center gap-2`}>
                  {step.label}
                  {stepStatus === 'active' && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">
                      En cours
                    </span>
                  )}
                  {stepStatus === 'complete' && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                      Terminé
                    </span>
                  )}
                </h4>
                <p className={`text-xs mt-1 leading-relaxed ${textClass}`}>
                  {step.description}
                </p>

                {stepStatus === 'failed' && errorMessage && (
                  <div className="flex items-start gap-1.5 text-xs text-rose-600 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/50 mt-2">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {updatedAt && (
        <div className="text-[11px] text-gray-400 text-right mt-2 font-mono">
          Dernière mise à jour : {new Date(updatedAt).toLocaleString('fr-FR')}
        </div>
      )}
    </div>
  );
}
