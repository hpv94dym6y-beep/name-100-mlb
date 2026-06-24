// Vercel serverless function: /api/verify?name=...
// Verifies whether a typed name belongs to a real MLB player using the
// public MLB Stats API (statsapi.mlb.com). No API key required.
//
// Strategy:
//   1. Normalize the input.
//   2. Check a small alias map for well-known nicknames the API can't match
//      ("Big Papi" -> "David Ortiz", "The Big Unit" -> "Randy Johnson", etc.).
//   3. Hit the MLB people-search endpoint. Accept if a confident match is found.
//   4. Return a canonical full name so the client can de-dupe repeats.

const ALIASES = {
  "babe": "Babe Ruth",
  "the babe": "Babe Ruth",
  "the bambino": "Babe Ruth",
  "the sultan of swat": "Babe Ruth",
  "say hey": "Willie Mays",
  "say hey kid": "Willie Mays",
  "the splendid splinter": "Ted Williams",
  "teddy ballgame": "Ted Williams",
  "the iron horse": "Lou Gehrig",
  "hammerin hank": "Hank Aaron",
  "hammering hank": "Hank Aaron",
  "the mick": "Mickey Mantle",
  "joltin joe": "Joe DiMaggio",
  "the yankee clipper": "Joe DiMaggio",
  "iron man": "Cal Ripken Jr.",
  "mr october": "Reggie Jackson",
  "tom terrific": "Tom Seaver",
  "lefty": "Steve Carlton",
  "the ryan express": "Nolan Ryan",
  "the rocket": "Roger Clemens",
  "the big unit": "Randy Johnson",
  "big unit": "Randy Johnson",
  "the big train": "Walter Johnson",
  "the georgia peach": "Ty Cobb",
  "stan the man": "Stan Musial",
  "the wizard": "Ozzie Smith",
  "the wizard of oz": "Ozzie Smith",
  "yaz": "Carl Yastrzemski",
  "moose": "Mike Mussina",
  "the sandman": "Mariano Rivera",
  "mo": "Mariano Rivera",
  "eck": "Dennis Eckersley",
  "pudge": "Ivan Rodriguez",
  "the kid": "Ken Griffey Jr.",
  "junior": "Ken Griffey Jr.",
  "a-rod": "Alex Rodriguez",
  "arod": "Alex Rodriguez",
  "big papi": "David Ortiz",
  "the big hurt": "Frank Thomas",
  "big hurt": "Frank Thomas",
  "the machine": "Albert Pujols",
  "mr cub": "Ernie Banks",
  "the rock": "Tim Raines",
  "doc": "Roy Halladay",
  "king felix": "Felix Hernandez",
  "godzilla": "Hideki Matsui",
  "polar bear": "Pete Alonso",
  "mookie": "Mookie Betts",
  "j-rod": "Julio Rodriguez",
  "jrod": "Julio Rodriguez",
  "vladdy": "Vladimir Guerrero Jr.",
  "vladdy jr": "Vladimir Guerrero Jr.",
  "goldy": "Paul Goldschmidt",
  "mad max": "Max Scherzer",
  "cutch": "Andrew McCutchen",
  "miggy": "Miguel Cabrera",
  "salvy": "Salvador Perez",
  "the martian": "Jasson Dominguez",
  "pops": "Willie Stargell",
  "charlie hustle": "Pete Rose",
  "the toddfather": "Todd Helton",
  "kung fu panda": "Pablo Sandoval",
  "the freak": "Tim Lincecum",
  "thor": "Noah Syndergaard",
  "the professor": "Greg Maddux",
};

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function mlbSearch(name) {
  // MLB Stats API people search. Returns players matching the query.
  const url =
    "https://statsapi.mlb.com/api/v1/people/search?names=" +
    encodeURIComponent(name) +
    "&sportIds=1"; // sportId 1 = MLB
  const resp = await fetch(url, { headers: { "User-Agent": "name-100-mlb" } });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.people || [];
}

export default async function handler(req, res) {
  // CORS — allow the static site (same origin on Vercel, but safe to set)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const raw = (req.query.name || "").toString();
  const key = normalize(raw);

  if (!key || key.length < 2) {
    return res.status(200).json({ valid: false, canonical: "" });
  }

  // 1. Alias fast-path (nicknames the API won't resolve)
  if (ALIASES[key]) {
    return res.status(200).json({ valid: true, canonical: ALIASES[key] });
  }

  try {
    // 2. Direct search
    let people = await mlbSearch(raw);

    // If the query was a single token (likely a last name), the API often
    // returns many people. Only accept single-token queries when there's
    // exactly one strong match, to avoid "Smith" matching a random player.
    const tokenCount = key.split(" ").length;

    if (people.length === 0) {
      return res.status(200).json({ valid: false, canonical: "" });
    }

    // Prefer an exact full-name match (normalized)
    let exact = people.find((p) => normalize(p.fullName) === key);
    if (exact) {
      return res
        .status(200)
        .json({ valid: true, canonical: exact.fullName });
    }

    // Match on last name + first name token presence
    if (tokenCount >= 2) {
      // Multi-token query: accept the top result if all query tokens appear
      const queryTokens = key.split(" ");
      const candidate = people.find((p) => {
        const fn = normalize(p.fullName);
        return queryTokens.every((t) => fn.includes(t));
      });
      if (candidate) {
        return res
          .status(200)
          .json({ valid: true, canonical: candidate.fullName });
      }
    } else {
      // Single token query (last name): only accept if it matches the last
      // name of the top result AND that result is reasonably unambiguous.
      const top = people[0];
      const lastName = normalize(top.lastName || top.fullName.split(" ").slice(-1)[0]);
      if (lastName === key) {
        return res
          .status(200)
          .json({ valid: true, canonical: top.fullName });
      }
    }

    return res.status(200).json({ valid: false, canonical: "" });
  } catch (e) {
    return res.status(200).json({ valid: false, canonical: "", error: "lookup_failed" });
  }
}
