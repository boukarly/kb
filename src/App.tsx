/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Document,
  DocumentChunk,
  DashboardStats as StatsType,
  FilterState,
  UploadingFile
} from './types';
import DashboardStats from './components/DashboardStats';
import UploadZone from './components/UploadZone';
import UploadFileCard from './components/UploadFileCard';
import DocumentCard from './components/DocumentCard';
import DocumentTable from './components/DocumentTable';
import EmptyLibraryState from './components/EmptyLibraryState';
import SearchAndFilters from './components/SearchAndFilters';
import ProcessingTimeline from './components/ProcessingTimeline';
import DeleteDocumentDialog from './components/DeleteDocumentDialog';
import {
  Database,
  BookOpen,
  Settings as SettingsIcon,
  LogOut,
  ChevronLeft,
  RefreshCw,
  Trash2,
  FileText,
  Copy,
  Check,
  Cpu,
  CornerDownRight,
  User as UserIcon,
  HardDrive,
  Info,
  Sparkles,
  Library
} from 'lucide-react';

export default function App() {
  // Session / User State
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('mansourboukarly@gmail.com');
  const [loginName, setLoginName] = useState('Mansour Boukarly');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Active View / Page State
  const [activePage, setActivePage] = useState<'dashboard' | 'library' | 'document-details' | 'settings'>('dashboard');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Data States
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<StatsType>({ totalCount: 0, readyCount: 0, processingCount: 0, errorCount: 0 });
  const [selectedDoc, setSelectedDoc] = useState<(Document & { chunks: DocumentChunk[] }) | null>(null);

  // Filter State
  const [filters, setFilters] = useState<FilterState>({ search: '', format: 'All', status: 'All' });

  // Upload Queue State
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  // Modals & UI States
  const [deleteDoc, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Initial Auth Check
  useEffect(() => {
    const savedToken = localStorage.getItem('m_kb_token');
    if (savedToken) {
      setToken(savedToken);
      fetch('/api/auth/session', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Session expirée');
        })
        .then((data) => {
          setUser(data.user);
        })
        .catch((err) => {
          console.error(err);
          localStorage.removeItem('m_kb_token');
          setToken(null);
        })
        .finally(() => {
          setIsCheckingSession(false);
        });
    } else {
      setIsCheckingSession(false);
    }
  }, []);

  // Fetch Documents and Stats when user state changes, page changes, or filters change
  useEffect(() => {
    if (user && token) {
      fetchDocuments();
      fetchStats();
    }
  }, [user, token, filters, activePage]);

  // Dynamic Polling for Processing Documents
  useEffect(() => {
    if (!user || !token) return;

    // Check if any document is in processing state
    const hasProcessing = documents.some(doc =>
      ['uploading', 'pending', 'extracting', 'indexing'].includes(doc.status)
    );

    if (hasProcessing) {
      const interval = setInterval(() => {
        fetchDocuments();
        fetchStats();
        // If we are looking at details of the currently processing document, update details too
        if (activeDocId) {
          fetchDocumentDetails(activeDocId, false); // silent reload without spinners
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [user, token, documents, activeDocId]);

  const fetchDocuments = async () => {
    if (!token) return;
    setIsLoadingDocs(true);
    try {
      const queryParams = new URLSearchParams({
        search: filters.search,
        format: filters.format,
        status: filters.status
      });
      const res = await fetch(`/api/documents?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error(e);
      showToast("Impossible de charger les documents.", "error");
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDocumentDetails = async (id: string, withSpinner = true) => {
    if (!token) return;
    if (withSpinner) setIsLoadingDetails(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedDoc(data);
      }
    } catch (e) {
      console.error(e);
      showToast("Échec du chargement des détails du document.", "error");
    } finally {
      if (withSpinner) setIsLoadingDetails(false);
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, name: loginName })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('m_kb_token', data.token);
        setToken(data.token);
        setUser(data.user);
        showToast("Connexion réussie. Bienvenue !", "success");
        setActivePage('dashboard');
      } else {
        showToast(data.error || "Une erreur est survenue.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(console.error);
    }
    localStorage.removeItem('m_kb_token');
    setUser(null);
    setToken(null);
    setActivePage('dashboard');
    setSelectedDoc(null);
    setActiveDocId(null);
    showToast("Session déconnectée.", "info");
  };

  // Select Document to View Details
  const handleSelectDocument = (id: string) => {
    setActiveDocId(id);
    fetchDocumentDetails(id);
    setActivePage('document-details');
  };

  // Upload Action
  const handleFilesSelected = async (files: File[]) => {
    if (!token) return;

    const newUploads = files.map(file => ({
      id: Math.random().toString(36).substring(2, 10),
      name: file.name,
      format: file.name.split('.').pop()?.toLowerCase() || 'txt',
      size: file.size,
      progress: 0,
      status: 'uploading' as const
    }));

    setUploadingFiles(prev => [...prev, ...newUploads]);

    // Process uploads sequentially or concurrently
    for (const uploadItem of newUploads) {
      const fileToUpload = files.find(f => f.name === uploadItem.name);
      if (!fileToUpload) continue;

      const formData = new FormData();
      formData.append('file', fileToUpload);

      try {
        // Mock upload progress animation before the real fetch returns
        let progress = 0;
        const interval = setInterval(() => {
          progress = Math.min(95, progress + 15);
          setUploadingFiles(prev =>
            prev.map(item => item.id === uploadItem.id ? { ...item, progress } : item)
          );
        }, 150);

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        clearInterval(interval);
        const data = await res.json();

        if (res.ok) {
          setUploadingFiles(prev =>
            prev.map(item => item.id === uploadItem.id ? { ...item, progress: 100, status: 'ready' } : item)
          );
          showToast(`« ${fileToUpload.name} » téléversé !`, 'success');
          
          // Refresh list and stats
          fetchDocuments();
          fetchStats();

          // Remove from list after 3s
          setTimeout(() => {
            setUploadingFiles(prev => prev.filter(item => item.id !== uploadItem.id));
          }, 3000);
        } else {
          throw new Error(data.error || "Erreur de stockage");
        }
      } catch (err: any) {
        setUploadingFiles(prev =>
          prev.map(item => item.id === uploadItem.id ? { ...item, status: 'failed', error: err.message || "Échec" } : item)
        );
        showToast(`Échec du dépôt de ${fileToUpload.name}`, 'error');
      }
    }
  };

  // Remove upload card from list manually
  const handleCancelUpload = (id: string) => {
    setUploadingFiles(prev => prev.filter(item => item.id !== id));
  };

  // Trigger Reindexing
  const handleReindex = async (docId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/documents/${docId}/reindex`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast("Traitement et réindexation lancés.", "success");
        fetchDocuments();
        fetchStats();
        if (activeDocId === docId) {
          fetchDocumentDetails(docId, false);
        }
      } else {
        const err = await res.json();
        showToast(err.error || "Une erreur est survenue.", "error");
      }
    } catch (e) {
      showToast("Échec du lancement du traitement.", "error");
    }
  };

  // Request Document Deletion (Opens Dialog)
  const handleDeleteRequest = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc) {
      setDocToDelete(doc);
    } else if (selectedDoc && selectedDoc.id === id) {
      setDocToDelete(selectedDoc);
    }
  };

  // Confirm Deletion Inside Dialog
  const handleConfirmDelete = async () => {
    if (!deleteDoc || !token) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deleteDoc.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`« ${deleteDoc.name} » supprimé définitivement.`, "success");
        setDocToDelete(null);
        fetchDocuments();
        fetchStats();
        // If we deleted the document currently being viewed in details, go back to dashboard
        if (activeDocId === deleteDoc.id) {
          setActivePage('dashboard');
          setActiveDocId(null);
          setSelectedDoc(null);
        }
      } else {
        showToast("Impossible de supprimer le document.", "error");
      }
    } catch (e) {
      showToast("Une erreur est survenue lors de la suppression.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy future MCP URL to clipboard
  const copyMcpUrl = () => {
    const url = `${window.location.origin}/api/mcp`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      showToast("URL MCP copiée dans le presse-papier !", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Size formatter
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Date Formatter
  const formatDateFull = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50/50">
        <div className="p-8 text-center bg-white border border-gray-100 shadow-sm rounded-3xl max-w-sm w-full mx-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-gray-500">Chargement de Mansour Knowledge Base...</p>
        </div>
      </div>
    );
  }

  // ---------------- VIEW: LOGIN PAGE ----------------
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-gray-100/80 shadow-xs rounded-3xl p-8 md:p-10 transition-all duration-300">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative p-5 bg-gradient-to-tr from-indigo-600 to-violet-500 text-white rounded-2xl mb-4 shadow-md">
              <Library size={36} />
              <div className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 p-1 rounded-lg shadow-xs">
                <Sparkles size={12} className="fill-amber-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-sans">
              Mansour Knowledge Base
            </h1>
            <p className="text-sm text-gray-500 mt-2 max-w-xs leading-relaxed">
              Votre bibliothèque documentaire intelligente, connectée à Claude.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="nom@exemple.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm outline-none transition-all placeholder:text-gray-400 text-gray-800 font-medium"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Nom complet (optionnel)
              </label>
              <input
                id="name"
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Mansour Boukarly"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm outline-none transition-all placeholder:text-gray-400 text-gray-800 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-2xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-gray-100 pt-6 text-center">
            <p className="text-xs text-gray-400">
              Démo : Saisissez n'importe quel email pour tester immédiatement avec SQLite et Prisma Client.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- VIEW: MAIN LAYOUT (AFTER LOGIN) ----------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 pb-16 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center gap-3 px-4.5 py-3.5 rounded-2xl shadow-lg border text-sm max-w-sm ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
            toast.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' :
            'bg-indigo-50 border-indigo-100 text-indigo-800'
          }`}>
            <Info size={18} className="flex-shrink-0" />
            <span className="font-medium leading-relaxed">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header element */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          {/* Brand/Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setActivePage('dashboard'); setSelectedDoc(null); }}>
            <div className="relative p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform duration-200">
              <Library size={18} />
              <div className="absolute -top-0.5 -right-0.5 bg-amber-400 text-slate-950 p-0.5 rounded-md">
                <Sparkles size={7} className="fill-amber-400" />
              </div>
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors duration-200">
              Mansour KB
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => { setActivePage('dashboard'); setSelectedDoc(null); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activePage === 'dashboard'
                  ? 'bg-indigo-50/70 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Database size={15} />
              <span>Tableau de bord</span>
            </button>
            <button
              onClick={() => { setActivePage('library'); setSelectedDoc(null); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activePage === 'library' || activePage === 'document-details'
                  ? 'bg-indigo-50/70 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <BookOpen size={15} />
              <span>Bibliothèque</span>
            </button>
            <button
              onClick={() => { setActivePage('settings'); setSelectedDoc(null); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activePage === 'settings'
                  ? 'bg-indigo-50/70 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <SettingsIcon size={15} />
              <span>Paramètres</span>
            </button>
          </nav>

          {/* User profile details and Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50/80 px-3 py-1.5 rounded-full border border-gray-100 max-w-[200px]">
              <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold font-mono">
                {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left truncate">
                <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{user.name || 'Mansour'}</p>
                <p className="text-[10px] text-gray-400 truncate leading-tight font-mono">{user.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-full border border-transparent hover:border-rose-100/30 transition-all cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100/80 p-2 flex justify-around z-40 shadow-md">
        <button
          onClick={() => { setActivePage('dashboard'); setSelectedDoc(null); }}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl gap-1 text-[11px] font-semibold w-1/3 transition-all ${
            activePage === 'dashboard' ? 'text-indigo-600' : 'text-gray-400'
          }`}
        >
          <Database size={18} />
          <span>Tableau de bord</span>
        </button>
        <button
          onClick={() => { setActivePage('library'); setSelectedDoc(null); }}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl gap-1 text-[11px] font-semibold w-1/3 transition-all ${
            activePage === 'library' || activePage === 'document-details' ? 'text-indigo-600' : 'text-gray-400'
          }`}
        >
          <BookOpen size={18} />
          <span>Bibliothèque</span>
        </button>
        <button
          onClick={() => { setActivePage('settings'); setSelectedDoc(null); }}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl gap-1 text-[11px] font-semibold w-1/3 transition-all ${
            activePage === 'settings' ? 'text-indigo-600' : 'text-gray-400'
          }`}
        >
          <SettingsIcon size={18} />
          <span>Paramètres</span>
        </button>
      </div>

      {/* Main View Area with maximum 1200px layout width */}
      <main className="max-w-[1200px] w-full mx-auto px-4 md:px-6 py-6 flex-1">
        
        {/* ---------------- VIEW: DASHBOARD ---------------- */}
        {activePage === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Title Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-800">
                  Bonjour, {user.name || 'Mansour'} !
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pilotez votre indexation documentaire et préparez vos connaissances pour Claude.
                </p>
              </div>

              {/* Quick upload trigger */}
              <button
                onClick={() => {
                  document.getElementById('file-input-raw')?.click();
                }}
                className="self-start inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-medium text-sm rounded-full transition-all shadow-sm cursor-pointer"
              >
                <span>Ajouter des documents</span>
              </button>
            </div>

            {/* Dashboard Stats */}
            <DashboardStats
              stats={stats}
              onFilterChange={(filterValue) => {
                setFilters({ ...filters, status: filterValue });
                setActivePage('library');
              }}
              activeStatusFilter={filters.status}
            />

            {/* Grid Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Main columns: Upload Zone & Queue & Latest Docs */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Upload Section */}
                <div className="space-y-4">
                  <UploadZone onFilesSelected={handleFilesSelected} />

                  {/* Active upload queue */}
                  {uploadingFiles.length > 0 && (
                    <div className="space-y-3 bg-indigo-50/10 border border-indigo-100/30 p-4 rounded-3xl">
                      <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1">
                        Files en cours de téléversement ({uploadingFiles.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {uploadingFiles.map((file) => (
                          <UploadFileCard
                            key={file.id}
                            file={file}
                            onCancel={handleCancelUpload}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Latest documents in processing/recent */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Derniers documents importés
                    </h3>
                    <button
                      onClick={() => setActivePage('library')}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Voir toute la bibliothèque
                    </button>
                  </div>

                  {isLoadingDocs && documents.length === 0 ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-white border border-gray-100 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : documents.length === 0 ? (
                    <EmptyLibraryState
                      hasFilters={false}
                      onUploadClick={() => document.getElementById('file-input-raw')?.click()}
                    />
                  ) : (
                    <div className="space-y-3">
                      {/* Responsive display: cards for mobile, table for desktop */}
                      <div className="grid grid-cols-1 gap-3 sm:hidden">
                        {documents.slice(0, 5).map((doc) => (
                          <DocumentCard
                            key={doc.id}
                            document={doc}
                            onSelect={handleSelectDocument}
                            onReindex={handleReindex}
                            onDelete={handleDeleteRequest}
                          />
                        ))}
                      </div>
                      <div className="hidden sm:block">
                        <DocumentTable
                          documents={documents.slice(0, 5)}
                          onSelect={handleSelectDocument}
                          onReindex={handleReindex}
                          onDelete={handleDeleteRequest}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Info Section */}
              <div className="space-y-6">
                
                {/* Information Card */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="p-3 bg-indigo-50/50 text-indigo-600 rounded-2xl w-fit">
                    <Cpu size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 tracking-tight">
                    Comment ça marche ?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Mansour Knowledge Base indexe automatiquement vos PDF, DOCX et documents texte pour que votre assistant Claude puisse y accéder directement.
                  </p>

                  {/* Visual Steps list */}
                  <div className="space-y-3.5 pt-2 text-xs text-gray-600">
                    <div className="flex gap-3">
                      <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-indigo-50 text-indigo-700 font-bold font-mono">1</span>
                      <p className="leading-relaxed"><strong className="text-gray-800">Dépôt sécurisé :</strong> Les fichiers sont stockés localement.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-indigo-50 text-indigo-700 font-bold font-mono">2</span>
                      <p className="leading-relaxed"><strong className="text-gray-800">Extraction et Segmentation :</strong> Le texte est analysé puis segmenté en paragraphes pertinents.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-indigo-50 text-indigo-700 font-bold font-mono">3</span>
                      <p className="leading-relaxed"><strong className="text-gray-800">Intégration Claude :</strong> Claude se connecte à ce dépôt au moyen du Model Context Protocol (MCP).</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setActivePage('settings')}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-2xl transition-all"
                    >
                      <span>Configurer Claude MCP</span>
                      <CornerDownRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Storage Card */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs flex items-center gap-4">
                  <div className="p-3 bg-slate-50 text-slate-500 rounded-2xl">
                    <HardDrive size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stockage local</h4>
                    <p className="text-base font-bold text-gray-800 mt-0.5">SQLite & Prisma</p>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden mt-1.5">
                      <div className="bg-indigo-500 h-full w-[12%]" />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Utilisé : {documents.length} fichiers</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ---------------- VIEW: LIBRARY ---------------- */}
        {activePage === 'library' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-800">
                Bibliothèque documentaire
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Gérez l'ensemble des documents indexés dans votre base vectorielle SQLite.
              </p>
            </div>

            {/* Filter controls */}
            <SearchAndFilters
              filters={filters}
              onChange={(newFilters) => setFilters(newFilters)}
            />

            {/* Main content display */}
            {isLoadingDocs && documents.length === 0 ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-white border border-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <EmptyLibraryState
                hasFilters={filters.search !== '' || filters.format !== 'All' || filters.status !== 'All'}
                onClearFilters={() => setFilters({ search: '', format: 'All', status: 'All' })}
                onUploadClick={() => setActivePage('dashboard')}
              />
            ) : (
              <div className="space-y-4">
                {/* Count indicator */}
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                  {documents.length} document{documents.length > 1 ? 's' : ''} trouvé{documents.length > 1 ? 's' : ''}
                </p>

                {/* Mobile view Cards Grid */}
                <div className="grid grid-cols-1 gap-4 sm:hidden">
                  {documents.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      onSelect={handleSelectDocument}
                      onReindex={handleReindex}
                      onDelete={handleDeleteRequest}
                    />
                  ))}
                </div>

                {/* Desktop View Table */}
                <div className="hidden sm:block">
                  <DocumentTable
                    documents={documents}
                    onSelect={handleSelectDocument}
                    onReindex={handleReindex}
                    onDelete={handleDeleteRequest}
                  />
                </div>

                {/* Pagination (Decorative for demo as local SQLite responds instantly) */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-500">
                  <span>Affichage de 1-{documents.length} sur {documents.length} documents</span>
                  <div className="flex gap-1.5">
                    <button disabled className="px-3 py-1.5 bg-gray-50 text-gray-400 rounded-lg cursor-not-allowed border border-gray-100">Précédent</button>
                    <button disabled className="px-3 py-1.5 bg-gray-50 text-gray-400 rounded-lg cursor-not-allowed border border-gray-100">Suivant</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- VIEW: DOCUMENT DETAILS ---------------- */}
        {activePage === 'document-details' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Navigation back and header controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
              <button
                onClick={() => { setActivePage('library'); setSelectedDoc(null); }}
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer self-start"
              >
                <ChevronLeft size={16} />
                <span>Retour à la bibliothèque</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReindex(activeDocId!)}
                  disabled={selectedDoc && ['pending', 'extracting', 'indexing', 'uploading'].includes(selectedDoc.status)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold text-xs rounded-full transition-all cursor-pointer"
                >
                  <RefreshCw size={13} className={selectedDoc && ['pending', 'extracting', 'indexing', 'uploading'].includes(selectedDoc.status) ? 'animate-spin' : ''} />
                  <span>Réindexer</span>
                </button>

                <button
                  onClick={() => handleDeleteRequest(activeDocId!)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-full transition-all cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Supprimer définitivement</span>
                </button>
              </div>
            </div>

            {/* Main Details Body */}
            {isLoadingDetails || !selectedDoc ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
                <div className="lg:col-span-2 h-[450px] bg-white border border-gray-100 rounded-3xl" />
                <div className="h-[450px] bg-white border border-gray-100 rounded-3xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Side: Text and Metadata preview */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* File Profile Header Card */}
                  <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-4 bg-indigo-50/50 text-indigo-500 rounded-2xl flex-shrink-0">
                        <FileText size={32} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-gray-800 truncate" title={selectedDoc.name}>
                          {selectedDoc.name}
                        </h3>
                        <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{selectedDoc.originalFilename}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3.5 text-xs text-gray-500 md:self-center">
                      <div>
                        <span className="text-gray-400 block font-mono text-[10px] uppercase tracking-wider mb-0.5">Format</span>
                        <span className="font-semibold text-gray-700 uppercase bg-gray-100 px-2 py-0.5 rounded-sm">
                          {selectedDoc.originalFilename.split('.').pop()}
                        </span>
                      </div>
                      <div className="h-8 w-px bg-gray-100" />
                      <div>
                        <span className="text-gray-400 block font-mono text-[10px] uppercase tracking-wider mb-0.5">Taille</span>
                        <span className="font-semibold text-gray-700">{formatSize(selectedDoc.fileSize)}</span>
                      </div>
                      <div className="h-8 w-px bg-gray-100" />
                      <div>
                        <span className="text-gray-400 block font-mono text-[10px] uppercase tracking-wider mb-0.5">Pages</span>
                        <span className="font-semibold text-gray-700">{selectedDoc.pageCount || '—'}</span>
                      </div>
                      <div className="h-8 w-px bg-gray-100" />
                      <div>
                        <span className="text-gray-400 block font-mono text-[10px] uppercase tracking-wider mb-0.5">Passages</span>
                        <span className="font-semibold text-gray-700">{selectedDoc.chunkCount || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Extract Text chunks layout */}
                  <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                        Aperçu du texte extrait & vectorisé
                      </h3>
                      <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                        {selectedDoc.chunks.length} blocs trouvés
                      </span>
                    </div>

                    {selectedDoc.chunks.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-sm text-gray-400">Aucun passage extrait disponible. Le document est peut-être en attente ou a échoué.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                        {selectedDoc.chunks.map((chunk, idx) => (
                          <div key={chunk.id} className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-gray-100/50 rounded-2xl transition-all">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-xs font-bold text-indigo-600 font-mono">
                                # {idx + 1} — {chunk.heading || `Bloc ${idx + 1}`}
                              </span>
                              <div className="flex gap-2 text-[10px] text-gray-400">
                                <span>Page {chunk.pageStart || 1}</span>
                                <span>•</span>
                                <span>{chunk.tokenCount || 0} tokens</span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed font-mono whitespace-pre-wrap">
                              {chunk.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Physical Checksum metadata */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/50 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 font-mono">
                    <span>ID Document : {selectedDoc.id}</span>
                    <span>Checksum : {selectedDoc.checksum || 'N/A'}</span>
                  </div>

                </div>

                {/* Right Side: Timeline and Status details */}
                <div className="space-y-6">
                  <ProcessingTimeline
                    status={selectedDoc.status}
                    errorMessage={selectedDoc.errorMessage}
                    updatedAt={selectedDoc.updatedAt}
                  />
                </div>

              </div>
            )}
          </div>
        )}

        {/* ---------------- VIEW: SETTINGS ---------------- */}
        {activePage === 'settings' && (
          <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-800">
                Paramètres de l'application
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Configurez votre compte et préparez la connexion avec vos assistants IA.
              </p>
            </div>

            {/* Profile information */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider border-b border-gray-50 pb-3">
                Informations du compte
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400 block mb-1">Nom d'utilisateur</span>
                  <div className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-700 font-medium">
                    {user.name || 'Mansour Boukarly'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 block mb-1">Adresse email</span>
                  <div className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-700 font-medium">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Library rules configuration */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider border-b border-gray-50 pb-3">
                Capacité et Prise en charge
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Taille maximale autorisée par fichier :</span>
                  <span className="font-bold text-gray-800 bg-gray-50 px-2.5 py-1 rounded-lg">10 Mo</span>
                </div>

                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                    Formats acceptés :
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { ext: 'PDF', name: 'Acrobat PDF' },
                      { ext: 'DOCX', name: 'Microsoft Word' },
                      { ext: 'TXT', name: 'Texte Brut' },
                      { ext: 'Markdown', name: 'Fichiers MD' }
                    ].map((fmt) => (
                      <div key={fmt.ext} className="p-3 bg-slate-50 border border-gray-100 rounded-2xl text-center">
                        <span className="block text-xs font-bold text-indigo-600 uppercase mb-0.5">{fmt.ext}</span>
                        <span className="text-[10px] text-gray-400">{fmt.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Claude MCP Integration */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Cpu size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                    Connexion Claude (Serveur MCP)
                  </h3>
                  <p className="text-xs text-gray-400">Interrogez cette base de connaissances directement depuis Claude Desktop.</p>
                </div>
              </div>

              <div className="border-t border-gray-50 pt-4 space-y-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Copiez l'adresse URL ci-dessous et déclarez-la dans le fichier de configuration de Claude Desktop (`claude_desktop_config.json`) pour exposer votre savoir vectoriel.
                </p>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs text-gray-500 font-mono truncate select-all">
                    {window.location.origin}/api/mcp
                  </div>
                  <button
                    onClick={copyMcpUrl}
                    className="p-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-2xl transition-all cursor-pointer shadow-xs flex-shrink-0"
                    title="Copier l'URL MCP"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>

                <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-2xl text-xs text-amber-800 leading-relaxed">
                  <strong className="font-semibold block mb-1">Architecture prête pour le déploiement</strong>
                  Ce serveur intègre une interface factice conforme au standard JSON-RPC du Model Context Protocol. Les requêtes sémantiques sont dirigées vers SQLite de façon performante.
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Delete Confirmation Modal Overlay */}
      <DeleteDocumentDialog
        isOpen={deleteDoc !== null}
        documentName={deleteDoc?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDocToDelete(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
