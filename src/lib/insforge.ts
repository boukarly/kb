import { createClient } from '@insforge/sdk';

const rawBaseUrl = import.meta.env.VITE_INSFORGE_BASE_URL?.trim();
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY?.trim();

if (!rawBaseUrl || !anonKey) {
  throw new Error(
    'Configuration InsForge manquante. Vérifiez VITE_INSFORGE_BASE_URL et VITE_INSFORGE_ANON_KEY.',
  );
}

// InsForge ajoute lui-même `/api/...`. Retirer les slashs finaux évite
// des URL invalides comme `https://projet.insforge.app//api/database/...`.
const baseUrl = rawBaseUrl.replace(/\/+$/, '');

if (!/^https?:\/\//i.test(baseUrl)) {
  throw new Error('VITE_INSFORGE_BASE_URL doit commencer par http:// ou https://.');
}

export const insforge = createClient({ baseUrl, anonKey });
export const DOCUMENT_BUCKET = 'knowledge-documents';
