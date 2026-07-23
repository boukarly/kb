import { timingSafeEqual } from 'node:crypto';

import { createClient } from '@insforge/sdk';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';

type ServiceContext = {
  client: any;
  userId: string;
};

const DOCUMENT_STATUSES = [
  'uploading',
  'uploaded',
  'queued',
  'extracting',
  'chunking',
  'indexing',
  'ready',
  'failed',
  'deleting',
  'deleted',
] as const;

const baseUrl = (
  process.env.INSFORGE_BASE_URL ||
  process.env.VITE_INSFORGE_BASE_URL ||
  ''
).replace(/\/+$/, '');
const anonKey =
  process.env.INSFORGE_ANON_KEY || process.env.VITE_INSFORGE_ANON_KEY || '';
const serviceEmail = process.env.MCP_INSFORGE_EMAIL || '';
const servicePassword = process.env.MCP_INSFORGE_PASSWORD || '';
const configuredApiKey = process.env.MCP_API_KEY || '';

let servicePromise: Promise<ServiceContext> | null = null;

function requireServerConfiguration() {
  const missing: string[] = [];
  if (!baseUrl) missing.push('INSFORGE_BASE_URL');
  if (!anonKey) missing.push('INSFORGE_ANON_KEY');
  if (!serviceEmail) missing.push('MCP_INSFORGE_EMAIL');
  if (!servicePassword) missing.push('MCP_INSFORGE_PASSWORD');
  if (!configuredApiKey) missing.push('MCP_API_KEY');

  if (missing.length) {
    throw new Error(`Configuration MCP manquante : ${missing.join(', ')}`);
  }
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function readBearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] || '';
}

function crop(value: unknown, maximum = 4_000) {
  const text = typeof value === 'string' ? value : '';
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum)}\n[… passage tronqué …]`;
}

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : 'Erreur inattendue.';
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

async function createServiceContext(): Promise<ServiceContext> {
  requireServerConfiguration();

  const client = createClient({ baseUrl, anonKey }) as any;
  const { data, error } = await client.auth.signInWithPassword({
    email: serviceEmail,
    password: servicePassword,
  });

  if (error || !data?.user?.id) {
    throw new Error(
      error?.message || 'Connexion du service MCP à InsForge impossible.',
    );
  }

  return { client, userId: data.user.id };
}

async function getServiceContext() {
  if (!servicePromise) {
    servicePromise = createServiceContext().catch((error) => {
      servicePromise = null;
      throw error;
    });
  }

  return servicePromise;
}

async function audit(
  context: ServiceContext,
  action: string,
  details: Record<string, unknown>,
  resourceId?: string,
) {
  try {
    await context.client.database.from('audit_logs').insert({
      actor_id: context.userId,
      action,
      resource_type: 'mcp',
      resource_id: resourceId || null,
      details,
    });
  } catch {
    // L'audit ne doit jamais empêcher une lecture documentaire.
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'search',
      {
        title: 'Rechercher dans la bibliothèque',
        description:
          'Recherche en lecture seule dans les passages indexés de la bibliothèque documentaire. Retourne des extraits avec leurs documents sources.',
        inputSchema: {
          query: z.string().trim().min(2).max(500),
          limit: z.number().int().min(1).max(20).default(8),
        },
      },
      async ({ query, limit }) => {
        try {
          const context = await getServiceContext();
          const { data, error } = await context.client.database.rpc(
            'search_document_chunks',
            {
              search_query: query,
              result_limit: limit,
            },
          );

          if (error) throw new Error(error.message || 'Recherche impossible.');

          const results = (data || []).map((row: any) => ({
            chunkId: row.chunk_id,
            documentId: row.document_id,
            documentTitle: row.document_title,
            heading: row.heading || null,
            pageStart: row.page_start ?? null,
            pageEnd: row.page_end ?? null,
            rank: row.rank ?? null,
            content: crop(row.content, 3_500),
          }));

          await audit(context, 'mcp.search', {
            query,
            requestedLimit: limit,
            resultCount: results.length,
          });

          return jsonResult({ query, resultCount: results.length, results });
        } catch (error) {
          return errorResult(error);
        }
      },
    );

    server.registerTool(
      'list_documents',
      {
        title: 'Lister les documents',
        description:
          'Liste les documents accessibles au compte MCP, avec filtres facultatifs par titre, nom de fichier ou statut.',
        inputSchema: {
          query: z.string().trim().max(200).optional(),
          status: z.enum(DOCUMENT_STATUSES).optional(),
          limit: z.number().int().min(1).max(100).default(30),
        },
      },
      async ({ query, status, limit }) => {
        try {
          const context = await getServiceContext();
          let databaseQuery = context.client.database
            .from('documents')
            .select(
              'id,title,original_filename,mime_type,extension,size_bytes,status,progress,current_stage,page_count,chunk_count,language,metadata,created_at,updated_at',
            )
            .eq('owner_id', context.userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (status) databaseQuery = databaseQuery.eq('status', status);

          const { data, error } = await databaseQuery.limit(100);
          if (error) throw new Error(error.message || 'Liste impossible.');

          const normalizedQuery = query?.toLocaleLowerCase('fr') || '';
          const documents = (data || [])
            .filter((document: any) => {
              if (!normalizedQuery) return true;
              return `${document.title} ${document.original_filename}`
                .toLocaleLowerCase('fr')
                .includes(normalizedQuery);
            })
            .slice(0, limit);

          await audit(context, 'mcp.documents.list', {
            query: query || null,
            status: status || null,
            resultCount: documents.length,
          });

          return jsonResult({ count: documents.length, documents });
        } catch (error) {
          return errorResult(error);
        }
      },
    );

    server.registerTool(
      'get_document',
      {
        title: 'Consulter un document',
        description:
          'Retourne les métadonnées d’un document et, sur demande, une tranche de ses passages textuels indexés.',
        inputSchema: {
          documentId: z.string().uuid(),
          includeText: z.boolean().default(true),
          chunkOffset: z.number().int().min(0).max(10_000).default(0),
          chunkLimit: z.number().int().min(1).max(30).default(12),
        },
      },
      async ({ documentId, includeText, chunkOffset, chunkLimit }) => {
        try {
          const context = await getServiceContext();
          const { data: documentRows, error: documentError } =
            await context.client.database
              .from('documents')
              .select(
                'id,title,original_filename,mime_type,extension,size_bytes,status,progress,current_stage,page_count,chunk_count,language,error_message,metadata,created_at,updated_at',
              )
              .eq('id', documentId)
              .eq('owner_id', context.userId)
              .is('deleted_at', null)
              .limit(1);

          if (documentError) {
            throw new Error(documentError.message || 'Document inaccessible.');
          }

          const document = documentRows?.[0];
          if (!document) throw new Error('Document introuvable ou non autorisé.');

          let passages: any[] = [];
          let textTruncated = false;

          if (includeText) {
            const requested = Math.min(chunkOffset + chunkLimit, 250);
            const { data: chunkRows, error: chunkError } =
              await context.client.database
                .from('document_chunks')
                .select(
                  'id,chunk_index,heading,page_start,page_end,token_count,content,metadata',
                )
                .eq('document_id', documentId)
                .eq('owner_id', context.userId)
                .order('chunk_index', { ascending: true })
                .limit(requested);

            if (chunkError) {
              throw new Error(chunkError.message || 'Passages inaccessibles.');
            }

            let remainingCharacters = 42_000;
            for (const row of (chunkRows || []).slice(
              chunkOffset,
              chunkOffset + chunkLimit,
            )) {
              if (remainingCharacters <= 0) {
                textTruncated = true;
                break;
              }

              const content = crop(row.content, Math.min(6_000, remainingCharacters));
              remainingCharacters -= content.length;
              passages.push({ ...row, content });
            }
          }

          await audit(
            context,
            'mcp.document.read',
            {
              includeText,
              chunkOffset,
              chunkLimit,
              returnedChunks: passages.length,
            },
            documentId,
          );

          return jsonResult({
            document,
            passages,
            pagination: {
              offset: chunkOffset,
              limit: chunkLimit,
              returned: passages.length,
              totalChunks: document.chunk_count,
            },
            textTruncated,
          });
        } catch (error) {
          return errorResult(error);
        }
      },
    );

    server.registerTool(
      'fetch_chunk',
      {
        title: 'Lire un passage précis',
        description:
          'Retourne un passage indexé précis avec son document source et ses éventuels numéros de page.',
        inputSchema: {
          chunkId: z.string().uuid(),
        },
      },
      async ({ chunkId }) => {
        try {
          const context = await getServiceContext();
          const { data: chunkRows, error: chunkError } =
            await context.client.database
              .from('document_chunks')
              .select(
                'id,document_id,chunk_index,heading,page_start,page_end,token_count,content,metadata',
              )
              .eq('id', chunkId)
              .eq('owner_id', context.userId)
              .limit(1);

          if (chunkError) {
            throw new Error(chunkError.message || 'Passage inaccessible.');
          }

          const chunk = chunkRows?.[0];
          if (!chunk) throw new Error('Passage introuvable ou non autorisé.');

          const { data: documentRows } = await context.client.database
            .from('documents')
            .select('id,title,original_filename,extension,status')
            .eq('id', chunk.document_id)
            .eq('owner_id', context.userId)
            .limit(1);

          await audit(
            context,
            'mcp.chunk.read',
            { chunkId, documentId: chunk.document_id },
            chunk.document_id,
          );

          return jsonResult({
            document: documentRows?.[0] || null,
            chunk: { ...chunk, content: crop(chunk.content, 12_000) },
          });
        } catch (error) {
          return errorResult(error);
        }
      },
    );

    server.registerTool(
      'list_collections',
      {
        title: 'Lister les collections',
        description:
          'Liste les collections documentaires du compte connecté.',
        inputSchema: {
          limit: z.number().int().min(1).max(100).default(50),
        },
      },
      async ({ limit }) => {
        try {
          const context = await getServiceContext();
          const { data, error } = await context.client.database
            .from('collections')
            .select(
              'id,name,description,color,document_count,created_at,updated_at',
            )
            .eq('owner_id', context.userId)
            .order('name', { ascending: true })
            .limit(limit);

          if (error) throw new Error(error.message || 'Collections inaccessibles.');

          await audit(context, 'mcp.collections.list', {
            resultCount: data?.length || 0,
          });

          return jsonResult({ count: data?.length || 0, collections: data || [] });
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  },
  {},
  {
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: false,
  },
);

async function protectedHandler(request: Request) {
  try {
    requireServerConfiguration();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Configuration invalide.' },
      { status: 503 },
    );
  }

  const bearerToken = readBearerToken(request);
  if (!bearerToken || !secureEquals(bearerToken, configuredApiKey)) {
    return Response.json(
      { error: 'Jeton MCP absent ou invalide.' },
      {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer realm="mansour-knowledge-base"' },
      },
    );
  }

  return handler(request);
}

export const GET = protectedHandler;
export const POST = protectedHandler;
export const DELETE = protectedHandler;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, Mcp-Session-Id, Last-Event-ID',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    },
  });
}
