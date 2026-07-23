import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_BASE_URL;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

if (!baseUrl || !anonKey) {
  throw new Error('Configuration InsForge manquante. Vérifiez VITE_INSFORGE_BASE_URL et VITE_INSFORGE_ANON_KEY.');
}

export const insforge = createClient({ baseUrl, anonKey });
export const DOCUMENT_BUCKET = 'knowledge-documents';
