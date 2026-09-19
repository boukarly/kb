const issuer = (process.env.MCP_OAUTH_ISSUER || '').replace(/\/+$/, '');

const configuredAppUrl = (process.env.APP_URL || '').replace(/\/+$/, '');

function publicOrigin(request: Request) {
  if (configuredAppUrl) return configuredAppUrl;

  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`.replace(/\/+$/, '');
  }

  return url.origin;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=300',
  Vary: 'Origin',
};

export function GET(request: Request) {
  if (!issuer) {
    return Response.json(
      { error: 'MCP_OAUTH_ISSUER is not configured.' },
      { status: 503, headers: corsHeaders },
    );
  }

  const origin = publicOrigin(request);

  return Response.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [issuer],
      scopes_supported: ['user:read'],
    },
    { headers: corsHeaders },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
