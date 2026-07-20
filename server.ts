/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { createServer as createViteServer } from 'vite';

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

// Middleware to parse JSON
app.use(express.json());

// Ensure uploads folder exists
const UPLOADS_DIR = './uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Ensure database has a default user for testing
async function seedDefaultUser() {
  const email = "mansourboukarly@gmail.com";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await prisma.user.create({
      data: {
        id: "mansour-id-1234",
        email,
        name: "Mansour Boukarly",
      }
    });
    console.log("Default seed user created: Mansour Boukarly");
  }
}
seedDefaultUser().catch(console.error);

// Auth Middleware: Resolve user by session token
app.use(async (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      });
      if (session && session.expiresAt > new Date()) {
        req.user = session.user;
        req.sessionToken = token;
      }
    } catch (e) {
      console.error("Auth middleware error:", e);
    }
  }
  next();
});

// Require Auth Helper
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: "Non authentifié. Veuillez vous connecter." });
  }
  next();
}

// Background indexing helper
async function processDocumentInBackground(documentId: string) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) return;

    // 1. Pending -> Extracting
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'extracting' }
    });
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Get physical file content if it's text/markdown
    let extractedText = "";
    let pageCount = 1;

    const filePath = doc.storagePath;
    const ext = path.extname(doc.originalFilename).toLowerCase();

    if (ext === '.txt' || ext === '.md') {
      try {
        if (fs.existsSync(filePath)) {
          extractedText = await fs.promises.readFile(filePath, 'utf-8');
          pageCount = Math.ceil(extractedText.length / 1000) || 1;
        }
      } catch (e) {
        console.error("Error reading physical file", e);
        extractedText = `Contenu du fichier ${doc.name}.`;
      }
    } else if (ext === '.pdf') {
      extractedText = `# Rapport d'Analyse : ${doc.name}\n\nCe document PDF présente une analyse sémantique pour la Mansour Knowledge Base.\n\n## Section 1 : Introduction\nLes bases de connaissances vectorielles permettent d'indexer des documents de manière sémantique. Les plongements (embeddings) transforment le texte en vecteurs de haute dimension.\n\n## Section 2 : Architecture MCP\nLe protocole Model Context Protocol (MCP) de Claude permet à l'assistant d'interroger directement ce dépôt en temps réel et de générer des réponses ancrées sur des faits.\n\n## Section 3 : Cas d'usage\nCe système est idéal pour les équipes produit, l'analyse de rapports financiers, les documentations techniques et les manuels de référence de Mansour.`;
      pageCount = 3;
    } else {
      extractedText = `# Document de Spécifications : ${doc.name}\n\nContenu extrait du document Microsoft Word DOCX.\n\n## Chapitre 1 : Traitement du langage naturel\nLes grands modèles de langage bénéficient de la recherche augmentée par génération (RAG) pour éviter les hallucinations et répondre avec précision en se basant sur des documents réels.\n\n## Chapitre 2 : Performance et Évolutivité\nL'indexation locale SQLite Prisma permet une vitesse d'exécution optimale avec des temps de réponse inférieurs à 50ms pour les recherches basiques.`;
      pageCount = 2;
    }

    // Force error if the filename contains "error" or "fail" for testing
    if (doc.originalFilename.toLowerCase().includes('error') || doc.originalFilename.toLowerCase().includes('fail')) {
      throw new Error("Erreur critique d'extraction (Code: 104) : Le document semble corrompu ou le format de codage est illisible.");
    }

    // 2. Extracting -> Indexing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'indexing', pageCount }
    });
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Chunking logic (simple paragraphs)
    const paragraphs = extractedText.split('\n\n').filter(p => p.trim().length > 10);
    const chunksData = paragraphs.map((content, idx) => {
      const firstLine = content.split('\n')[0] || '';
      const heading = firstLine.startsWith('#')
        ? firstLine.replace(/^#+\s*/, '')
        : `Section ${idx + 1}`;
      
      return {
        documentId,
        userId: doc.userId,
        chunkIndex: idx,
        content: content.trim(),
        pageStart: Math.min(pageCount, Math.ceil((idx + 1) / 2)),
        pageEnd: Math.min(pageCount, Math.ceil((idx + 1) / 2)),
        heading,
        tokenCount: Math.round(content.length / 4),
        metadata: JSON.stringify({ source: doc.originalFilename, idx, timestamp: new Date().toISOString() })
      };
    });

    // Delete any old chunks (in case of reindexing)
    await prisma.documentChunk.deleteMany({
      where: { documentId }
    });

    // Save chunks to db
    for (const chunk of chunksData) {
      await prisma.documentChunk.create({ data: chunk });
    }

    // 3. Indexing -> Ready
    await prisma.document.update({
      where: {
        id: documentId
      },
      data: {
        status: 'ready',
        chunkCount: chunksData.length,
        errorMessage: null
      }
    });

  } catch (err: any) {
    console.error("Background processing failed for document:", documentId, err);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'failed',
        errorMessage: err.message || "Une erreur inconnue est survenue lors du traitement."
      }
    });
  }
}

// ---------------- AUTH API ----------------

// Simulate magic link or password-free email login
app.post('/api/auth/login', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: "Une adresse email valide est requise." });
  }

  try {
    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
        }
      });
    }

    // Create a new session
    const token = 'sess_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    res.json({
      user,
      token,
      expiresAt: expiresAt.toISOString()
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erreur de connexion" });
  }
});

// Get current session user
app.get('/api/auth/session', async (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Non authentifié." });
  }
  res.json({ user: req.user });
});

// Logout
app.post('/api/auth/logout', async (req: any, res) => {
  if (req.sessionToken) {
    try {
      await prisma.session.delete({
        where: { token: req.sessionToken }
      });
    } catch (e) {
      console.error("Logout session deletion error:", e);
    }
  }
  res.json({ success: true });
});


// ---------------- DOCUMENTS API ----------------

// Multer configured to store files locally in /uploads folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return cb(new Error("Format non pris en charge. PDF, DOCX, TXT et MD uniquement."));
    }
    cb(null, true);
  }
});

// List documents with search & filter
app.get('/api/documents', requireAuth, async (req: any, res) => {
  const userId = req.user.id;
  const { search, format, status } = req.query;

  try {
    const whereClause: any = { userId };

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search) } },
        { originalFilename: { contains: String(search) } }
      ];
    }

    if (format && format !== 'All') {
      const fmtLower = String(format).toLowerCase();
      if (fmtLower === 'markdown') {
        whereClause.originalFilename = { endsWith: '.md' };
      } else {
        whereClause.originalFilename = { endsWith: `.${fmtLower}` };
      }
    }

    if (status && status !== 'All') {
      if (status === 'processing') {
        whereClause.status = { in: ['pending', 'extracting', 'indexing'] };
      } else {
        whereClause.status = String(status);
      }
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    res.json(documents);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erreur de chargement des documents" });
  }
});

// Dashboard Stats endpoint
app.get('/api/stats', requireAuth, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const totalCount = await prisma.document.count({ where: { userId } });
    const readyCount = await prisma.document.count({ where: { userId, status: 'ready' } });
    const errorCount = await prisma.document.count({ where: { userId, status: 'failed' } });
    const processingCount = await prisma.document.count({
      where: {
        userId,
        status: { in: ['pending', 'extracting', 'indexing', 'uploading'] }
      }
    });

    res.json({
      totalCount,
      readyCount,
      processingCount,
      errorCount
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erreur de chargement des statistiques" });
  }
});

// Get document details, chunks, and mock history timeline
app.get('/api/documents/:id', requireAuth, async (req: any, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const doc = await prisma.document.findFirst({
      where: { id, userId },
      include: { chunks: true }
    });

    if (!doc) {
      return res.status(404).json({ error: "Document non trouvé." });
    }

    res.json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Erreur lors du chargement du document." });
  }
});

// Upload a document
app.post('/api/documents/upload', requireAuth, (req: any, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Échec du téléversement du fichier." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier n'a été fourni." });
    }

    try {
      const file = req.file;
      const originalFilename = file.originalname;
      const mimeType = file.mimetype;
      const fileSize = file.size;
      const storagePath = file.path;
      const name = path.parse(originalFilename).name;

      // Create pending document in database
      const document = await prisma.document.create({
        data: {
          userId: req.user.id,
          name,
          originalFilename,
          mimeType,
          fileSize,
          storagePath,
          status: 'pending',
          checksum: 'chk_' + Math.random().toString(36).substring(2, 10),
        }
      });

      // Launch background indexing task!
      processDocumentInBackground(document.id).catch(console.error);

      res.status(201).json(document);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Une erreur est survenue lors de l'enregistrement." });
    }
  });
});

// Reindex a document
app.post('/api/documents/:id/reindex', requireAuth, async (req: any, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const doc = await prisma.document.findFirst({
      where: { id, userId }
    });

    if (!doc) {
      return res.status(404).json({ error: "Document non trouvé." });
    }

    // Reset status to pending and clear errors/chunks count
    const updatedDoc = await prisma.document.update({
      where: { id },
      data: {
        status: 'pending',
        errorMessage: null,
        chunkCount: 0
      }
    });

    // Fire the background process again!
    processDocumentInBackground(updatedDoc.id).catch(console.error);

    res.json(updatedDoc);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Échec du lancement de la réindexation." });
  }
});

// Delete a document permanently
app.delete('/api/documents/:id', requireAuth, async (req: any, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const doc = await prisma.document.findFirst({
      where: { id, userId }
    });

    if (!doc) {
      return res.status(404).json({ error: "Document non trouvé." });
    }

    // Delete from disk if exists
    if (fs.existsSync(doc.storagePath)) {
      try {
        fs.unlinkSync(doc.storagePath);
      } catch (e) {
        console.error("Error deleting physical file:", e);
      }
    }

    // Delete from DB (Prisma cascade on delete will clean up documentChunks as well!)
    await prisma.document.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Échec de la suppression définitive." });
  }
});


// ---------------- VITE MIDDLEWARE SETUP ----------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite middleware in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mansour Knowledge Base is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
