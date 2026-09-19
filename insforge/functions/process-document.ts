import { createAdminClient, createClient } from 'npm:@insforge/sdk@1.5.2';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';
import { strFromU8, unzipSync } from 'npm:fflate@0.8.2';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 300;
const MAX_EXTRACTED_CHARACTERS = 2_000_000;
const MAX_DOCX_XML_BYTES = 20_000_000;
const CHUNK_TARGET = 1800;
const PDF_TIMEOUT_MS = 45_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
};

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing Function environment variable: ${name}`);
  return value;
}

function adminKey() {
  return (
    Deno.env.get('INSFORGE_ADMIN_KEY')?.trim() ||
    Deno.env.get('INSFORGE_ADMIN_API_KEY')?.trim() ||
    ''
  );
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Document processing failed.';
  return message.replace(/\s+/g, ' ').trim().slice(0, 1000);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitText(value: string) {
  const text = normalizeExtractedText(value);
  if (!text) return [];

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const block of blocks) {
    if (block.length > CHUNK_TARGET * 2) {
      flush();

      const sentences = block
        .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ0-9])/u)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

      let sentenceBuffer = '';
      for (const sentence of sentences.length ? sentences : [block]) {
        if (
          sentenceBuffer &&
          `${sentenceBuffer} ${sentence}`.length > CHUNK_TARGET
        ) {
          chunks.push(sentenceBuffer.trim());
          sentenceBuffer = sentence;
        } else {
          sentenceBuffer = sentenceBuffer
            ? `${sentenceBuffer} ${sentence}`
            : sentence;
        }
      }

      if (sentenceBuffer) chunks.push(sentenceBuffer.trim());
      continue;
    }

    if (current && `${current}\n\n${block}`.length > CHUNK_TARGET) {
      flush();
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }

  flush();
  return chunks.filter(Boolean);
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  label: string,
): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${milliseconds} ms.`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function extractPdf(bytes: Uint8Array) {
  const pdf = await withTimeout(
    getDocumentProxy(bytes),
    15_000,
    'PDF open',
  );

  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(
      `PDF has ${pdf.numPages} pages; limit is ${MAX_PDF_PAGES}.`,
    );
  }

  const extracted = await withTimeout(
    extractText(pdf, { mergePages: false }),
    PDF_TIMEOUT_MS,
    'PDF text extraction',
  );

  const rawPages = Array.isArray(extracted.text)
    ? extracted.text
    : [extracted.text];

  const pages = rawPages.map((page) => normalizeExtractedText(page || ''));
  const totalCharacters = pages.reduce((sum, page) => sum + page.length, 0);

  if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
    throw new Error(
      `Extracted PDF text is too large (${totalCharacters} characters).`,
    );
  }

  return {
    pageCount: extracted.totalPages || pdf.numPages,
    pages,
  };
}

function extractDocx(bytes: Uint8Array) {
  const files = unzipSync(bytes, {
    filter(file) {
      return (
        file.name === 'word/document.xml' &&
        file.originalSize <= MAX_DOCX_XML_BYTES
      );
    },
  });

  const documentXml = files['word/document.xml'];
  if (!documentXml) {
    throw new Error(
      'DOCX main document.xml is missing or exceeds the extraction limit.',
    );
  }

  let xml = strFromU8(documentXml);
  xml = xml
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:tc>/gi, '\t')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n\n')
    .replace(/<w:t\b[^>]*>/gi, '')
    .replace(/<\/w:t>/gi, '')
    .replace(/<[^>]+>/g, '');

  const text = normalizeExtractedText(decodeXmlEntities(xml));

  if (text.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error(
      `Extracted DOCX text is too large (${text.length} characters).`,
    );
  }

  return text;
}

function makeChunkRows(
  documentId: string,
  ownerId: string,
  extension: string,
  extracted: { pages?: string[]; text?: string },
) {
  const rows: Array<Record<string, unknown>> = [];
  let chunkIndex = 0;

  if (extension === 'pdf') {
    for (let pageIndex = 0; pageIndex < (extracted.pages || []).length; pageIndex++) {
      const page = extracted.pages?.[pageIndex] || '';
      for (const content of splitText(page)) {
        rows.push({
          document_id: documentId,
          owner_id: ownerId,
          chunk_index: chunkIndex++,
          content,
          heading: content.split('\n')[0].slice(0, 160),
          page_start: pageIndex + 1,
          page_end: pageIndex + 1,
          token_count: Math.ceil(content.length / 4),
          metadata: {
            source: 'process-document',
            extractor: 'unpdf@1.8.1',
          },
        });
      }
    }
  } else {
    for (const content of splitText(extracted.text || '')) {
      rows.push({
        document_id: documentId,
        owner_id: ownerId,
        chunk_index: chunkIndex++,
        content,
        heading: content.split('\n')[0].slice(0, 160),
        page_start: null,
        page_end: null,
        token_count: Math.ceil(content.length / 4),
        metadata: {
          source: 'process-document',
          extractor: 'docx-xml',
        },
      });
    }
  }

  return rows;
}

async function insertChunkBatches(
  admin: ReturnType<typeof createAdminClient>,
  rows: Array<Record<string, unknown>>,
) {
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await admin.database
      .from('document_chunks')
      .insert(rows.slice(index, index + 100));

    if (error) {
      throw new Error(error.message || 'Unable to insert document chunks.');
    }
  }
}

export default async function processDocument(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const baseUrl = requiredEnv('INSFORGE_BASE_URL').replace(/\/+$/, '');
  const key = adminKey();
  if (!key) {
    return json(
      {
        error: 'FUNCTION_MISCONFIGURED',
        message:
          'INSFORGE_ADMIN_KEY (or INSFORGE_ADMIN_API_KEY) is not configured as a Function secret.',
      },
      503,
    );
  }

  const authHeader = req.headers.get('Authorization') || '';
  const userToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!userToken) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const userClient = createClient({
    baseUrl,
    edgeFunctionToken: userToken,
  });

  const { data: authData, error: authError } =
    await userClient.auth.getCurrentUser();

  const userId = authData?.user?.id;
  if (authError || !userId) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  let payload: { jobId?: string };
  try {
    payload = (await req.json()) as { jobId?: string };
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const jobId = payload.jobId?.trim();
  if (!jobId) {
    return json({ error: 'JOB_ID_REQUIRED' }, 400);
  }

  const admin = createAdminClient({
    baseUrl,
    apiKey: key,
  });

  const { data: jobRows, error: jobError } = await admin.database
    .from('processing_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('owner_id', userId)
    .limit(1);

  if (jobError) {
    return json(
      { error: 'JOB_LOOKUP_FAILED', message: jobError.message },
      500,
    );
  }

  const job = jobRows?.[0];
  if (!job) {
    return json({ error: 'JOB_NOT_FOUND' }, 404);
  }

  if (job.status === 'succeeded') {
    return json({ ok: true, jobId, alreadyProcessed: true });
  }

  if (job.status === 'running') {
    return json({ error: 'JOB_ALREADY_RUNNING' }, 409);
  }

  if (job.status === 'cancelled') {
    return json({ error: 'JOB_CANCELLED' }, 409);
  }

  const attemptCount = Number(job.attempt_count || 0);
  const maxAttempts = Number(job.max_attempts || 3);
  if (attemptCount >= maxAttempts) {
    return json({ error: 'MAX_ATTEMPTS_REACHED' }, 409);
  }

  const { data: documentRows, error: documentError } = await admin.database
    .from('documents')
    .select('*')
    .eq('id', job.document_id)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .limit(1);

  if (documentError) {
    return json(
      { error: 'DOCUMENT_LOOKUP_FAILED', message: documentError.message },
      500,
    );
  }

  const document = documentRows?.[0];
  if (!document) {
    return json({ error: 'DOCUMENT_NOT_FOUND' }, 404);
  }

  const extension = String(document.extension || '').toLowerCase();
  if (!['pdf', 'docx'].includes(extension)) {
    return json({ error: 'UNSUPPORTED_EXTENSION', extension }, 400);
  }

  if (Number(document.size_bytes || 0) > MAX_FILE_BYTES) {
    return json({ error: 'FILE_TOO_LARGE' }, 413);
  }

  const startedAt = new Date().toISOString();

  await admin.database
    .from('processing_jobs')
    .update({
      status: 'running',
      stage: 'Extraction du texte',
      progress: 15,
      attempt_count: attemptCount + 1,
      locked_at: startedAt,
      started_at: startedAt,
      finished_at: null,
      error_message: null,
    })
    .eq('id', jobId)
    .eq('owner_id', userId);

  await admin.database
    .from('documents')
    .update({
      status: 'extracting',
      progress: 35,
      current_stage: 'Extraction du texte',
      error_code: null,
      error_message: null,
    })
    .eq('id', document.id)
    .eq('owner_id', userId);

  try {
    const { data: blob, error: downloadError } = await admin.storage
      .from(document.bucket_name)
      .download(document.object_key);

    if (downloadError || !blob) {
      throw new Error(downloadError?.message || 'Unable to download source file.');
    }

    if (blob.size > MAX_FILE_BYTES) {
      throw new Error(`Downloaded file exceeds ${MAX_FILE_BYTES} bytes.`);
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());

    let extracted:
      | { pages: string[]; pageCount: number }
      | { text: string; pageCount: null };

    if (extension === 'pdf') {
      const pdf = await extractPdf(bytes);
      extracted = {
        pages: pdf.pages,
        pageCount: pdf.pageCount,
      };
    } else {
      extracted = {
        text: extractDocx(bytes),
        pageCount: null,
      };
    }

    const combinedText =
      'pages' in extracted
        ? extracted.pages.join('\n\n')
        : extracted.text;

    if (!combinedText.trim()) {
      throw new Error(
        extension === 'pdf'
          ? 'No extractable PDF text was found. Scanned PDFs require OCR.'
          : 'No extractable DOCX text was found.',
      );
    }

    const rows = makeChunkRows(
      document.id,
      userId,
      extension,
      'pages' in extracted
        ? { pages: extracted.pages }
        : { text: extracted.text },
    );

    if (!rows.length) {
      throw new Error('Text extraction succeeded but produced no chunks.');
    }

    await admin.database
      .from('documents')
      .update({
        status: 'chunking',
        progress: 70,
        current_stage: 'Création des passages',
      })
      .eq('id', document.id)
      .eq('owner_id', userId);

    await admin.database
      .from('processing_jobs')
      .update({
        stage: 'Création des passages',
        progress: 70,
      })
      .eq('id', jobId)
      .eq('owner_id', userId);

    const { error: deleteChunksError } = await admin.database
      .from('document_chunks')
      .delete()
      .eq('document_id', document.id)
      .eq('owner_id', userId);

    if (deleteChunksError) {
      throw new Error(
        deleteChunksError.message || 'Unable to clear previous document chunks.',
      );
    }

    await insertChunkBatches(admin, rows);

    const finishedAt = new Date().toISOString();

    const { error: documentReadyError } = await admin.database
      .from('documents')
      .update({
        status: 'ready',
        progress: 100,
        current_stage: 'Prêt',
        page_count: 'pages' in extracted ? extracted.pageCount : null,
        chunk_count: rows.length,
        error_code: null,
        error_message: null,
        metadata: {
          ...(document.metadata || {}),
          processed_by: 'process-document',
          processed_at: finishedAt,
          extractor:
            extension === 'pdf' ? 'unpdf@1.8.1' : 'docx-xml/fflate@0.8.2',
        },
      })
      .eq('id', document.id)
      .eq('owner_id', userId);

    if (documentReadyError) {
      throw new Error(
        documentReadyError.message || 'Unable to mark document as ready.',
      );
    }

    const { error: jobReadyError } = await admin.database
      .from('processing_jobs')
      .update({
        status: 'succeeded',
        stage: 'Terminé',
        progress: 100,
        finished_at: finishedAt,
        locked_at: null,
        error_message: null,
      })
      .eq('id', jobId)
      .eq('owner_id', userId);

    if (jobReadyError) {
      throw new Error(jobReadyError.message || 'Unable to finalize processing job.');
    }

    await admin.database.from('audit_logs').insert({
      actor_id: userId,
      action: 'document.processed',
      resource_type: 'document',
      resource_id: document.id,
      details: {
        job_id: jobId,
        extension,
        page_count: 'pages' in extracted ? extracted.pageCount : null,
        chunk_count: rows.length,
      },
    });

    return json({
      ok: true,
      jobId,
      documentId: document.id,
      status: 'ready',
      pageCount: 'pages' in extracted ? extracted.pageCount : null,
      chunkCount: rows.length,
    });
  } catch (error) {
    const message = safeMessage(error);
    const finishedAt = new Date().toISOString();

    await admin.database
      .from('processing_jobs')
      .update({
        status: 'failed',
        stage: 'Échec',
        finished_at: finishedAt,
        locked_at: null,
        error_message: message,
      })
      .eq('id', jobId)
      .eq('owner_id', userId);

    await admin.database
      .from('documents')
      .update({
        status: 'failed',
        current_stage: 'Échec du traitement',
        error_code: 'PROCESSING_FAILED',
        error_message: message,
      })
      .eq('id', document.id)
      .eq('owner_id', userId);

    await admin.database.from('audit_logs').insert({
      actor_id: userId,
      action: 'document.processing_failed',
      resource_type: 'document',
      resource_id: document.id,
      details: {
        job_id: jobId,
        extension,
        error: message,
      },
    });

    return json(
      {
        error: 'PROCESSING_FAILED',
        message,
        jobId,
        documentId: document.id,
      },
      422,
    );
  }
}
