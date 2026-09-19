# Configuration des environnements

## Frontend public

```env
VITE_INSFORGE_BASE_URL="https://your-project.eu-central.insforge.app"
VITE_INSFORGE_ANON_KEY="YOUR_INSFORGE_ANON_KEY"
VITE_APP_URL="http://localhost:3000"
```

Ces valeurs sont embarquées dans le bundle navigateur. Aucune clé admin ne doit
apparaître ici.

## Serveur Vercel

```env
INSFORGE_BASE_URL="https://your-project.eu-central.insforge.app"
INSFORGE_ADMIN_KEY="YOUR_INSFORGE_ADMIN_KEY"
MCP_OWNER_ID="00000000-0000-0000-0000-000000000000"
APP_URL="https://your-app.vercel.app"

MCP_OAUTH_ISSUER="https://api.insforge.dev"
MCP_OAUTH_USERINFO_URL="https://api.insforge.dev/auth/v1/profile"
MCP_ALLOWED_EMAIL="you@example.com"
```

Option debug :

```env
MCP_STATIC_API_KEY="replace-with-a-long-random-debug-secret"
```

## Contrôles InsForge Auth

Dans la configuration Auth InsForge :

1. Active seulement les providers OAuth réellement utilisés.
2. Ajoute `http://localhost:3000/` pour le développement.
3. Ajoute l'URL HTTPS exacte de production.
4. Ne laisse pas `allowedRedirectUrls` vide en production.
