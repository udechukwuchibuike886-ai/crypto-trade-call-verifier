// Local structured index of every call.
// WHY THIS EXISTS: Walrus Memory's recall() is semantic search, not a precise
// "give me all 10 rows in order" query. For the ledger table and win-rate
// stats we need exact, deterministic data — so every call is ALSO written
// here. Walrus Memory stays the permanent, tamper-evident record (and powers
// the semantic "Ask the ledger" search); this file is just a fast local index
// of the same facts, never the other way around.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'calls.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function readAll() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeAll(calls) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(calls, null, 2));
}

function addCall(call) {
  const calls = readAll();
  calls.unshift(call); // newest first
  writeAll(calls);
  return call;
}

function updateCall(id, patch) {
  const calls = readAll();
  const idx = calls.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  calls[idx] = { ...calls[idx], ...patch };
  writeAll(calls);
  return calls[idx];
}

function getPending() {
  return readAll().filter((c) => c.status === 'pending');
}

function getStats() {
  const calls = readAll().filter((c) => c.status !== 'pending');
  const bySetup = {};
  for (const c of calls) {
    if (!bySetup[c.setupType]) bySetup[c.setupType] = { wins: 0, total: 0 };
    bySetup[c.setupType].total += 1;
    if (c.status === 'win') bySetup[c.setupType].wins += 1;
  }
  const totalVerified = calls.length;
  const totalWins = calls.filter((c) => c.status === 'win').length;
  return {
    overallWinRate: totalVerified ? Math.round((totalWins / totalVerified) * 100) : null,
    totalVerified,
    bySetup,
  };
}

module.exports = { readAll, addCall, updateCall, getPending, getStats };
