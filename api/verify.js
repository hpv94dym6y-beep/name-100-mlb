// /api/verify?name=...
// Verifies whether a typed name is a real MLB player from the live-ball era
// (career ending 1920 or later), using a prebuilt players.json generated from
// the Chadwick Bureau register.
//
// players.json is produced once by build/build_players.py (run on a computer)
// and committed to the repo at api/players.json. The function loads it once
// into memory; every lookup after that is instant.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ALIASES = {
  "babe": "Babe Ruth", "the babe": "Babe Ruth", "the bambino": "Babe Ruth",
  "say hey": "Willie Mays", "the splendid splinter": "Ted Williams",
  "teddy ballgame": "Ted Williams", "the iron horse": "Lou Gehrig",
  "hammerin hank": "Hank Aaron", "the mick": "Mickey Mantle",
  "joltin joe": "Joe DiMaggio", "the yankee clipper": "Joe DiMaggio",
  "iron man": "Cal Ripken", "mr october": "Reggie Jackson",
  "tom terrific": "Tom Seaver", "the ryan express": "Nolan Ryan",
  "the rocket": "Roger Clemens", "the big unit": "Randy Johnson",
  "big unit": "Randy Johnson", "the georgia peach": "Ty Cobb",
  "stan the man": "Stan Musial", "the wizard": "Ozzie Smith",
  "yaz": "Carl Yastrzemski", "the sandman": "Mariano Rivera",
  "pudge": "Ivan Rodriguez", "the kid": "Ken Griffey",
  "a-rod": "Alex Rodriguez", "arod": "Alex Rodriguez",
  "big papi": "David Ortiz", "the big hurt": "Frank Thomas",
  "big hurt": "Frank Thomas", "the machine": "Albert Pujols",
  "mr cub": "Ernie Banks", "the rock": "Tim Raines",
  "king felix": "Felix Hernandez", "godzilla": "Hideki Matsui",
  "polar bear": "Pete Alonso", "mookie": "Mookie Betts",
  "j-rod": "Julio Rodriguez", "jrod": "Julio Rodriguez",
  "goldy": "Paul Goldschmidt", "mad max": "Max Scherzer",
  "cutch": "Andrew McCutchen", "miggy": "Miguel Cabrera",
  "the freak": "Tim Lincecum", "kung fu panda": "Pablo Sandoval",
  "charlie hustle": "Pete Rose",
};

let DATA = null;

function loadData() {
  if (DATA) return DATA;
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(__dirname, "players.json"), "utf-8");
    DATA = JSON.parse(raw);
  } catch (e) {
    DATA = { full: {}, last: {} };
  }
  return DATA;
}

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const raw = (req.query.name || "").toString();
  const key = normalize(raw);
  if (!key || key.length < 2) {
    return res.status(200).json({ valid: false, canonical: "" });
  }

  if (ALIASES[key]) {
    return res.status(200).json({ valid: true, canonical: ALIASES[key] });
  }

  const data = loadData();

  if (data.full && data.full[key]) {
    return res.status(200).json({ valid: true, canonical: data.full[key] });
  }

  if (key.split(" ").length === 1 && data.last && data.last[key]) {
    return res.status(200).json({ valid: true, canonical: data.last[key] });
  }

  return res.status(200).json({ valid: false, canonical: "" });
}
