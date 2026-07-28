import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Database,
  FileText,
  Filter,
  Github,
  Heart,
  Link2,
  Loader2,
  LogOut,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { DOCUMENT_BUCKET, insforge } from './lib/insforge';
import type { AuthUser, DashboardStats, KnowledgeDocument } from './types';

const api = insforge as any;
const allowed = ['pdf', 'docx', 'txt', 'md'];
const MAX_SIZE = 10 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (!bytes) return '0 octet';
  const units = ['octets', 'Ko', 'Mo', 'Go'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

async function checksum(file: File) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function chunks(text: string) {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);
  const result: string[] = [];
  let current = '';

  for (const block of blocks) {
    if (current && `${current}\n\n${block}`.length > 1800) {
      result.push(current);
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }

  if (current) result.push(current);
  return result;
}

type Filters = {
  status: string[];
  type: string[];
  collections: string[];
  favoritesOnly: boolean;
  dateRange: { from?: string; to?: string };
};

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [collections, setCollections] = useState<Map<string, string[]>>(new Map());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [filters, setFilters] = useState<Filters>({
    status: [],
    type: [],
    collections: [],
    favoritesOnly: false,
    dateRange: {},
  });

  const mcpUrl = `${window.location.origin}/api/mcp`;

  const stats = useMemo<DashboardStats>(
    () => ({
      totalCount: documents.length,
      readyCount: documents.filter((document) => document.status === 'ready')
        .length,
      processingCount: documents.filter((document) =>
        [
          'uploading',
          'uploaded',
          'queued',
          'extracting',
          'chunking',
          'indexing',
        ].includes(document.status),
      ).length,
      errorCount: documents.filter((document) => document.status === 'failed')
        .length,
    }),
    [documents],
  );

  const detailedStats = useMemo(() => {
    const totalSize = documents.reduce((sum, doc) => sum + (doc.size_bytes || 0), 0);
    const totalChunks = documents.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0);
    const byType: Record<string, number> = {};

    documents.forEach(doc => {
      byType[doc.extension || 'unknown'] = (byType[doc.extension || 'unknown'] || 0) + 1;
    });

    return { totalSize, totalChunks, byType };
  }, [documents]);

  const filtered = useMemo(() => {
    let result = documents;

    if (query.trim()) {
      const value = query.trim().toLowerCase();
      result = result.filter((doc) =>
        `${doc.title} ${doc.original_filename}`
          .toLowerCase()
          .includes(value),
      );
    }

    if (filters.status.length > 0) {
      result = result.filter((doc) => filters.status.includes(doc.status));
    }

    if (filters.type.length > 0) {
      result = result.filter((doc) => filters.type.includes(doc.extension));
    }

    if (filters.collections.length > 0) {
      result = result.filter((doc) =>
        filters.collections.some((coll) =>
          collections.get(coll)?.includes(doc.id),
        ),
      );
    }

    if (filters.favoritesOnly) {
      result = result.filter((doc) => favorites.has(doc.id));
    }

    if (filters.dateRange.from || filters.dateRange.to) {
      result = result.filter((doc) => {
        const docDate = new Date(doc.created_at).getTime();
        if (filters.dateRange.from) {
          const fromDate = new Date(filters.dateRange.from).getTime();
          if (docDate < fromDate) return false;
        }
        if (filters.dateRange.to) {
          const toDate = new Date(filters.dateRange.to).getTime();
          if (docDate > toDate) return false;
        }
        return true;
      });
    }

    return result.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [documents, query, filters, collections, favorites]);

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    const { data } = await api.auth.getCurrentUser();
    if (data?.user) {
      setUser(data.user);
      await load(data.user.id);
    }
    setLoading(false);
  }

  async function load(ownerId = user?.id) {
    if (!ownerId) return;
    const { data, error: dbError } = await api.database
      .from('documents')
      .select('*')
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (dbError) setError(dbError.message || 'Chargement impossible.');
    else setDocuments(data || []);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: authError } = await api.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);

    if (authError) {
      setError(authError.message || 'Connexion impossible.');
      return;
    }

    setUser(data.user);
    await load(data.user.id);
  }

  async function oauth(provider: 'github' | 'google') {
    setBusy(true);
    setError('');
    const { error: authError } = await api.auth.signInWithOAuth(provider, {
      redirectTo: `${window.location.origin}/`,
    });

    if (authError) {
      setBusy(false);
      setError(authError.message || 'Connexion OAuth impossible.');
    }
  }

  async function logout() {
    await api.auth.signOut();
    setUser(null);
    setDocuments([]);
  }

  async function copyMcpUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier automatiquement le lien MCP.');
    }
  }

  async function upload(fileList: FileList | null) {
    if (!fileList || !user) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      for (const file of Array.from(fileList)) {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        if (!allowed.includes(extension)) {
          throw new Error(`${file.name} : format non pris en charge.`);
        }
        if (file.size > MAX_SIZE) {
          throw new Error(`${file.name} dépasse 10 Mo.`);
        }

        const id = crypto.randomUUID();
        const path = `${user.id}/${id}/${file.name}`;
        const { data: stored, error: storageError } = await api.storage
          .from(DOCUMENT_BUCKET)
          .upload(path, file);

        if (storageError || !stored) {
          throw new Error(storageError?.message || 'Échec du stockage.');
        }

        const textual = extension === 'txt' || extension === 'md';
        const { error: insertError } = await api.database
          .from('documents')
          .insert({
            id,
            owner_id: user.id,
            title: file.name.replace(/\.[^.]+$/, ''),
            original_filename: file.name,
            mime_type: file.type || 'application/octet-stream',
            extension,
            size_bytes: file.size,
            bucket_name: DOCUMENT_BUCKET,
            object_key: stored.key,
            storage_url: stored.url,
            checksum_sha256: await checksum(file),
            status: textual ? 'indexing' : 'queued',
            progress: textual ? 70 : 20,
            current_stage: textual
              ? 'Découpage du texte'
              : 'En attente du processeur PDF/DOCX',
            metadata: { uploaded_from: 'web' },
          });

        if (insertError) {
          await api.storage.from(DOCUMENT_BUCKET).remove(stored.key);
          throw new Error(insertError.message);
        }

        if (textual) {
          const parts = chunks(await file.text());
          if (parts.length) {
            await api.database.from('document_chunks').insert(
              parts.map((content, index) => ({
                document_id: id,
                owner_id: user.id,
                chunk_index: index,
                content,
                heading: content
                  .split('\n')[0]
                  .replace(/^#+\s*/, '')
                  .slice(0, 160),
                token_count: Math.ceil(content.length / 4),
                metadata: { source: file.name },
              })),
            );
          }

          await api.database
            .from('documents')
            .update({
              status: 'ready',
              progress: 100,
              current_stage: 'Prêt',
              chunk_count: parts.length,
            })
            .eq('id', id);
        }

        await api.database.from('audit_logs').insert({
          actor_id: user.id,
          action: 'document.uploaded',
          resource_type: 'document',
          resource_id: id,
          details: { filename: file.name },
        });
      }

      setNotice(
        'Téléversement terminé. Les PDF et DOCX sont placés dans la file de traitement.',
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(document: KnowledgeDocument) {
    if (!window.confirm(`Supprimer définitivement « ${document.title} » ?`)) {
      return;
    }

    const { error: storageError } = await api.storage
      .from(document.bucket_name)
      .remove(document.object_key);
    if (storageError) {
      setError(storageError.message || 'Suppression du fichier impossible.');
      return;
    }

    const { error: dbError } = await api.database
      .from('documents')
      .delete()
      .eq('id', document.id);
    if (dbError) {
      setError(dbError.message || 'Suppression impossible.');
      return;
    }

    setDocuments((items) =>
      items.filter((item) => item.id !== document.id),
    );
  }

  function toggleFavorite(docId: string) {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(docId)) {
      newFavorites.delete(docId);
    } else {
      newFavorites.add(docId);
    }
    setFavorites(newFavorites);
  }

  function addToCollection(collection: string, docId: string) {
    const newCollections = new Map(collections);
    const items = newCollections.get(collection) || [];
    if (!items.includes(docId)) {
      items.push(docId);
      newCollections.set(collection, items);
      setCollections(newCollections);
    }
  }

  function createCollection(name: string) {
    if (name.trim() && !collections.has(name)) {
      setCollections(new Map(collections).set(name, []));
      setNewTag('');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 grid place-items-center p-6">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="mb-7 flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-3 text-white">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Mansour KB</h1>
              <p className="text-sm text-slate-500">
                Bibliothèque InsForge
              </p>
            </div>
          </div>

          <form onSubmit={login} className="space-y-4">
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-indigo-600 focus:outline-none transition"
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:border-indigo-600 focus:outline-none transition"
              type="password"
              required
              placeholder="Mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              disabled={busy}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 font-semibold text-white hover:shadow-lg transition disabled:opacity-50"
            >
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="my-5 text-center text-xs text-slate-400">ou</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => void oauth('github')}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 hover:bg-slate-50 transition"
            >
              <Github size={17} /> GitHub
            </button>
            <button
              onClick={() => void oauth('google')}
              className="rounded-2xl border border-slate-200 px-3 py-3 hover:bg-slate-50 transition"
            >
              Google
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-2 text-white">
              <Database size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg">Mansour KB</h1>
              <p className="text-xs text-slate-500">
                InsForge · {detailedStats.totalSize > 0 ? formatBytes(detailedStats.totalSize) : '0'}
              </p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 transition"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-7">
        {/* Enhanced Statistics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Documents', value: stats.totalCount, icon: '📄', color: 'indigo' },
            { label: 'Prêts', value: stats.readyCount, icon: '✅', color: 'emerald' },
            { label: 'Traitement', value: stats.processingCount, icon: '⏳', color: 'amber' },
            { label: 'Erreurs', value: stats.errorCount, icon: '❌', color: 'rose' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className={`rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md transition`}>
              <p className="text-sm text-slate-600">{label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
              <p className="mt-2 text-2xl">{icon}</p>
            </div>
          ))}
        </section>

        {/* Detailed Insights */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md transition">
            <p className="text-sm text-slate-600">Stockage utilisé</p>
            <p className="mt-2 text-2xl font-bold">{formatBytes(detailedStats.totalSize)}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md transition">
            <p className="text-sm text-slate-600">Passages indexés</p>
            <p className="mt-2 text-2xl font-bold">{detailedStats.totalChunks}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md transition">
            <p className="text-sm text-slate-600">Types de fichiers</p>
            <div className="mt-2 flex gap-2 flex-wrap">
              {Object.entries(detailedStats.byType).map(([type, count]) => (
                <span key={type} className="px-2 py-1 rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-700 border border-indigo-200">
                  {type.toUpperCase()} × {count}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* MCP Section */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md transition">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-600">
                <Link2 size={22} />
              </div>
              <div>
                <h2 className="font-bold">Accès MCP</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Copiez cet endpoint dans ChatGPT, Claude ou tout client MCP.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
              <code className="min-w-0 break-all rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 border border-slate-200">
                {mcpUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyMcpUrl()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg transition"
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        </section>

        {/* Upload Section */}
        <section className="rounded-3xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-8 text-center hover:shadow-md transition">
          <UploadCloud className="mx-auto text-indigo-600" size={40} />
          <h2 className="mt-3 text-lg font-bold">Ajouter des documents</h2>
          <p className="mt-1 text-sm text-slate-600">
            PDF, DOCX, TXT, Markdown · Max 10 Mo
          </p>
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:shadow-lg transition">
            {busy ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <UploadCloud size={18} />
            )}
            {busy ? 'Traitement…' : 'Choisir les fichiers'}
            <input
              className="hidden"
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              disabled={busy}
              onChange={(event) => void upload(event.target.files)}
            />
          </label>
        </section>

        {notice && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
            {notice}
          </p>
        )}
        {error && (
          <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200">
            {error}
          </p>
        )}

        {/* Documents Section with Filters */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-md transition">
          <div className="mb-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Bibliothèque</h2>
                <p className="text-sm text-slate-500">
                  {filtered.length} document{filtered.length !== 1 ? 's' : ''} · {favorites.size} favori{favorites.size !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 transition ${
                    showFilters
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={16} /> Filtres
                </button>
                <div className="relative flex-1 sm:flex-none">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Rechercher…"
                    className="w-full rounded-2xl border border-slate-200 py-2.5 pl-10 pr-4 focus:border-indigo-600 focus:outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Status Filter */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Statut</p>
                    {['ready', 'queued', 'indexing', 'failed'].map((status) => (
                      <label key={status} className="flex items-center gap-2 text-sm py-1">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={(e) => {
                            const newStatus = e.target.checked
                              ? [...filters.status, status]
                              : filters.status.filter((s) => s !== status);
                            setFilters({ ...filters, status: newStatus });
                          }}
                          className="w-4 h-4 rounded"
                        />
                        {status}
                      </label>
                    ))}
                  </div>

                  {/* Type Filter */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Type</p>
                    {['pdf', 'docx', 'txt', 'md'].map((type) => (
                      <label key={type} className="flex items-center gap-2 text-sm py-1">
                        <input
                          type="checkbox"
                          checked={filters.type.includes(type)}
                          onChange={(e) => {
                            const newType = e.target.checked
                              ? [...filters.type, type]
                              : filters.type.filter((t) => t !== type);
                            setFilters({ ...filters, type: newType });
                          }}
                          className="w-4 h-4 rounded"
                        />
                        {type.toUpperCase()}
                      </label>
                    ))}
                  </div>

                  {/* Date Range */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Date depuis</p>
                    <input
                      type="date"
                      value={filters.dateRange.from || ''}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          dateRange: { ...filters.dateRange, from: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Favorites */}
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={filters.favoritesOnly}
                        onChange={(e) =>
                          setFilters({ ...filters, favoritesOnly: e.target.checked })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <Heart size={16} /> Favoris uniquement
                    </label>
                  </div>
                </div>

                {/* Collections Management */}
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm font-semibold mb-2">Collections</p>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {Array.from(collections.keys()).map((coll) => (
                      <button
                        key={coll}
                        onClick={() => {
                          const newCollections = filters.collections.includes(coll)
                            ? filters.collections.filter((c) => c !== coll)
                            : [...filters.collections, coll];
                          setFilters({ ...filters, collections: newCollections });
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          filters.collections.includes(coll)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200'
                        }`}
                      >
                        {coll}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Nouvelle collection…"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          createCollection(newTag);
                        }
                      }}
                    />
                    <button
                      onClick={() => createCollection(newTag)}
                      className="rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700 transition"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Documents Grid */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 py-12 text-center text-sm text-slate-500 border border-slate-200">
              Aucun document trouvé
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((document) => (
                <article
                  key={document.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition hover:border-indigo-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="rounded-xl bg-slate-100 p-2">
                      <FileText size={20} className="text-slate-600" />
                    </div>
                    <button
                      onClick={() => toggleFavorite(document.id)}
                      className="p-2 rounded-lg hover:bg-slate-100 transition"
                    >
                      {favorites.has(document.id) ? (
                        <Heart size={18} className="fill-rose-600 text-rose-600" />
                      ) : (
                        <Heart size={18} className="text-slate-400" />
                      )}
                    </button>
                  </div>

                  <h3 className="font-semibold truncate text-sm">{document.title}</h3>
                  <p className="text-xs text-slate-500 truncate mt-1">
                    {document.original_filename}
                  </p>

                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Taille:</span>
                      <span className="font-semibold">{formatBytes(document.size_bytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Passages:</span>
                      <span className="font-semibold">{document.chunk_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-semibold uppercase">{document.extension}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        document.status === 'ready'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : document.status === 'failed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {document.status === 'ready' ? '✅' : '⏳'} {document.status}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addToCollection(e.target.value, document.id);
                          e.target.value = '';
                        }
                      }}
                      className="flex-1 text-xs rounded-lg border border-slate-200 px-2 py-1.5"
                    >
                      <option value="">Ajouter à collection…</option>
                      {Array.from(collections.keys()).map((coll) => (
                        <option key={coll} value={coll}>
                          {coll}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void remove(document)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
