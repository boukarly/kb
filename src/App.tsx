import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Database,
  FileText,
  Github,
  Link2,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { DOCUMENT_BUCKET, insforge } from './lib/insforge';
import type { AuthUser, DashboardStats, KnowledgeDocument } from './types';

const api = insforge;
const allowed = ['pdf', 'docx', 'txt', 'md'];
const MAX_SIZE = 10 * 1024 * 1024;

type Screen =
  | 'login'
  | 'signup'
  | 'verify-otp'
  | 'forgot-password'
  | 'reset-sent';

/* ── Helpers ───────────────────────────────────────── */

function formatBytes(bytes: number) {
  if (!bytes) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

async function checksum(file: File) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function chunks(text: string) {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((v) => v.trim())
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

function initials(email: string) {
  const parts = email.split('@')[0].split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ready: 'Prêt',
    failed: 'Erreur',
    queued: 'En file',
    uploading: 'Upload…',
    uploaded: 'Uploadé',
    extracting: 'Extraction',
    chunking: 'Découpage',
    indexing: 'Indexation',
    deleting: 'Suppression',
    deleted: 'Supprimé',
  };
  return map[status] ?? status;
}

/* ── Left Decoration Panel (Auth) ─────────────────── */
function AuthLeftPanel() {
  return (
    <div className="auth-panel-left">
      <div className="auth-orb-1" />
      <div className="auth-orb-2" />
      <div className="auth-panel-left-content">
        <div className="auth-panel-left-badge">
          <Sparkles size={12} />
          Base de connaissance IA
        </div>
        <h2>
          Votre savoir,<br />
          accessible partout
        </h2>
        <p>
          Importez vos documents, cherchez en langage naturel et
          connectez votre bibliothèque à ChatGPT via MCP en un clic.
        </p>
      </div>
    </div>
  );
}

/* ── Login Screen ──────────────────────────────────── */
interface LoginProps {
  onSuccess: (user: AuthUser) => void;
  onNavigate: (screen: Screen) => void;
  oauthProviders: string[];
}

function LoginScreen({ onSuccess, onNavigate, oauthProviders }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: authError } = await api.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError || !data?.user) {
      setError(authError?.message || 'Connexion impossible. Vérifiez vos identifiants.');
      return;
    }
    onSuccess(data.user);
  }

  async function handleOAuth(provider: 'github' | 'google') {
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

  return (
    <div className="auth-root">
      <AuthLeftPanel />
      <div className="auth-panel-right">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <BookOpen size={18} />
            </div>
            <span className="auth-logo-text">Knowledge Base</span>
          </div>

          <h1 className="auth-title">Bon retour 👋</h1>
          <p className="auth-subtitle">Connectez-vous pour accéder à votre bibliothèque.</p>

          <form onSubmit={(e) => void handleLogin(e)}>
            <div className="field-group">
              <label className="field-label">Adresse email</label>
              <input
                className={`field-input${error ? ' error-ring' : ''}`}
                type="email"
                required
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="field-group">
              <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Mot de passe</span>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '12px' }}
                  onClick={() => onNavigate('forgot-password')}
                >
                  Mot de passe oublié ?
                </button>
              </label>
              <input
                className={`field-input${error ? ' error-ring' : ''}`}
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="alert-error">
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <button
              className="btn-primary"
              disabled={busy}
              style={{ marginTop: '20px' }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          {(oauthProviders.includes('github') || oauthProviders.includes('google')) && (
            <>
              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">ou continuer avec</span>
                <div className="auth-divider-line" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: oauthProviders.includes('github') && oauthProviders.includes('google') ? '1fr 1fr' : '1fr', gap: '10px' }}>
                {oauthProviders.includes('github') && (
                  <button type="button" className="btn-secondary" onClick={() => void handleOAuth('github')}>
                    <Github size={16} /> GitHub
                  </button>
                )}
                {oauthProviders.includes('google') && (
                  <button type="button" className="btn-secondary" onClick={() => void handleOAuth('google')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>
                )}
              </div>
            </>
          )}

          <div className="auth-footer">
            Pas encore de compte ?{' '}
            <button onClick={() => onNavigate('signup')}>Créer un compte</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sign Up Screen ────────────────────────────────── */
interface SignupProps {
  onNavigate: (screen: Screen, data?: { email?: string }) => void;
}

function SignupScreen({ onNavigate }: SignupProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: authError } = await api.auth.signUp({ email, password });
    setBusy(false);
    if (authError) {
      setError(authError.message || 'Inscription impossible.');
      return;
    }
    onNavigate('verify-otp', { email });
  }

  return (
    <div className="auth-root">
      <AuthLeftPanel />
      <div className="auth-panel-right">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><BookOpen size={18} /></div>
            <span className="auth-logo-text">Knowledge Base</span>
          </div>

          <h1 className="auth-title">Créer un compte</h1>
          <p className="auth-subtitle">
            Rejoignez votre bibliothèque documentaire IA.
          </p>

          <form onSubmit={(e) => void handleSignup(e)}>
            <div className="field-group">
              <label className="field-label">Adresse email</label>
              <input
                className={`field-input${error && error.includes('mot') ? '' : error ? ' error-ring' : ''}`}
                type="email"
                required
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="field-group">
              <label className="field-label">Mot de passe</label>
              <input
                className={`field-input${error && error.includes('mot') ? ' error-ring' : ''}`}
                type="password"
                required
                placeholder="Au moins 8 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="field-group">
              <label className="field-label">Confirmer le mot de passe</label>
              <input
                className={`field-input${error && error.includes('correspondent') ? ' error-ring' : ''}`}
                type="password"
                required
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="alert-error">
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <button className="btn-primary" disabled={busy} style={{ marginTop: '20px' }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? 'Création en cours…' : 'Créer mon compte'}
            </button>
          </form>

          <div className="auth-footer">
            Déjà inscrit ?{' '}
            <button onClick={() => onNavigate('login')}>Se connecter</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── OTP Verification ──────────────────────────────── */
interface OtpProps {
  email: string;
  onSuccess: (user: AuthUser) => void;
  onNavigate: (screen: Screen) => void;
}

function OtpScreen({ email, onSuccess, onNavigate }: OtpProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otp = digits.join('');
  const isComplete = otp.length === 6 && digits.every((d) => /\d/.test(d));

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  }

  async function handleVerify() {
    if (!isComplete) return;
    setBusy(true);
    setError('');
    const { data, error: authError } = await api.auth.verifyOtp({
      email,
      otp,
    });
    setBusy(false);
    if (authError || !data?.user) {
      setError(authError?.message || 'Code invalide ou expiré. Réessayez.');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      return;
    }
    onSuccess(data.user);
  }

  async function handleResend() {
    setResent(false);
    await api.auth.resendVerificationEmail({ email });
    setResent(true);
    window.setTimeout(() => setResent(false), 5000);
  }

  return (
    <div className="auth-root">
      <AuthLeftPanel />
      <div className="auth-panel-right">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><Mail size={18} /></div>
            <span className="auth-logo-text">Vérification email</span>
          </div>

          <button
            type="button"
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontSize: '13px' }}
            onClick={() => onNavigate('signup')}
          >
            <ArrowLeft size={14} /> Retour
          </button>

          <h1 className="auth-title">Vérifiez votre email</h1>
          <p className="auth-subtitle">
            Nous avons envoyé un code à 6 chiffres à{' '}
            <strong style={{ color: '#1a1a1a' }}>{email}</strong>
          </p>

          <div className="otp-container" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                className={`otp-input${d ? ' filled' : ''}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && (
            <div className="alert-error">
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {resent && (
            <div className="alert-success">
              <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              Code renvoyé ! Vérifiez votre boîte mail.
            </div>
          )}

          <button
            className="btn-primary"
            disabled={!isComplete || busy}
            style={{ marginTop: '20px' }}
            onClick={() => void handleVerify()}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {busy ? 'Vérification…' : 'Confirmer le code'}
          </button>

          <div className="auth-footer">
            Code non reçu ?{' '}
            <button onClick={() => void handleResend()}>
              <RefreshCw size={12} style={{ display: 'inline', marginRight: '3px' }} />
              Renvoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Forgot Password ───────────────────────────────── */
interface ForgotPasswordProps {
  onNavigate: (screen: Screen) => void;
}

function ForgotPasswordScreen({ onNavigate }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: authError } = await api.auth.sendResetPasswordEmail({
      email,
      redirectTo: `${window.location.origin}/`,
    });
    setBusy(false);
    if (authError) {
      setError(authError.message || 'Envoi impossible. Réessayez.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="auth-root">
        <AuthLeftPanel />
        <div className="auth-panel-right">
          <div className="auth-card">
            <div
              style={{
                width: 64, height: 64,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '24px',
                color: '#15803d',
              }}
            >
              <Mail size={28} />
            </div>
            <h1 className="auth-title">Email envoyé !</h1>
            <p className="auth-subtitle">
              Un lien de réinitialisation a été envoyé à{' '}
              <strong style={{ color: '#1a1a1a' }}>{email}</strong>.
              Vérifiez vos spams si nécessaire.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: '28px' }}
              onClick={() => onNavigate('login')}
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      <AuthLeftPanel />
      <div className="auth-panel-right">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><BookOpen size={18} /></div>
            <span className="auth-logo-text">Knowledge Base</span>
          </div>

          <button
            type="button"
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontSize: '13px' }}
            onClick={() => onNavigate('login')}
          >
            <ArrowLeft size={14} /> Retour
          </button>

          <h1 className="auth-title">Mot de passe oublié</h1>
          <p className="auth-subtitle">
            Saisissez votre email pour recevoir un lien de réinitialisation.
          </p>

          <form onSubmit={(e) => void handleReset(e)}>
            <div className="field-group">
              <label className="field-label">Adresse email</label>
              <input
                className={`field-input${error ? ' error-ring' : ''}`}
                type="email"
                required
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="alert-error">
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <button className="btn-primary" disabled={busy} style={{ marginTop: '20px' }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {busy ? 'Envoi en cours…' : 'Envoyer le lien'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────── */
interface DashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

function Dashboard({ user, onLogout }: DashboardProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [dragover, setDragover] = useState(false);

  const mcpUrl = `${window.location.origin}/api/mcp`;

  const stats = useMemo<DashboardStats>(
    () => ({
      totalCount: documents.length,
      readyCount: documents.filter((d) => d.status === 'ready').length,
      processingCount: documents.filter((d) =>
        ['uploading', 'uploaded', 'queued', 'extracting', 'chunking', 'indexing'].includes(d.status),
      ).length,
      errorCount: documents.filter((d) => d.status === 'failed').length,
    }),
    [documents],
  );

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? documents.filter((d) =>
          `${d.title} ${d.original_filename}`.toLowerCase().includes(value),
        )
      : documents;
  }, [documents, query]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoadingDocs(true);
    const { data, error: dbError } = await api.database
      .from('documents')
      .select('*')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setLoadingDocs(false);
    if (dbError) setError(dbError.message || 'Chargement impossible.');
    else setDocuments(data || []);
  }

  async function copyMcpUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier le lien MCP.');
    }
  }

  async function upload(fileList: FileList | null) {
    if (!fileList) return;
    setBusy(true);
    setError('');
    setNotice('');

    let queuedForWorker = 0;
    let workerInvokeFailures = 0;

    try {
      for (const file of Array.from(fileList)) {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        if (!allowed.includes(extension)) throw new Error(`${file.name} : format non pris en charge.`);
        if (file.size > MAX_SIZE) throw new Error(`${file.name} dépasse 10 Mo.`);

        const id = crypto.randomUUID();
        const fileChecksum = await checksum(file);
        const path = `${user.id}/${id}/${file.name}`;
        const { data: stored, error: storageError } = await api.storage.from(DOCUMENT_BUCKET).upload(path, file);
        if (storageError || !stored) throw new Error(storageError?.message || 'Échec stockage.');

        const textual = extension === 'txt' || extension === 'md';
        const { error: insertError } = await api.database.from('documents').insert({
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
          checksum_sha256: fileChecksum,
          status: textual ? 'indexing' : 'queued',
          progress: textual ? 70 : 20,
          current_stage: textual ? 'Découpage du texte' : 'En attente du processeur PDF/DOCX',
          metadata: { uploaded_from: 'web' },
        });
        if (insertError) {
          await api.storage.from(DOCUMENT_BUCKET).remove(stored.key);
          throw new Error(insertError.message);
        }

        if (textual) {
          const parts = chunks(await file.text());
          if (parts.length) {
            const { error: chunksError } = await api.database.from('document_chunks').insert(
              parts.map((content, index) => ({
                document_id: id,
                owner_id: user.id,
                chunk_index: index,
                content,
                heading: content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 160),
                token_count: Math.ceil(content.length / 4),
                metadata: { source: file.name },
              })),
            );
            if (chunksError) throw new Error(chunksError.message || "Impossible d'indexer.");

          }
          await api.database.from('documents').update({ status: 'ready', progress: 100, current_stage: 'Prêt', chunk_count: parts.length, error_code: null, error_message: null }).eq('id', id).eq('owner_id', user.id);
        } else {
          const jobId = crypto.randomUUID();
          const { error: jobError } = await api.database.from('processing_jobs').insert({ id: jobId, document_id: id, owner_id: user.id, job_type: 'process', status: 'queued', stage: 'En attente du processeur PDF/DOCX', progress: 0, payload: { bucket: DOCUMENT_BUCKET, object_key: stored.key, extension } });
          if (jobError) throw new Error(jobError.message || 'Impossible de créer le job.');
          queuedForWorker++;
          const { error: processError } = await api.functions.invoke('process-document', { body: { jobId } });
          if (processError) { workerInvokeFailures++; console.warn(`Job ${jobId} reste queued:`, processError.message); }
        }

        await api.database.from('audit_logs').insert({ actor_id: user.id, action: 'document.uploaded', resource_type: 'document', resource_id: id, details: { filename: file.name } });
      }

      if (workerInvokeFailures > 0) {
        setNotice(`Téléversement terminé. ${workerInvokeFailures}/${queuedForWorker} PDF/DOCX restent en file.`);
      } else if (queuedForWorker > 0) {
        setNotice('Téléversement et traitement PDF/DOCX terminés.');
      } else {
        setNotice('Téléversement et indexation terminés.');
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(doc: KnowledgeDocument) {
    if (!window.confirm(`Supprimer « ${doc.title} » ?`)) return;
    setError('');

    await api.database.from('documents').update({ status: 'deleting', current_stage: 'Suppression' }).eq('id', doc.id).eq('owner_id', user.id);

    const { error: storageError } = await api.storage.from(doc.bucket_name).remove(doc.object_key);
    if (storageError) {
      await api.database.from('documents').update({ status: doc.status, current_stage: doc.current_stage, error_code: 'STORAGE_DELETE_FAILED', error_message: storageError.message }).eq('id', doc.id).eq('owner_id', user.id);
      setError(storageError.message || 'Suppression impossible.');
      return;
    }

    const { error: dbError } = await api.database.from('documents').delete().eq('id', doc.id).eq('owner_id', user.id);
    if (dbError) {
      setError(`${dbError.message || 'Suppression base impossible.'} Le fichier storage a déjà été supprimé.`);
      await load();
      return;
    }

    setDocuments((items) => items.filter((item) => item.id !== doc.id));
  }

  const statCards = [
    {
      label: 'Total documents',
      value: stats.totalCount,
      icon: <Database size={16} />,
      iconBg: '#f5f5f0',
      iconColor: '#525252',
      accent: '',
    },
    {
      label: 'Prêts',
      value: stats.readyCount,
      icon: <CheckCircle2 size={16} />,
      iconBg: '#f0fdf4',
      iconColor: '#15803d',
      accent: 'accent-green',
    },
    {
      label: 'En traitement',
      value: stats.processingCount,
      icon: <Loader2 size={16} />,
      iconBg: '#fffbeb',
      iconColor: '#b45309',
      accent: 'accent-orange',
    },
    {
      label: 'Erreurs',
      value: stats.errorCount,
      icon: <AlertCircle size={16} />,
      iconBg: '#fff1f2',
      iconColor: '#be123c',
      accent: 'accent-rose',
    },
  ];

  return (
    <div className="dash-root">
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark"><BookOpen size={16} /></div>
          <span className="sidebar-logo-name">Knowledge Base</span>
        </div>

        <span className="sidebar-section-label">Navigation</span>
        <button className="sidebar-nav-item active">
          <Database size={15} /> Bibliothèque
        </button>
        <button className="sidebar-nav-item">
          <Search size={15} /> Rechercher
        </button>
        <button className="sidebar-nav-item">
          <Link2 size={15} /> Intégrations MCP
        </button>

        <div className="sidebar-bottom">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">
              {initials(user.email)}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.profile?.name || user.email.split('@')[0]}</div>
              <div className="sidebar-user-email">{user.email}</div>
            </div>
            <button className="sidebar-logout-btn" onClick={onLogout} title="Déconnexion">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-topbar-title">Bibliothèque</div>
          <div className="dash-topbar-right">
            <div className="topbar-search">
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un document…"
              />
            </div>
          </div>
        </header>

        <main className="dash-content">
          {/* Stats */}
          <section className="stats-grid">
            {statCards.map((card) => (
              <div key={card.label} className={`stat-card${card.accent ? ' ' + card.accent : ''}`}>
                <div className="stat-card-icon" style={{ background: card.iconBg, color: card.iconColor }}>
                  {card.icon}
                </div>
                <div>
                  <div className="stat-card-label">{card.label}</div>
                  <div className="stat-card-value">{card.value}</div>
                </div>
              </div>
            ))}
          </section>

          {/* MCP Card */}
          <section className="mcp-card">
            <div className="mcp-card-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Link2 size={15} color="#fff" />
                  <div className="mcp-card-title">Endpoint MCP</div>
                </div>
                <div className="mcp-card-desc">
                  Connectez votre bibliothèque à ChatGPT, Claude ou tout client compatible.
                </div>
              </div>
              <div className="mcp-badge">
                <Sparkles size={10} style={{ display: 'inline', marginRight: '3px' }} />
                Actif
              </div>
            </div>
            <div className="mcp-url-row">
              <div className="mcp-url-text">{mcpUrl}</div>
              <button
                type="button"
                className={`mcp-copy-btn${copied ? ' copied' : ''}`}
                onClick={() => void copyMcpUrl()}
              >
                {copied
                  ? <><Check size={12} /> Copié</>
                  : <><Copy size={12} /> Copier</>
                }
              </button>
            </div>
          </section>

          {/* Alerts */}
          {notice && (
            <div className="inline-alert success animate-in">
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {notice}
              <button
                type="button"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                onClick={() => setNotice('')}
              >
                <X size={13} />
              </button>
            </div>
          )}
          {error && (
            <div className="inline-alert error animate-in">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
              <button
                type="button"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                onClick={() => setError('')}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Upload Zone */}
          <section
            className={`upload-zone${dragover ? ' dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
            onDragLeave={() => setDragover(false)}
            onDrop={(e) => { e.preventDefault(); setDragover(false); void upload(e.dataTransfer.files); }}
          >
            <div className="upload-zone-icon">
              {busy ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
            </div>
            <div className="upload-zone-title">
              {busy ? 'Traitement en cours…' : 'Déposez vos documents ici'}
            </div>
            <div className="upload-zone-sub">
              PDF, DOCX, TXT, Markdown · 10 Mo maximum par fichier
            </div>
            <label className="upload-btn" style={{ pointerEvents: busy ? 'none' : 'auto' }}>
              <UploadCloud size={14} />
              Choisir des fichiers
              <input
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.docx,.txt,.md"
                disabled={busy}
                onChange={(e) => void upload(e.target.files)}
                style={{ display: 'none' }}
              />
            </label>
          </section>

          {/* Documents list */}
          <section className="docs-card">
            <div className="docs-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={16} color="#525252" />
                <span className="docs-card-title">Documents</span>
                <span className="docs-count-badge">{visible.length}</span>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a3a3a3', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                title="Actualiser"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {loadingDocs ? (
              <div className="docs-empty">
                <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block', color: '#a3a3a3' }} />
                Chargement…
              </div>
            ) : visible.length === 0 ? (
              <div className="docs-empty">
                <FileText size={28} style={{ margin: '0 auto 10px', display: 'block', color: '#d4d4d4' }} />
                {query ? `Aucun résultat pour « ${query} »` : 'Aucun document. Importez votre premier fichier !'}
              </div>
            ) : (
              <div>
                {visible.map((doc) => (
                  <article key={doc.id} className="doc-row">
                    <div className="doc-icon">
                      <FileText size={16} />
                    </div>
                    <div className="doc-info">
                      <div className="doc-name">{doc.title}</div>
                      <div className="doc-meta">
                        {doc.original_filename} · {formatBytes(doc.size_bytes)}
                        {doc.chunk_count > 0 && ` · ${doc.chunk_count} passages`}
                      </div>
                    </div>
                    <span
                      className={`doc-status ${
                        doc.status === 'ready'
                          ? 'ready'
                          : doc.status === 'failed'
                          ? 'failed'
                          : 'processing'
                      }`}
                    >
                      {statusLabel(doc.status)}
                    </span>
                    <button
                      className="doc-delete-btn"
                      onClick={() => void remove(doc)}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Footer space */}
          <div style={{ height: '20px' }} />
        </main>
      </div>
    </div>
  );
}

/* ── Root App ──────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [otpEmail, setOtpEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    try {
      const [authResult, configResult] = await Promise.all([
        api.auth.getCurrentUser(),
        api.auth.getPublicAuthConfig(),
      ]);

      if (configResult.data) {
        const config = configResult.data as {
          oAuthProviders?: string[];
          customOAuthProviders?: string[];
        };
        setOauthProviders([
          ...(config.oAuthProviders || []),
          ...(config.customOAuthProviders || []),
        ]);
      }

      if (authResult.data?.user) {
        setUser(authResult.data.user);
      }
    } catch (e) {
      console.warn('Init error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api.auth.signOut();
    setUser(null);
    setScreen('login');
  }

  /* Loading */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">
          <div style={{ width: 48, height: 48, background: '#1a1a1a', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <BookOpen size={22} />
          </div>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  /* Dashboard */
  if (user) {
    return <Dashboard user={user} onLogout={() => void logout()} />;
  }

  /* Auth screens */
  function navigate(s: Screen, data?: { email?: string }) {
    if (data?.email) setOtpEmail(data.email);
    setScreen(s);
  }

  if (screen === 'signup') {
    return <SignupScreen onNavigate={navigate} />;
  }
  if (screen === 'verify-otp') {
    return (
      <OtpScreen
        email={otpEmail}
        onSuccess={(u) => setUser(u)}
        onNavigate={navigate}
      />
    );
  }
  if (screen === 'forgot-password') {
    return <ForgotPasswordScreen onNavigate={navigate} />;
  }

  return (
    <LoginScreen
      onSuccess={(u) => setUser(u)}
      onNavigate={navigate}
      oauthProviders={oauthProviders}
    />
  );
}
