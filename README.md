# Mansour Knowledge Base

Bibliothèque documentaire sécurisée construite avec React, Vite, InsForge et Vercel.

## Architecture

- Frontend : React + Vite + TypeScript.
- Auth web : InsForge Auth (email/password + providers OAuth activés dans le projet).
- Database : PostgreSQL InsForge avec RLS par `auth.uid()`.
- Storage : bucket privé `knowledge-documents`.
- MCP : Streamable HTTP sur `/api/mcp`, protégé comme ressource OAuth.
- Traitement texte : TXT/Markdown indexés côté web.
- Traitement PDF/DOCX : job `processing_jobs` + Function InsForge authentifiée `process-document` (PDF texte et DOCX).

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Le frontend local écoute sur `http://localhost:3000`.

## Auth web InsForge

Le SDK est initialisé avec :

```env
VITE_INSFORGE_BASE_URL="https://your-project.eu-central.insforge.app"
VITE_INSFORGE_ANON_KEY="YOUR_INSFORGE_ANON_KEY"
```

La page de connexion utilise `auth.getPublicAuthConfig()` avant d'afficher Google/GitHub.
Le flow OAuth utilise la signature SDK actuelle :

```ts
insforge.auth.signInWithOAuth('google', {
  redirectTo: `${window.location.origin}/`,
});
```

Dans InsForge, ajoute les origines de développement et de production à `allowedRedirectUrls`.

## Variables serveur

```env
INSFORGE_BASE_URL="https://your-project.eu-central.insforge.app"
INSFORGE_ADMIN_KEY="YOUR_INSFORGE_ADMIN_KEY"
MCP_OWNER_ID="00000000-0000-0000-0000-000000000000"

APP_URL="https://your-app.vercel.app"

MCP_OAUTH_ISSUER="https://api.insforge.dev"
MCP_OAUTH_USERINFO_URL="https://api.insforge.dev/auth/v1/profile"
MCP_ALLOWED_EMAIL="you@example.com"

# Debug local uniquement :
MCP_STATIC_API_KEY="replace-with-a-long-random-debug-secret"
```

`INSFORGE_ADMIN_KEY` n'est jamais exposée au frontend. Le MCP utilise l'admin client
uniquement après authentification et applique toujours `owner_id = MCP_OWNER_ID`.

## Auth MCP

Le serveur publie :

```text
GET /.well-known/oauth-protected-resource
POST /api/mcp
```

Une requête MCP non authentifiée reçoit un challenge `WWW-Authenticate` généré par
`withMcpAuth`. Le token OAuth est validé via `MCP_OAUTH_USERINFO_URL`, puis l'email
retourné doit être exactement `MCP_ALLOWED_EMAIL`.

Le mode `MCP_STATIC_API_KEY` est conservé uniquement pour `curl`/tests locaux. Ne le
considère pas comme le mécanisme d'authentification ChatGPT/Claude.

Le dépôt épingle `mcp-handler` à `2.1.1` et `@modelcontextprotocol/server` à `2.0.0` afin d'éviter une dépendance `latest` ou une version non publiée.

Pour ChatGPT ou Claude, l'authorization server annoncé par `MCP_OAUTH_ISSUER` doit
supporter le flow OAuth attendu par MCP (authorization code + PKCE et un mécanisme
de client compatible : CIMD, DCR ou client pré-enregistré).

La documentation InsForge actuelle confirme PKCE et les endpoints ci-dessus, mais
demande encore d'enregistrer l'application OAuth pour obtenir un client ID/secret.
Le présent dépôt corrige la **resource server MCP** ; il ne transforme pas
automatiquement l'OAuth Server générique InsForge en serveur CIMD/DCR. Pour une
connexion ChatGPT/Claude, vérifie donc dans ton environnement InsForge que le client
MCP est pré-enregistré ou que le mécanisme d'enregistrement attendu est disponible.

## Migrations

Appliquer dans l'ordre :

```text
001_knowledge_base.sql
002_performance_optimization.sql
003_repair_invalid_rls.sql
```

`002` a été corrigée : pas de `CREATE INDEX CONCURRENTLY`, et les policies utilisent
les vraies colonnes (`owner_id`, `profiles.id`, relations de `collection_documents`).

`003` est volontairement idempotente et répare un environnement où l'ancienne
version incorrecte de `002` aurait déjà été tentée.

## Storage

Créer le bucket `knowledge-documents` côté InsForge et le conserver privé.
Le chemin d'upload est :

```text
<user-id>/<document-id>/<filename>
```

Ce chemin ne remplace pas les permissions : le bucket doit rester privé et les
opérations doivent être exécutées avec l'utilisateur authentifié.

## PDF / DOCX

La Function InsForge `insforge/functions/process-document.ts` est incluse.

Le flux est désormais :

```text
upload privé
→ création documents
→ création processing_jobs
→ appel authentifié de process-document
→ extraction PDF/DOCX côté serveur
→ création document_chunks
→ documents.status = ready
→ processing_jobs.status = succeeded
```

La Function vérifie l'utilisateur à partir du Bearer token InsForge transmis par
`functions.invoke()` et ne fait confiance à aucun `owner_id` venant du body. Elle
utilise ensuite la clé admin uniquement côté Function, après avoir prouvé que le job
et le document appartiennent à cet utilisateur.

Configurer les secrets/environnement de la Function côté InsForge :

```text
INSFORGE_BASE_URL
INSFORGE_ADMIN_KEY
```

Puis déployer :

```bash
npm run insforge:function:deploy
```

Pour inspecter les logs :

```bash
npm run insforge:function:logs
```

Limites de sécurité actuelles : fichiers <= 10 Mo, PDF <= 300 pages, extraction
bornée, DOCX décompressé de façon sélective. Les PDF scannés sans couche texte ne
font pas encore d'OCR et passent explicitement en `failed`.

Si la Function n'est pas encore déployée au moment d'un upload, le job reste
`queued` et l'interface le signale. Après déploiement, il peut être relancé en
appelant `process-document` avec `{ "jobId": "<uuid>" }`.

## Sécurité

- Ne jamais committer de clé `ik_...`.
- Ne jamais préfixer une clé admin par `VITE_`.
- Faire tourner toute clé qui a déjà été commitée.
- Restreindre `allowedRedirectUrls` en production.
- Garder les outils MCP en lecture seule.
- Garder `MCP_ALLOWED_EMAIL` et `MCP_OWNER_ID` cohérents.
