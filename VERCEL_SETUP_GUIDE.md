# 🚀 Vercel Environment Variables Setup Guide

## Instructions Rapides

1. Allez à: https://vercel.com/dashboard
2. Sélectionnez le projet **kb**
3. Allez à **Settings** → **Environment Variables**
4. Ajoutez chaque variable ci-dessous pour **Production** ET **Preview**
5. Cliquez **Save**
6. Redéployez le projet

---

## Variables à Ajouter

### Frontend Variables (Publiques - Safe)
Ces variables sont exposées au frontend et sont sûres.

```
VITE_INSFORGE_BASE_URL = https://6gjv88f7.eu-central.insforge.app
VITE_INSFORGE_ANON_KEY = anon_160d5eec8fd1feb3d25d999f8423b4b5aaf34f8b308cb10ac52d671cb4189684
VITE_APP_URL = https://kb-liard-sigma.vercel.app
```

### Backend/Server Variables (Secrets - À Garder Privés)
Ces variables NE SONT PAS exposées au frontend.

```
INSFORGE_API_KEY = ik_e0a7fcf6f91b2d54c2d9aaa0467d683c
INSFORGE_ADMIN_KEY = [Remplacer par votre clé admin InsForge]
INSFORGE_BASE_URL = https://6gjv88f7.eu-central.insforge.app

MCP_OWNER_ID = 4ee0b249-6167-40c7-beef-cd8cb374f28b
MCP_API_KEY = [Remplacer par votre clé API secrète]

INSFORGE_AUTH_URL = https://kb-liard-sigma.vercel.app/auth/callback
APP_URL = https://kb-liard-sigma.vercel.app

JWT_SECRET = [Générer une clé sécurisée aléatoire]
```

---

## Tableau Récapitulatif

| Variable | Valeur | Type | Environnement |
|----------|--------|------|---|
| `VITE_INSFORGE_BASE_URL` | `https://6gjv88f7.eu-central.insforge.app` | Public | Prod + Preview |
| `VITE_INSFORGE_ANON_KEY` | `anon_160d5eec8fd1feb3d25d999f8423b4b5aaf34f8b308cb10ac52d671cb4189684` | Public | Prod + Preview |
| `VITE_APP_URL` | `https://kb-liard-sigma.vercel.app` | Public | Prod + Preview |
| `INSFORGE_API_KEY` | `ik_e0a7fcf6f91b2d54c2d9aaa0467d683c` | Secret | Prod + Preview |
| `INSFORGE_ADMIN_KEY` | À obtenir de InsForge | Secret | Prod + Preview |
| `INSFORGE_AUTH_URL` | `https://kb-liard-sigma.vercel.app/auth/callback` | Secret | Prod + Preview |
| `APP_URL` | `https://kb-liard-sigma.vercel.app` | Secret | Prod + Preview |
| `MCP_OWNER_ID` | `4ee0b249-6167-40c7-beef-cd8cb374f28b` | Secret | Prod + Preview |
| `MCP_API_KEY` | À générer | Secret | Prod + Preview |

---

## ✅ Checklist de Sécurité

- ✅ ANON_KEY de InsForge est exposée (c'est correct, c'est sa fonction)
- ✅ ADMIN_KEY et ADMIN_SECRET restent privés
- ✅ JWT_SECRET généré aléatoirement et sécurisé
- ✅ MCP_API_KEY est un secret long aléatoire
- ✅ Toutes les variables de secret sont en Production ET Preview
- ✅ CORS configuré pour `https://kb-liard-sigma.vercel.app`

---

## Après Configuration

1. **Redéployer le projet:**
   - Allez à **Deployments** dans Vercel
   - Cliquez sur le déploiement récent
   - Cliquez **Redeploy**

2. **Vérifier que ça marche:**
   - Ouvrez `https://kb-liard-sigma.vercel.app`
   - Vous devriez voir l'application charger (pas d'erreur InsForge)

3. **Tester la connexion:**
   - Vérifiez la console (F12) pour les erreurs
   - Testez les appels API à InsForge

---

## Dépannage

**Si vous avez encore une erreur "Configuration InsForge manquante":**
- Vérifiez que `VITE_INSFORGE_ANON_KEY` est exactement correct
- Vérifiez que `VITE_INSFORGE_BASE_URL` est correct
- Attendez 30 secondes et rafraîchissez (cache)

**Si les données ne chargent pas:**
- Vérifiez que `INSFORGE_API_KEY` est correct
- Vérifiez que `INSFORGE_ADMIN_KEY` est correct
- Vérifiez les logs Vercel pour les erreurs serveur

---

**Dernière mise à jour:** 27 juillet 2026
