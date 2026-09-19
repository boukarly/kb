# Vercel — checklist

- `APP_URL` correspond au domaine HTTPS de production.
- `INSFORGE_ADMIN_KEY` est server-only.
- `MCP_OWNER_ID` est le UUID InsForge du propriétaire.
- `MCP_ALLOWED_EMAIL` correspond au compte autorisé.
- `MCP_OAUTH_ISSUER` annonce un authorization server compatible MCP.
- `/.well-known/oauth-protected-resource` retourne JSON, jamais la SPA.
- `/api/mcp` retourne un challenge OAuth sur accès non authentifié.
- Les redirect URLs web sont configurées dans InsForge Auth.
- Les secrets anciennement commités ont été révoqués.
