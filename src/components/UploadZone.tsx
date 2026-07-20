/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText } from 'lucide-react';

interface Props {
  onFilesSelected: (files: File[]) => void;
  maxSizeMB?: number;
}

export default function UploadZone({ onFilesSelected, maxSizeMB = 10 }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndFilterFiles = (filesList: FileList | null): File[] => {
    if (!filesList) return [];
    const validFiles: File[] = [];
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isSizeValid = file.size <= maxSizeMB * 1024 * 1024;
      const isExtValid = allowedExtensions.includes(ext);

      if (isExtValid && isSizeValid) {
        validFiles.push(file);
      } else {
        // We will trigger standard toast alert in the page, but let's filter them silently here or trigger callbacks
        let errorMsg = '';
        if (!isExtValid) {
          errorMsg = `Format de fichier "${ext}" non pris en charge. PDF, DOCX, TXT et MD uniquement.`;
        } else if (!isSizeValid) {
          errorMsg = `Fichier trop volumineux. Taille max: ${maxSizeMB} Mo.`;
        }
        alert(errorMsg); // Standard fallback, we will override with pretty toast alerts in App
      }
    }
    return validFiles;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const validFiles = validateAndFilterFiles(e.dataTransfer.files);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validFiles = validateAndFilterFiles(e.target.files);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      id="upload-dropzone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerSelect}
      className={`group relative flex flex-col items-center justify-center w-full p-8 md:p-12 text-center border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
        isDragging
          ? 'border-indigo-500 bg-indigo-50/30 ring-4 ring-indigo-500/10'
          : 'border-gray-200 bg-white hover:border-indigo-400 hover:bg-gray-50/30'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFileChange}
        className="hidden"
        id="file-input-raw"
      />

      <div className={`p-4 mb-4 rounded-2xl transition-transform duration-300 ${
        isDragging ? 'scale-110 bg-indigo-100/70 text-indigo-600' : 'bg-gray-50 text-gray-400 group-hover:scale-105 group-hover:text-indigo-500'
      }`}>
        <UploadCloud size={32} />
      </div>

      <h3 className="mb-1 text-base md:text-lg font-medium text-gray-800">
        Glissez-déposez vos fichiers ici
      </h3>
      <p className="mb-4 text-xs md:text-sm text-gray-500 max-w-sm">
        ou <span className="font-semibold text-indigo-600 group-hover:underline">parcourez vos dossiers</span>. PDF, DOCX, TXT et Markdown sont acceptés (max. {maxSizeMB} Mo).
      </p>

      <div className="flex gap-2 text-xs text-gray-400 border border-gray-100 rounded-full px-3 py-1 bg-gray-50/50">
        <FileText size={14} className="text-gray-400" />
        <span>Prend en charge le téléversement TUS avec reprise</span>
      </div>
    </div>
  );
}
