import { timingSafeEqual } from 'node:crypto';

import { createAdminClient } from '@insforge/sdk';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';

type AdminClient = ReturnType<typeof createAdminClient>;

type ServiceContext = {
  client: AdminClient;
  ownerId: string;
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
const adminKey = process.env.INSFORGE_ADMIN_KEY || '';
const ownerId = process.env.MCP_OWNER_ID || '';

const oauthIssuer = (process.env.MCP_OAUTH_ISSUER || '').replace(/\/+$/, '');
const oauthUserInfoUrl = process.env.MCP_OAUTH_USERINFO_URL || '';
const allowedEmail = (process.env.MCP_ALLOWED_EMAIL || '')
  .trim()
  .toLowerCase();
const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
// Optional local/debug fallback. Standard ChatGPT/Claude connectors should use OAuth.
const configuredStaticApiKey = process.env.MCP_STATIC_API_KEY || '';

let serviceContext: ServiceContext | null = null;

function requireServerConfiguration() {
  const missing: string[] = [];
  if (!baseUrl) missing.push('INSFORGE_BASE_URL');
  if (!adminKey) missing.push('INSFORGE_ADMIN_KEY');
  if (!ownerId) missing.push('MCP_OWNER_ID');

  // Le fallback par clé statique est réservé au debug. En production OAuth,
  // ces trois valeurs doivent être configurées explicitement.
  if (!configuredStaticApiKey) {
    if (!oauthIssuer) missing.push('MCP_OAUTH_ISSUER');
    if (!oauthUserInfoUrl) missing.push('MCP_OAUTH_USERINFO_URL');
    if (!allowedEmail) missing.push('MCP_ALLOWED_EMAIL');
  }

  if (missing.length) {
    throw new Error(`Configuration MCP manquante : ${missing.join(', ')}`);
  }

  if (!z.string().uuid().safeParse(ownerId).success) {
    throw new Error('MCP_OWNER_ID doit être un UUID valide.');
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

function getServiceContext(): ServiceContext {
  requireServerConfiguration();

  if (!serviceContext) {
    serviceContext = {
      client: createAdminClient({ baseUrl, apiKey: adminKey }),
      ownerId,
    };
  }

  return serviceContext;
}

async function audit(
  context: ServiceContext,
  action: string,
  details: Record<string, unknown>,
  resourceId?: string,
) {
  try {
    await context.client.database.from('audit_logs').insert({
      actor_id: context.ownerId,
      action,
      resource_type: 'mcp',
      resource_id: resourceId || null,
      details,
    });
  } catch {
    // L'audit ne doit jamais empêcher une lecture documentaire.
  }
}

async function getDocumentMap(
  context: ServiceContext,
  documentIds: string[],
) {
  const uniqueIds = [...new Set(documentIds)].filter(Boolean);
  const map = new Map<string, any>();

  if (!uniqueIds.length) return map;

  const { data, error } = await context.client.database
    .from('documents')
    .select('id,title,original_filename,extension,status')
    .in('id', uniqueIds)
    .eq('owner_id', context.ownerId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message || 'Sources documentaires inaccessibles.');
  }

  for (const document of data || []) map.set(document.id, document);
  return map;
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'search',
      {
        title: 'Rechercher dans la bibliothèque',
        description:
          'Recherche en lecture seule dans les passages indexés de la bibliothèque documentaire. Retourne des extraits avec leurs documents sources.',
        inputSchema: z.object({
          query: z.string().trim().min(2).max(500),
          limit: z.number().int().min(1).max(20).default(8),
        }),
      },
      async ({ query, limit }) => {
        try {
          const context = getServiceContext();
          const { data: chunkRows, error } = await context.client.database
            .from('document_chunks')
            .select(
              'id,document_id,chunk_index,heading,page_start,page_end,token_count,content,metadata',
            )
            .eq('owner_id', context.ownerId)
            .textSearch('search_vector', query, {
              config: 'simple',
              type: 'websearch',
            })
            .limit(limit);

          if (error) throw new Error(error.message || 'Recherche impossible.');

          const documentMap = await getDocumentMap(
            context,
            (chunkRows || []).map((row: any) => row.document_id),
          );

          const results = (chunkRows || [])
            .filter((row: any) => documentMap.has(row.document_id))
            .map((row: any) => {
              const document = documentMap.get(row.document_id);
              return {
                chunkId: row.id,
                documentId: row.document_id,
                documentTitle: document?.title || null,
                originalFilename: document?.original_filename || null,
                heading: row.heading || null,
                pageStart: row.page_start ?? null,
                pageEnd: row.page_end ?? null,
                content: crop(row.content, 3_500),
              };
            });

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
          'Liste les documents de la bibliothèque personnelle, avec filtres facultatifs par titre, nom de fichier ou statut.',
        inputSchema: z.object({
          query: z.string().trim().max(200).optional(),
          status: z.enum(DOCUMENT_STATUSES).optional(),
          limit: z.number().int().min(1).max(100).default(30),
        }),
      },
      async ({ query, status, limit }) => {
        try {
          const context = getServiceContext();
          let databaseQuery = context.client.database
            .from('documents')
            .select(
              'id,title,original_filename,mime_type,extension,size_bytes,status,progress,current_stage,page_count,chunk_count,language,metadata,created_at,updated_at',
            )
            .eq('owner_id', context.ownerId)
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
        inputSchema: z.object({
          documentId: z.string().uuid(),
          includeText: z.boolean().default(true),
          chunkOffset: z.number().int().min(0).max(10_000).default(0),
          chunkLimit: z.number().int().min(1).max(30).default(12),
        }),
      },
      async ({ documentId, includeText, chunkOffset, chunkLimit }) => {
        try {
          const context = getServiceContext();
          const { data: documentRows, error: documentError } =
            await context.client.database
              .from('documents')
              .select(
                'id,title,original_filename,mime_type,extension,size_bytes,status,progress,current_stage,page_count,chunk_count,language,error_message,metadata,created_at,updated_at',
              )
              .eq('id', documentId)
              .eq('owner_id', context.ownerId)
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
                .eq('owner_id', context.ownerId)
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

              const content = crop(
                row.content,
                Math.min(6_000, remainingCharacters),
              );
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
        inputSchema: z.object({
          chunkId: z.string().uuid(),
        }),
      },
      async ({ chunkId }) => {
        try {
          const context = getServiceContext();
          const { data: chunkRows, error: chunkError } =
            await context.client.database
              .from('document_chunks')
              .select(
                'id,document_id,chunk_index,heading,page_start,page_end,token_count,content,metadata',
              )
              .eq('id', chunkId)
              .eq('owner_id', context.ownerId)
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
            .eq('owner_id', context.ownerId)
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
        description: 'Liste les collections de la bibliothèque personnelle.',
        inputSchema: z.object({
          limit: z.number().int().min(1).max(100).default(50),
        }),
      },
      async ({ limit }) => {
        try {
          const context = getServiceContext();
          const { data, error } = await context.client.database
            .from('collections')
            .select(
              'id,name,description,color,document_count,created_at,updated_at',
            )
            .eq('owner_id', context.ownerId)
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
  {
    serverInfo: {
      name: 'mansour-knowledge-base',
      version: '2.0.0',
    },
    verboseLogs: false,
  },
);

type OAuthUserProfile = {
  user?: {
    id?: string;
    email?: string;
  };
  sub?: string;
  email?: string;
};

async function verifyToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  requireServerConfiguration();

  if (
    configuredStaticApiKey &&
    secureEquals(bearerToken, configuredStaticApiKey)
  ) {
    return {
      token: bearerToken,
      scopes: ['user:read'],
      clientId: 'local-debug-client',
      extra: {
        authMethod: 'static-debug-key',
        ownerId,
      },
    };
  }

  if (!allowedEmail) return undefined;

  let response: Response;
  try {
    response = await fetch(oauthUserInfoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return undefined;
  }

  if (!response.ok) return undefined;

  let profile: OAuthUserProfile;
  try {
    profile = (await response.json()) as OAuthUserProfile;
  } catch {
    return undefined;
  }

  const email = (profile.user?.email || profile.email)?.trim().toLowerCase();
  if (!email || email !== allowedEmail) return undefined;

  return {
    token: bearerToken,
    scopes: ['user:read'],
    clientId: profile.user?.id || profile.sub || email,
    extra: {
      authMethod: 'oauth',
      oauthIssuer,
      email,
      ownerId,
    },
  };
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ['user:read'],
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

function canonicalizeRequest(request: Request) {
  if (!appUrl) return request;

  const inboundUrl = new URL(request.url);
  const canonicalUrl = new URL(
    `${inboundUrl.pathname}${inboundUrl.search}`,
    `${appUrl}/`,
  );

  if (canonicalUrl.origin === inboundUrl.origin) return request;
  return new Request(canonicalUrl, request);
}

async function configuredAuthHandler(request: Request) {
  try {
    requireServerConfiguration();
    return await authHandler(canonicalizeRequest(request));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Configuration MCP invalide.',
      },
      { status: 503 },
    );
  }
}

export const GET = configuredAuthHandler;
export const POST = configuredAuthHandler;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version, Last-Event-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Expose-Headers': 'WWW-Authenticate',
      Vary: 'Origin',
    },
  });
}
