# Environment Configuration Guide

## Overview
This KB project uses InsForge as the backend platform with Vercel for deployment. Proper environment variable configuration is critical for the application to function.

## InsForge Details
- **API Base URL:** `https://6gjv88f7.eu-central.insforge.app`
- **API Key:** `ik_e0a7fcf6f91b2d54c2d9aaa0467d683c`
- **MCP Server URL:** (Will be provided after setup)

## Vercel Environment Variables (Required)

### Currently Configured ✅
These variables are already set in your Vercel project:
```
MCP_OWNER_ID          → Set (Production & Preview)
MCP_API_KEY           → Set (Production & Preview)
INSFORGE_BASE_URL     → Set (Production & Preview)
INSFORGE_ANON_KEY     → Set (Production & Preview)
INSFORGE_ADMIN_KEY    → Set (Production & Preview)
APP_URL               → Set (Production & Preview)
```

### Still Needed ⚠️
Add these variables to Vercel project settings:

| Variable | Value | Environment |
|----------|-------|-------------|
| `INSFORGE_AUTH_URL` | `https://kb-liard-sigma.vercel.app/auth/callback` | Production & Preview |
| `INSFORGE_API_KEY` | `ik_e0a7fcf6f91b2d54c2d9aaa0467d683c` | Production & Preview |

### Optional But Recommended
```
JWT_SECRET        → Generate secure random value
DATABASE_URL      → If using separate PostgreSQL
VERCEL_ENV        → Set to "production" automatically
```

## InsForge Backend Configuration

Your InsForge instance needs these environment variables configured:

### Required Variables
```
# InsForge API Access
INSFORGE_API_KEY=ik_e0a7fcf6f91b2d54c2d9aaa0467d683c
INSFORGE_API_BASE_URL=https://6gjv88f7.eu-central.insforge.app

# MCP Authentication
MCP_OWNER_ID=<same_as_vercel>
MCP_API_KEY=<same_as_vercel>

# Application URL (for CORS, redirects, etc.)
APP_URL=https://kb-liard-sigma.vercel.app

# OAuth/Authorization
INSFORGE_AUTH_URL=https://kb-liard-sigma.vercel.app/auth/callback
INSFORGE_AUTH_PROVIDER=insforge  # or your provider
```

### Security Variables
```
# JWT Configuration
JWT_SECRET=<generate_32_char_random_string>
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=https://kb-liard-sigma.vercel.app,http://localhost:5173
```

### Database (if using PostgreSQL)
```
DATABASE_URL=postgresql://user:password@host:5432/kb_prod
DATABASE_POOL_SIZE=20
DATABASE_IDLE_TIMEOUT=30000
```

## How to Configure

### Vercel
1. Go to Vercel Dashboard → kb project
2. Settings → Environment Variables
3. Add each variable for "Production" and "Preview"
4. Redeploy to apply changes

### InsForge
1. Access your InsForge instance administration panel
2. Settings → Environment Variables
3. Add the variables listed above
4. Restart the InsForge service

## Setup Verification

Run these checks to verify everything is connected:

```bash
# Test InsForge connectivity
curl -H "Authorization: Bearer ik_e0a7fcf6f91b2d54c2d9aaa0467d683c" \
  https://6gjv88f7.eu-central.insforge.app/health

# Test Vercel deployment
curl https://kb-q5sg9eify-mansourboukarly-7083s-projects.vercel.app/health

# Test MCP server
npm run test:mcp
```

## MCP Server Setup

The InsForge MCP is configured via:
```bash
npx @insforge/install --client claude-code \
  --env API_KEY=ik_e0a7fcf6f91b2d54c2d9aaa0467d683c \
  --env API_BASE_URL=https://6gjv88f7.eu-central.insforge.app
```

## Troubleshooting

### "Unauthorized" errors
- Check that `MCP_API_KEY` matches between Vercel and InsForge
- Verify `INSFORGE_API_KEY` is correct
- Check API key hasn't expired

### CORS errors
- Add Vercel URL to `CORS_ORIGINS` on InsForge
- Verify `APP_URL` is set correctly

### Auth callback failures
- Ensure `INSFORGE_AUTH_URL` is accessible from the browser
- Check that InsForge OAuth provider settings include this URL as authorized

## Last Updated
July 27, 2026
