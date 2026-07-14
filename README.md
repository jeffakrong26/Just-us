# Just Us

Private status dashboard, shared pets, daily connection question, secret missions,
and games (F1 race, code-cracking, disappearing snaps) for Jeff & Natali.

Live URL: **https://just-us-99w.pages.dev**

Runs on Cloudflare Pages (static React/Vite frontend) + Pages Functions (API) + D1
(shared data). Personal/per-device data (identity choice, Natali's race character)
lives in `localStorage` instead — there's no Claude account boundary anymore, so
the browser/device is the identity boundary.

## Stack

- Frontend: Vite + React + Tailwind v4, `lucide-react` icons — `src/App.jsx`
- API: Cloudflare Pages Functions — `functions/api/kv/[key].js` (get/set one key),
  `functions/api/kv/index.js` (batch read by prefix — built but not yet wired into
  the frontend; see Follow-ups below)
- Data: Cloudflare D1, database `just-us-db`, single `kv` table (key/value/updated_at)
- PIN gate: `0705`, hardcoded in `src/App.jsx` (`PIN_CODE`)
- Race's real-time sync: a standalone Cloudflare Worker + Durable Object,
  `race-room/` — see "The race-room worker" below. Everything else in the app
  goes through the Pages Functions API above; Race is the one exception.

## Redeploying after a change

```bash
cd ~/just-us
npm run deploy
```

That runs `vite build` then `wrangler pages deploy dist --project-name just-us`.
Takes effect at the stable URL (https://just-us-99w.pages.dev) within a few
seconds to a minute of the deploy finishing — the very first request right after
a deploy can occasionally 404/522 while it propagates; retry once.

If you only changed a Function (`functions/api/...`) and not the frontend, you
still need to run the full `npm run deploy` — Pages bundles the Functions
alongside the static build each time.

## The race-room worker

Race needs both players' vehicles to stay in sync in real time (position
updates, a synchronized start light, hairpin resets), which polling D1 was too
laggy for. That piece lives in its own Cloudflare Worker + Durable Object,
**separate from the Pages project** — Cloudflare Pages can bind to a Durable
Object but can't host the class itself, so it has to be a standalone Worker.

- Code: `race-room/src/index.js` (the `RaceRoom` Durable Object — a relay/
  coordinator only; each client simulates its own vehicle locally and just
  reports state for the room to broadcast).
- Config: `race-room/wrangler.jsonc`.
- Live at: **wss://just-us-race-room.jeffakrong26.workers.dev/ws** (the
  frontend connects here directly — `src/useRaceRoom.js` — there's no binding
  between the two Cloudflare projects, they're just two things one browser
  tab talks to).
- Redeploy after changing it:
  ```bash
  cd ~/just-us
  npx wrangler deploy --config race-room/wrangler.jsonc
  ```
- There's always exactly one room (`idFromName("jeff-natali")`) — no
  discovery/lobby needed since it's always the same two people. `who=jeff` or
  `who=natali` on the connection URL is trusted as-is, same security posture
  as the KV API (private two-person toy, PIN gate is the only real barrier).

## Inspecting / resetting D1 data

The whole app's shared state lives in one table, `kv`, in the `just-us-db`
database.

```bash
cd ~/just-us

# See everything currently stored
npx wrangler d1 execute just-us-db --remote --command "SELECT key, updated_at FROM kv ORDER BY updated_at DESC"

# See one key's value
npx wrangler d1 execute just-us-db --remote --command "SELECT value FROM kv WHERE key = 'status:jeff'"

# Wipe a single key (e.g. reset one game)
npx wrangler d1 execute just-us-db --remote --command "DELETE FROM kv WHERE key = 'mastermind'"

# Wipe everything (use before handing this to Natali for real, to clear test data)
npx wrangler d1 execute just-us-db --remote --command "DELETE FROM kv"
```

Omit `--remote` to hit a local sandbox copy instead of the real database (used
by `wrangler pages dev` / local testing only — has nothing to do with the live
site).

Personal data (`identity`, Natali's `race-character`) is in each browser's
`localStorage`, not D1 — clearing it there resets "who am I" on that device,
which is expected. There's no server-side way to reset someone else's device.

## Project layout

```
just-us/
  src/App.jsx              tabs, status/pet/question/missions, theming, hug button
  src/theme.jsx             shared design tokens + SectionCard (imported by App.jsx and Race.jsx)
  src/Race.jsx              the race game: picker, canvas gameplay, results
  src/raceTracks.js         5 fixed track layouts + rounded-polygon path geometry
  src/useRaceRoom.js        WebSocket client for the race-room Durable Object
  functions/api/kv/
    [key].js                GET/PUT one key
    index.js                GET ?prefix= for batch reads
  schema.sql                D1 schema (already applied — kept for reference/rebuilds)
  wrangler.jsonc             Pages project config + D1 binding (DB -> just-us-db)
  race-room/                standalone Worker + Durable Object for Race's real-time sync
    src/index.js             the RaceRoom Durable Object
    wrangler.jsonc            its own config — deployed separately, see above
```

## Follow-ups (not done, flagged rather than assumed)

- **Shared-secret header on `/api/kv/*`.** Right now the API has no auth beyond
  the app's PIN gate — anyone who finds the URL and pokes at `/api/kv/status:jeff`
  directly can read/write it. Adding a static token baked into the frontend build
  and checked in the Function would close that off. Didn't do this by default
  since it adds deploy complexity (the token has to live in both the Pages build
  env and the Function's env) and this is a private two-person toy, not a
  security-sensitive app — say the word if you want it added.
- **Wire more of the frontend to the batch `?prefix=` endpoint.** It exists
  (`functions/api/kv/index.js`) and is already used by presence (`hug:`/
  `presence:` prefixes in `App.jsx`) — most other reads (`safeGet`/`safeSet`)
  still do one fetch per key. The pet tab's feed-status check is the main
  remaining place that would benefit (it currently makes several separate
  round trips per check). Race no longer polls D1 at all — it went to a
  Durable Object over WebSocket instead, see "The race-room worker" above.

## Wrangler quick reference

```bash
npx wrangler pages deployment list --project-name just-us   # deployment history
npx wrangler pages project list                              # confirm it's still there
npx wrangler d1 info just-us-db                               # DB size/stats
npx wrangler tail                                              # won't work for Pages Functions the same way Workers do — use the Cloudflare dashboard's Functions logs instead
```
