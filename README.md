# Name 100 MLB Players ⚾

A timed trivia game: name 100 real MLB players against the clock. Player names are
verified live against the **official MLB Stats API** (`statsapi.mlb.com`). Anyone with
the link can play — no account, no login.

## What's in here

```
/public/index.html      The game (static frontend)
/api/verify.js          Serverless: checks a typed name against the MLB API
/api/leaderboard.js     Serverless: stores leaderboard + play count
/vercel.json            Vercel config
/package.json
```

## Deploy to Vercel (5 minutes)

### Option A — drag and drop (no command line)
1. Go to https://vercel.com and sign up (free, GitHub login works).
2. Put this whole folder into a GitHub repo (or use Vercel's "deploy from folder").
3. Vercel auto-detects it. Click **Deploy**.
4. You get a public URL like `name-100-mlb.vercel.app`. Done.

### Option B — Vercel CLI
```bash
npm i -g vercel
cd name-100-mlb
vercel        # follow prompts; pick defaults
vercel --prod # promote to your public URL
```

## Turn on the persistent leaderboard (recommended)

Out of the box the leaderboard works but resets whenever the serverless function
goes cold (every few minutes of inactivity). To make it permanent, connect free
storage — takes 2 minutes:

1. In your Vercel project dashboard, go to the **Storage** tab.
2. Click **Create** → choose **KV** (or **Upstash Redis**) → follow the prompts.
3. Vercel automatically adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   environment variables to your project.
4. Redeploy (Vercel usually does this automatically). The leaderboard is now durable.

No code changes needed — `api/leaderboard.js` reads those env vars automatically
and falls back to in-memory if they're absent.

## A few honest notes on the MLB API

- The MLB Stats API has **no official "is this a player?" endpoint**. This app uses
  its name-search endpoint plus a matching layer, so verification is good but not
  perfect.
- **Nicknames**: handled via an alias map in `api/verify.js` (Big Papi → David Ortiz,
  The Big Unit → Randy Johnson, etc.). Add your own there as needed.
- **Accents**: input is accent-stripped, so "Pedro Martinez" and "Pedro Martínez"
  both work.
- **Single last names** (e.g. just "Smith") are only accepted when they map cleanly
  to one player, to avoid false positives. Full names always work best.
- A built-in seed list of ~90 stars resolves instantly without an API call, which
  keeps the game fast and reduces load on the MLB endpoint.

If you find legitimate players being rejected, the fix is almost always one of:
adding them to the alias map, or telling players to type the full name.

## Customizing

- **Player aliases / nicknames**: edit `ALIASES` in `api/verify.js`.
- **Instant-accept seed list**: edit `SEED` in `public/index.html`.
- **Target count** (currently 100): search for `100` in `index.html`.
- **Colors / fonts**: the `:root` CSS variables at the top of `index.html`.
