# Mansour Knowledge Base

Bibliothèque documentaire sécurisée construite avec React, Vite, InsForge et Vercel. Les utilisateurs peuvent déposer des fichiers PDF, DOCX, TXT et Markdown, conserver leurs métadonnées dans PostgreSQL et interroger les passages indexés depuis l’application ou depuis un client compatible Model Context Protocol (MCP).

## Architecture

- **Frontend** : React 19, Vite, Tailwind CSS 4 et TypeScript.
- **Authentification** : InsForge Auth, avec email/mot de passe ou OAuth.
- **Base de données** : PostgreSQL InsForge avec RLS.
- **Stockage** : bucket privé InsForge `knowledge-documents`.
- **Recherche** : PostgreSQL Full Text Search via `search_document_chunks`.
- **MCP** : serveur distant Streamable HTTP sur Vercel avec `mcp-handler`.

## État du traitement documentaire

- TXT et Markdown sont découpés et indexés directement depuis le navigateur.
- PDF et DOCX sont stockés avec le statut `queued` jusqu’à la mise en place du processeur d’extraction serveur.
- Le serveur MCP ne retourne que les passages déjà présents dans `document_chunks`.

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

L’application web locale est disponible sur `http://localhost:3000`.

## Variables frontend

```env
VITE_INSFORGE_BASE_URL="https://your-project.insforge.app"
VITE_INSFORGE_ANON_KEY="your-anon-key"
VITE_APP_URL="http://localhost:3000"
```

## Variables MCP côté serveur

Ces variables doivent être définies dans Vercel et ne doivent jamais être préfixées par `VITE_` lorsqu’elles contiennent des secrets.

```env
INSFORGE_BASE_URL="https://your-project.insforge.app"
INSFORGE_ANON_KEY="your-anon-key"
MCP_INSFORGE_EMAIL="your-insforge-login@example.com"
MCP_INSFORGE_PASSWORD="your-insforge-password"
MCP_API_KEY="a-long-random-secret"
```

Le compte indiqué par `MCP_INSFORGE_EMAIL` doit être le propriétaire des documents. Le serveur se connecte sous ce compte et les politiques RLS continuent donc à s’appliquer.

Pour générer une clé MCP :

```bash
openssl rand -base64 48
```

## Endpoint MCP

Après déploiement sur Vercel :

```text
https://your-deployment.vercel.app/api/mcp
```

Le serveur utilise Streamable HTTP et exige :

```http
Authorization: Bearer <MCP_API_KEY>
```

## Outils MCP disponibles

- `search` : recherche plein texte dans les passages indexés.
- `list_documents` : liste et filtre les documents.
- `get_document` : retourne les métadonnées et une tranche des passages.
- `fetch_chunk` : lit un passage précis avec sa source.
- `list_collections` : liste les collections documentaires.

Tous les outils sont en lecture seule. Les consultations sont inscrites dans `audit_logs`.

## Déploiement Vercel

1. Importer le dépôt dans Vercel.
2. Définir toutes les variables frontend et MCP.
3. Redéployer la branche concernée.
4. Connecter le client MCP à `/api/mcp` avec le Bearer token.

Le fichier `vercel.json` fait passer les fonctions `/api/*` avant le fallback de la SPA.

## Base InsForge

Le schéma complet est versionné ici :

```text
insforge/migrations/001_knowledge_base.sql
```

Il crée les tables, fonctions, index, triggers et politiques RLS nécessaires. Le bucket `knowledge-documents` doit être créé séparément dans l’onglet Storage d’InsForge et rester privé.

## Sécurité

- Ne jamais placer `MCP_INSFORGE_PASSWORD` ou `MCP_API_KEY` dans une variable `VITE_*`.
- Ne jamais publier la clé administrateur InsForge dans le dépôt.
- Conserver le bucket privé.
- Faire tourner la clé MCP en cas de doute.
- Garder les outils MCP en lecture seule tant que l’audit et les contrôles d’accès n’ont pas été pleinement testés.
