// Vercel serverless function: /api/leaderboard
//   GET  -> returns { winners: [...], best_attempts: [...], plays: N }
//   POST -> body { name, secs, count } records a result
//
// Persistence uses Vercel KV (Upstash Redis) if configured via the
// KV_REST_API_URL and KV_REST_API_TOKEN environment variables.
// If those aren't set, it falls back to in-memory (resets on cold start) so
// the game still runs — you just won't get a durable leaderboard until KV is
// connected. See the README for one-click KV setup.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = "name100mlb:board";

// In-memory fallback (per serverless instance)
let memBoard = { winners: [], best_attempts: [], plays: 0 };

async function kvGet() {
  if (!KV_URL || !KV_TOKEN) return null;
  const r = await fetch(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.result) return null;
  try {
    return JSON.parse(data.result);
  } catch {
    return null;
  }
}

async function kvSet(board) {
  if (!KV_URL || !KV_TOKEN) return;
  await fetch(`${KV_URL}/set/${KEY}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(board)),
  });
}

async function loadBoard() {
  const kv = await kvGet();
  if (kv) return kv;
  return memBoard;
}

async function saveBoard(board) {
  memBoard = board;
  await kvSet(board);
}

function clean(s) {
  return (s || "Anonymous").toString().slice(0, 24).replace(/[<>]/g, "");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const board = await loadBoard();
    return res.status(200).json(board);
  }

  // Increment play count: POST /api/leaderboard?action=play
  if (req.method === "POST" && req.query.action === "play") {
    const board = await loadBoard();
    board.plays = (board.plays || 0) + 1;
    await saveBoard(board);
    return res.status(200).json({ plays: board.plays });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const name = clean(body.name);
    const secs = Math.max(0, parseInt(body.secs, 10) || 0);
    const count = Math.max(0, Math.min(100, parseInt(body.count, 10) || 0));
    const date = new Date().toISOString().slice(0, 10);

    const board = await loadBoard();
    board.winners = board.winners || [];
    board.best_attempts = board.best_attempts || [];
    board.plays = (board.plays || 0);

    const entry = { name, secs, count, date };
    if (count === 100) {
      board.winners.push(entry);
      board.winners.sort((a, b) => a.secs - b.secs);
      board.winners = board.winners.slice(0, 50);
    } else {
      board.best_attempts.push(entry);
      board.best_attempts.sort((a, b) => b.count - a.count || a.secs - b.secs);
      board.best_attempts = board.best_attempts.slice(0, 50);
    }

    await saveBoard(board);
    return res.status(200).json(board);
  }

  return res.status(405).json({ error: "method_not_allowed" });
}
