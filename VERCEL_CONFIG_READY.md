# ✅ Configuration Vercel Prête à Déployer

Copie-colle ces variables dans Vercel → Settings → Environment Variables:

## Frontend Variables (Public)
Pour: **Production** ET **Preview**

```
VITE_INSFORGE_ANON_KEY=anon_160d5eec8fd1feb3d25d999f8423b4b5aaf34f8b308cb10ac52d671cb4189684
VITE_INSFORGE_BASE_URL=https://6gjv88f7.eu-central.insforge.app
VITE_APP_URL=https://kb-liard-sigma.vercel.app
```

## Backend Variables (Secrets)
Pour: **Production** ET **Preview**

```
INSFORGE_BASE_URL=https://6gjv88f7.eu-central.insforge.app
INSFORGE_API_KEY=ik_e0a7fcf6f91b2d54c2d9aaa0467d683c
INSFORGE_ADMIN_KEY=ik_e0a7fcf6f91b2d54c2d9aaa0467d683c
INSFORGE_AUTH_URL=https://kb-liard-sigma.vercel.app/auth/callback

MCP_OWNER_ID=4ee0b249-6167-40c7-beef-cd8cb374f28b
MCP_API_KEY=ycw2Y0nHdwN97d45Y6oCtpuNM7TIFiIkzqIpWrw9R9V3UUAskJ3BTEVD6nlQ3g6e

APP_URL=https://kb-liard-sigma.vercel.app
NODE_ENV=production
```

## Après Configuration:

1. **Cliquez Save** pour chaque variable
2. **Allez à Deployments**
3. **Sélectionnez le dernier déploiement**
4. **Cliquez Redeploy**
5. **Attendez que ça se déploie**
6. **Ouvrez** https://kb-liard-sigma.vercel.app

---

## Vérification:

La page devrait:
- ✅ Charger sans erreur
- ✅ Afficher l'interface KB
- ✅ Se connecter à InsForge
- ✅ MCP serveur disponible

## Test MCP:

```bash
curl -X POST "https://kb-liard-sigma.vercel.app/api/mcp" \
  -H "Authorization: Bearer ycw2Y0nHdwN97d45Y6oCtpuNM7TIFiIkzqIpWrw9R9V3UUAskJ3BTEVD6nlQ3g6e" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

---

**Date:** 27 juillet 2026
**Status:** ✅ Prêt à déployer
