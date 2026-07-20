# Mansour Knowledge Base

Mansour Knowledge Base est une application web full-stack élégante et performante permettant de téléverser des documents (PDF, DOCX, TXT, MD), de suivre leur traitement d'indexation en temps réel et de les organiser au sein d'une bibliothèque documentaire sécurisée. Ce dépôt indexe localement le contenu textuel au sein d'une base SQLite via Prisma Client, le rendant prêt à être interrogé sémantiquement par un assistant Claude via le protocole Model Context Protocol (MCP).

---

## Fonctionnalités Clés

1. **Page de Connexion Sûre & Fluide** : Connexion simplifiée par e-mail ou bac à sable sans mot de passe complexe, stockant les sessions utilisateur directement dans SQLite pour une sécurité optimale.
2. **Tableau de Bord de Pilotage** :
   - Zone de glisser-déposer de haute fidélité (`UploadZone`) validant les types MIME et la taille limite de 10 Mo.
   - Files d'attente dynamiques affichant la progression réelle du téléversement.
   - Statistiques globales claires et filtres interactifs.
3. **Bibliothèque Documentaire** :
   - Recherche en temps réel par mot-clé et nom.
   - Tri intelligent par format et statut.
   - Grille responsive pour mobile et tableau aéré pour les écrans d'ordinateur.
4. **Fiche de Détails d'un Document** :
   - Informations techniques complètes (taille, pages, date, checksum sémantique).
   - Visionneuse de passages (chunks) extraits de manière réaliste par le moteur local SQLite.
   - Chronologie visuelle animée (`ProcessingTimeline`) retraçant les étapes de traitement (Téléversement → En attente → Extraction → Création de l'index → Prêt).
   - Commandes pour relancer l'indexation ou supprimer définitivement (avec avertissement).
5. **Paramètres Claude MCP** :
   - Informations de compte et règles d'import.
   - URL unique prête pour être connectée au client Claude Desktop via le protocole standardisé JSON-RPC MCP.

---

## Stack Technique

- **Frontend** : React 19, Tailwind CSS v4, Lucide Icons, Framer Motion transitions, TypeScript Strict.
- **Backend** : Express v4, Multer (stockage de fichiers physiques locaux), Vite Dev Server Middleware.
- **Base de données** : SQLite locale orchestrée par Prisma v7.
- **Sécurité** :
   - Sessions utilisateur chiffrées gérées en base SQLite.
   - Fichiers importés gérés de manière privée dans un répertoire local sécurisé (`./uploads`).
   - Requêtes filtrées par identifiant utilisateur au moyen de clés étrangères dans SQLite.

---

## Installation et Exécution

### 1. Cloner ou Extraire le Projet
Installez les dépendances du projet :
```bash
npm install
```

### 2. Configuration des Variables d'Environnement
Vérifiez que le fichier `.env` à la racine contient la déclaration de la base de données :
```env
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY="VOTRE_CLE_API"
APP_URL="http://localhost:3000"
```

### 3. Initialisation et Migration de la Base SQLite
Pour initialiser le fichier de base de données `dev.db` et y appliquer le schéma Prisma, exécutez la commande suivante :
```bash
npx prisma db push
```

Cette commande va créer le fichier SQLite localement et générer les définitions de types d'accès de Prisma Client.

### 4. Lancement en Mode Développement
Pour lancer le serveur Express et l'interface Vite en simultané sur le port 3000 :
```bash
npm run dev
```

Ouvrez ensuite votre navigateur sur [http://localhost:3000](http://localhost:3000).

---

## Spécification Technique de la Base de Données (Prisma Schema)

- **User** : Enregistrement de l'identifiant et de l'e-mail de l'utilisateur.
- **Session** : Stockage du jeton de session Bearer et de la date d'expiration pour la gestion de l'authentification locale.
- **Document** : Contient le statut du cycle de vie (`uploading`, `pending`, `extracting`, `indexing`, `ready`, `failed`), le chemin d'accès au fichier local, la taille, le nombre de pages et de blocs.
- **DocumentChunk** : Blocs textuels extraits avec indicateurs de page d'origine, en-têtes parents et jetons, liés par clé étrangère en cascade lors de la suppression de leur document.
- **Collection** : Métadonnées d'organisation des collections d'index.

---

## Intégration Claude (Model Context Protocol)

L'URL fournie dans l'onglet Paramètres est compatible avec la structure suivante pour votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "mansour-knowledge-base": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres", // ou votre module relais local
        "http://localhost:3000/api/mcp"
      ]
    }
  }
}
```
