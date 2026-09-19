# Audit InsForge / MCP — correctifs appliqués

Date de l'audit : 2026-09-19

## Critiques corrigés

- Suppression des clés/projets InsForge réels présents dans les fichiers d'exemple et la documentation.
- `002_performance_optimization.sql` réparée :
  - suppression de `CREATE INDEX CONCURRENTLY` dans la migration transactionnelle ;
  - suppression des références invalides à `user_id` / `collection_documents.owner_id` ;
  - rétablissement des politiques RLS basées sur `owner_id`, `profiles.id` et les relations réelles.
- Ajout de `003_repair_invalid_rls.sql` pour réparer un environnement où l'ancienne 002 a déjà été tentée.
- Migration MCP de `mcp-handler` 1.x / MCP SDK 1.x vers `mcp-handler` 2.1.1 + `@modelcontextprotocol/server` 2.0.0.
- Ajout de `/.well-known/oauth-protected-resource` et des challenges OAuth via `withMcpAuth`.
- Canonicalisation de l'origine publique Vercel pour que les metadata OAuth n'annoncent pas une URL interne de proxy.
- Suppression du backend legacy Prisma/SQLite qui contredisait l'architecture InsForge.

## Auth web InsForge

- SDK épinglé à `@insforge/sdk` 1.5.2.
- OAuth aligné sur la signature actuelle :
  `signInWithOAuth(provider, { redirectTo })`.
- Chargement des providers via `auth.getPublicAuthConfig()`.
- `getCurrentUser()` conservé au bootstrap.
- Gestion explicite des erreurs de login, logout et OAuth.

## Documents / stockage

- Vérification des erreurs DB lors de l'indexation TXT/Markdown.
- Un document n'est plus marqué `ready` si l'insertion de chunks échoue.
- PDF/DOCX créent désormais un vrai `processing_jobs`.
- Suppression document plus défensive autour du couple Storage + Database.
- Le bucket `knowledge-documents` doit rester privé.

## Points restant à réaliser avant production

### 1. Révoquer l'ancienne clé InsForge

La clé supprimée du dépôt doit quand même être révoquée / régénérée côté InsForge.
Nettoyer le fichier ne révoque pas un secret déjà exposé.

### 2. Finaliser l'Authorization Server MCP

Ce dépôt fournit la partie **MCP Resource Server**.

L'Authorization Server choisi doit :
- être découvrable par le client MCP ;
- supporter Authorization Code + PKCE ;
- permettre un client ChatGPT/Claude via pré-enregistrement, CIMD ou DCR ;
- accepter le paramètre OAuth `resource` quand le client l'envoie ;
- émettre/valider des tokens adaptés à la ressource MCP ;
- fournir le scope `user:read` attendu ici.

La documentation InsForge actuelle documente son OAuth Server générique et demande
d'enregistrer l'application pour obtenir un client ID/secret. Il faut donc vérifier
le mode d'enregistrement MCP disponible pour ton intégration InsForge.

### 3. Déployer et tester la Function PDF/DOCX

Le worker est maintenant livré dans `insforge/functions/process-document.ts`.
Il reste une action distante manuelle : configurer `INSFORGE_BASE_URL` et
`INSFORGE_ADMIN_KEY` comme environnement/secrets de Function, puis déployer avec :

```bash
npm run insforge:function:deploy
```

La Function :
1. vérifie le Bearer token InsForge de l'appelant ;
2. vérifie que `processing_jobs.owner_id` correspond à l'utilisateur ;
3. télécharge le fichier privé côté serveur ;
4. extrait PDF texte ou DOCX avec des limites de ressources ;
5. recrée les `document_chunks` ;
6. termine le document/job ou enregistre explicitement l'échec.

Les PDF scannés sans texte nécessitent encore une étape OCR distincte.

### 4. Vérifier Storage en environnement réel

Le bucket doit être privé et testé avec deux comptes :
- utilisateur A ne doit jamais lire/supprimer un objet de B ;
- utilisateur B ne doit jamais lire/supprimer un objet de A.

## Validation réalisée dans l'environnement d'audit

- parsing syntaxique TypeScript/TSX, y compris la Function PDF/DOCX : OK ;
- parsing JSON : OK ;
- scan des anciennes clés/domaines sensibles : aucune valeur originale restante ;
- code legacy Prisma/SQLite : retiré ;
- colonnes RLS de la migration 002 : alignées avec le schéma 001.

Le `npm install` complet n'a pas pu être finalisé dans l'environnement d'audit
(absence d'accès réseau au registry npm). Je ne présente donc pas un build complet
comme validé. Exécuter après extraction :

```bash
npm install
npm run build
```

Puis tester le déploiement avec les variables de `.env.example`.

## Documentation de référence vérifiée

- InsForge SDK : https://github.com/InsForge/InsForge-sdk-js/blob/main/SDK-REFERENCE.md
- InsForge OAuth Server : https://docs.insforge.dev/oauth-server
- mcp-handler : https://github.com/vercel/mcp-handler
- OpenAI MCP auth : https://developers.openai.com/plugins/build/auth
