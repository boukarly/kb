# Déploiement Vercel

1. Importer le dépôt.
2. Utiliser Node.js 20 ou plus récent.
3. Ajouter toutes les variables serveur de `ENVIRONMENT_SETUP.md`.
4. Ajouter les variables `VITE_*` nécessaires au frontend.
5. Déployer.
6. Vérifier :
   - `/` charge l'application ;
   - `/.well-known/oauth-protected-resource` renvoie du JSON ;
   - `/api/mcp` sans token renvoie `401` avec `WWW-Authenticate`.

Le fichier `vercel.json` route explicitement le endpoint well-known avant le
fallback SPA.

## Test MCP local avec clé debug

Définir `MCP_STATIC_API_KEY`, puis appeler le serveur avec :

```text
Authorization: Bearer <MCP_STATIC_API_KEY>
```

Ce test valide uniquement le transport et les outils. ChatGPT/Claude doivent passer
par OAuth.

## Auth OAuth distante

`APP_URL` doit être l'origine publique canonique. Elle sert à annoncer la ressource
MCP correcte même derrière le proxy Vercel.
