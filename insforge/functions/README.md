# InsForge Function — process-document

Cette Function traite les fichiers PDF et DOCX déjà stockés dans le bucket privé
`knowledge-documents`.

## Sécurité

La Function :
- exige un Bearer token utilisateur InsForge ;
- résout l'utilisateur avec `auth.getCurrentUser()` ;
- accepte uniquement un `jobId` appartenant à cet utilisateur ;
- utilise ensuite un `createAdminClient()` uniquement côté serveur ;
- ne fait jamais confiance à un `owner_id` envoyé par le navigateur.

Secrets / variables à fournir au runtime Function :

```text
INSFORGE_BASE_URL
INSFORGE_ADMIN_KEY
```

`INSFORGE_ADMIN_API_KEY` est aussi accepté comme alias de la clé admin.

Ne jamais exposer cette clé via une variable `VITE_*`.

## Déploiement

Après `npx @insforge/cli login` puis `npx @insforge/cli link` :

```bash
npx @insforge/cli functions deploy process-document \
  --file ./insforge/functions/process-document.ts \
  --name "Process document" \
  --description "Extract PDF/DOCX text and build knowledge chunks"
```

Ou :

```bash
npm run insforge:function:deploy
```

Pour inspecter les logs :

```bash
npm run insforge:function:logs
```

## Limites défensives

- fichier source : 10 Mo max ;
- PDF : 300 pages max ;
- texte extrait : 2 000 000 caractères max ;
- XML DOCX principal : 20 Mo max ;
- extraction PDF : timeout applicatif de 45 s.

Un PDF scanné sans couche texte échoue explicitement avec un message indiquant
qu'un OCR est nécessaire. Aucun faux statut `ready` n'est produit.
