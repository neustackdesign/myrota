# myrota

**Use what you own. Know what to use today. Keep the streak going.**

myrota turns the skincare products already on a person's shelf into a simple
seven-day rota, helps them follow it one AM/PM session at a time, and makes
accountability shareable without turning skincare into a social network.

```
add products → reveal 7-day rota → start streak → complete today → invite one friend
```

## Repository layout (consolidated monorepo)

Single repo, npm workspaces (`workspaces: ["apps/*"]`). Each app is a
self-contained Next.js 16 application and builds from its own root.

```
apps/web   Landing page + PWA. Proxies /api/* to the Worker via a build-time
           rewrite reading MYROTA_API_ORIGIN (next.config.ts). No server secrets.
apps/api   Cloudflare Worker backend (Next + Vinext, Vite, Drizzle, Better Auth,
           Turnstile). Owns all DB access behind authenticated, ownership-checked routes.
docs/      Architecture, gates, handoffs, and docs/CONSOLIDATION.md (this effort).
CLAUDE.md  Canonical engineering + product + safety contract. Read it first.
```

See [`docs/CONSOLIDATION.md`](docs/CONSOLIDATION.md) for how the two apps were
brought together, the backend-baseline decision, and the staging-isolation setup.

## Stack

- Next.js 16.3.8 · React 19.3 · TypeScript
- **Frontend** `apps/web`: static/SSR PWA shell, deployed to Vercel, `/api/*`
  proxied to the Worker.
- **Backend** `apps/api`: Cloudflare Workers (Vinext, beta) → Cloudflare **D1**
  (SQLite) via Drizzle. **Better Auth** anonymous sessions, HttpOnly cookies,
  Turnstile-defended auth endpoints.
- Pure, platform-neutral domain logic under each app's `lib/domain` for later
  reuse in native clients.

> Not Supabase, not Neon. myrota is Cloudflare-first and shares no database,
> auth, or storage with ApplyOS or Fleetpass.

## Develop

```bash
npm install            # once, at repo root (workspaces)
npm run build:web      # Next build of apps/web (landing + PWA)
npm run build:api      # Vinext/Cloudflare Worker build of apps/api
npm run typecheck      # both apps
npm run test:domain    # pure-domain suite (apps/api)
npm run test:backend   # server-logic suite (apps/api)
npm run deploy:staging # guarded staging Worker deploy (apps/api)
```

## Environments

| | Frontend | Worker | D1 |
|---|---|---|---|
| **Production** (frozen) | `myrota-eight.vercel.app` | `myrota` | `myrota` (`7992c70c…`) |
| **Staging** (isolated) | `myrota-staging-web.vercel.app` | `myrota-staging` | `myrota-staging` (`c003a749…`) |

Staging's `apps/web` build sets `MYROTA_API_ORIGIN=https://myrota-staging.neustackdesign.workers.dev`
so every `/api/*` call reaches the staging Worker and staging D1 — never production.
Staging uses the Cloudflare Turnstile **test** key (`1x00000000000000000000AA`),
so automated end-to-end testing needs no human challenge.
