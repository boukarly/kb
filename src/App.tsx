import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Database,
  FileText,
  Github,
  Link2,
  Loader2,
  LogOut,
  Search,
  Trash2,
  UploadCloud,
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

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

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

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? documents.filter((document) =>
          `${document.title} ${document.original_filename}`
            .toLowerCase()
            .includes(value),
        )
      : documents;
  }, [documents, query]);

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

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={34} />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center p-6">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-7 flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-600 p-3 text-white">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Mansour Knowledge Base</h1>
              <p className="text-sm text-slate-500">
                Bibliothèque sécurisée par InsForge
              </p>
            </div>
          </div>

          <form onSubmit={login} className="space-y-4">
            <input
              className="w-full rounded-2xl border px-4 py-3"
              type="email"
              required
              placeholder="Adresse email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-2xl border px-4 py-3"
              type="password"
              required
              placeholder="Mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              disabled={busy}
              className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white"
            >
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="my-5 text-center text-xs text-slate-400">ou</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => void oauth('github')}
              className="flex items-center justify-center gap-2 rounded-2xl border px-3 py-3"
            >
              <Github size={17} /> GitHub
            </button>
            <button
              onClick={() => void oauth('google')}
              className="rounded-2xl border px-3 py-3"
            >
              Google
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-600 p-2 text-white">
              <Database size={20} />
            </div>
            <div>
              <h1 className="font-bold">Mansour Knowledge Base</h1>
              <p className="text-xs text-slate-500">
                InsForge · PostgreSQL · Vercel
              </p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-7">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Documents', stats.totalCount],
            ['Prêts', stats.readyCount],
            ['En traitement', stats.processingCount],
            ['Erreurs', stats.errorCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border bg-white p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                <Link2 size={22} />
              </div>
              <div>
                <h2 className="font-bold">Accès MCP</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Copiez cet endpoint dans ChatGPT, Claude ou tout client MCP
                  compatible.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
              <code className="min-w-0 break-all rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {mcpUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyMcpUrl()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copié' : 'Copier le lien'}
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Le lien seul ne révèle aucune clé. L’accès reste protégé par votre
            clé MCP privée configurée côté serveur.
          </p>
        </section>

        <section className="rounded-3xl border border-dashed border-indigo-300 bg-white p-8 text-center">
          <UploadCloud className="mx-auto text-indigo-600" size={36} />
          <h2 className="mt-3 text-lg font-bold">Déposer des documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            PDF, DOCX, TXT et Markdown · 10 Mo maximum
          </p>
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 font-semibold text-white">
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
          <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </p>
        )}
        {error && (
          <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </p>
        )}

        <section className="rounded-3xl border bg-white p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Bibliothèque</h2>
              <p className="text-sm text-slate-500">
                Vos fichiers sont isolés par RLS.
              </p>
            </div>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={17}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher…"
                className="w-full rounded-2xl border py-2.5 pl-10 pr-4 sm:w-72"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 py-12 text-center text-sm text-slate-500">
              Aucun document.
            </div>
          ) : (
            <div className="divide-y">
              {visible.map((document) => (
                <article
                  key={document.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-xl bg-slate-100 p-3">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{document.title}</h3>
                      <p className="truncate text-xs text-slate-500">
                        {document.original_filename} ·{' '}
                        {formatBytes(document.size_bytes)} ·{' '}
                        {document.chunk_count} passages
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        document.status === 'ready'
                          ? 'bg-emerald-50 text-emerald-700'
                          : document.status === 'failed'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {document.status}
                    </span>
                    <button
                      onClick={() => void remove(document)}
                      className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={17} />
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
