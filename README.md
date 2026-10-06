# myrota

**Use what you own. Know what to use today. Keep the streak going.**

myrota is a lightweight skincare routine PWA. It turns the products already on a person's shelf into a simple seven-day rota, helps them follow the plan one AM/PM session at a time, and makes accountability shareable without turning skincare into a social network.

## MVP thesis

The first build tests one loop:

```
add products → reveal 7-day rota → start streak → complete today → invite one friend
```

The product is not a generic ingredient encyclopedia, shopping recommender, social feed, or clinical diagnosis tool.

## Core jobs

1. Can these products fit together?
2. When should I use what I already own?
3. What am I doing unnecessarily?
4. Can I actually stick to the routine?

## V1 surfaces

- `/` — proposition + build CTA
- `/build` — add products and build a rota
- `/routine` — Today + seven-day strip + streak
- `/mix` — two-active acquisition utility
- `/invite/[code]` — friend invitation landing path

See `docs/MVP.md`, `docs/ARCHITECTURE.md`, and `CLAUDE.md`.

## Stack

- Next.js 16.3.8
- React 19.3
- TypeScript
- PWA-first web shell
- Supabase target: anonymous auth + server persistence + RLS
- Vercel target deployment
- Domain logic isolated under `lib/domain` for later reuse in iOS/Android clients

## Local setup

```bash
npm install
npm run dev
```

The current first commit intentionally uses a browser persistence adapter so the product loop can run before cloud credentials are connected. The persistence boundary is isolated; Supabase replaces that adapter rather than rewriting product logic.
