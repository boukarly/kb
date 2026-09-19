# Authentification MCP — ChatGPT / Claude

Le serveur `/api/mcp` est une OAuth Protected Resource.

## Ce que le projet fournit

- challenge `WWW-Authenticate` via `withMcpAuth`;
- metadata RFC 9728 sur `/.well-known/oauth-protected-resource`;
- scope lecture `user:read`;
- validation du bearer token via un endpoint userinfo;
- allowlist de l'email autorisé;
- mapping final vers un `MCP_OWNER_ID` InsForge unique.

## InsForge OAuth Server

Exemple correspondant aux endpoints documentés actuellement par InsForge :

```env
MCP_OAUTH_ISSUER="https://api.insforge.dev"
MCP_OAUTH_USERINFO_URL="https://api.insforge.dev/auth/v1/profile"
```

Le compte retourné par `/auth/v1/profile` doit avoir l'email défini dans
`MCP_ALLOWED_EMAIL`.

Le client OAuth utilisé par ChatGPT/Claude doit être accepté par l'authorization
server. Selon le client et sa configuration, cela passe par CIMD, DCR ou un client
pré-enregistré avec les redirect URIs exactes.

Si l'authorization server ne propose pas le mécanisme de client attendu par ton
connecteur, l'auth automatique échouera même si `/api/mcp` est correctement protégé.
Dans ce cas, configure un issuer MCP-compatible ou fais enregistrer le client auprès
du fournisseur OAuth.

## Tests

1. `GET /.well-known/oauth-protected-resource` doit renvoyer `resource`,
   `authorization_servers` et `scopes_supported`.
2. `POST /api/mcp` sans Authorization doit renvoyer 401.
3. Le `WWW-Authenticate` doit contenir `resource_metadata=`.
4. Un bearer token valide d'un autre email doit être refusé.
5. Un token valide de `MCP_ALLOWED_EMAIL` doit accéder uniquement aux lignes du
   `MCP_OWNER_ID`.


## Limite à connaître

Le code de ce dépôt joue le rôle de **resource server MCP**. Il publie la metadata
RFC 9728, challenge les requêtes sans token et valide le token reçu.

Il ne fournit pas lui-même un Authorization Server. La documentation publique
InsForge décrit `https://api.insforge.dev` avec Authorization Code + PKCE et demande
d'enregistrer l'application pour recevoir un `client_id` et un `client_secret`.

ChatGPT/Claude doivent donc disposer d'un mécanisme client compatible avec cet
Authorization Server (client pré-enregistré, CIMD ou DCR selon ce qu'InsForge active
pour ton intégration). Si la découverte/enregistrement client échoue, le problème
est alors côté Authorization Server / enregistrement OAuth, pas dans `/api/mcp`.

Important : les tokens génériques InsForge documentés ont une audience InsForge.
Pour une conformité MCP stricte, le serveur d'autorisation utilisé doit accepter le
paramètre `resource` du client MCP et émettre/valider un token destiné à la ressource
MCP. Vérifie ce point dans la configuration InsForge prévue pour ton intégration.
