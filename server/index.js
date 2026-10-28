require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const crypto = require('crypto');

const store = require('./store');
const memwal = require('./memwal');
const tatum = require('./tatum');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const VERIFY_AFTER_MS = (Number(process.env.VERIFY_AFTER_MINUTES) || 60) * 60 * 1000;

// --- Log a new call ---
app.post('/api/calls', async (req, res) => {
  try {
    const { asset, direction, setupType, conviction, entryPrice } = req.body;
    if (!asset || !direction || !setupType || !entryPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const call = {
      id: crypto.randomUUID(),
      asset: asset.toUpperCase(),
      direction, // 'long' | 'short'
      setupType,
      conviction: conviction || 'medium',
      entryPrice: Number(entryPrice),
      loggedAt: new Date().toISOString(),
      status: 'pending',
    };

    store.addCall(call);

    // Permanent record, written immediately — this is a real Walrus Memory write.
    await memwal.rememberCallLogged(call);

    res.json(call);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- List all calls (from the fast local index) ---
app.get('/api/calls', (req, res) => {
  res.json(store.readAll());
});

// --- Stats by setup type ---
app.get('/api/stats', (req, res) => {
  res.json(store.getStats());
});

// --- Manually trigger verification of all due pending calls ---
app.post('/api/verify-pending', async (req, res) => {
  try {
    const verified = await verifyDueCalls();
    res.json({ verified: verified.length, calls: verified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Semantic search over everything CallCred has ever remembered ---
app.get('/api/ask', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing ?q=' });
    const results = await memwal.askLedger(query);
    res.json({ query, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const walrusHealth = await memwal.health();
    res.json({ ok: true, walrus: walrusHealth });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Core verification logic: for every pending call whose window has
// elapsed, fetch the real price via Tatum, judge the outcome, update the
// local store, and write a permanent verdict memory to Walrus. ---
async function verifyDueCalls() {
  const pending = store.getPending();
  const now = Date.now();
  const due = pending.filter(
    (c) => now - new Date(c.loggedAt).getTime() >= VERIFY_AFTER_MS
  );

  const results = [];
  for (const call of due) {
    try {
      const outcomePrice = await tatum.getCurrentPrice(call.asset);
      const status = tatum.judgeOutcome(call, outcomePrice);
      const updated = store.updateCall(call.id, {
        status,
        outcomePrice,
        verifiedAt: new Date().toISOString(),
      });
      await memwal.rememberVerdict(updated);
      results.push(updated);
    } catch (err) {
      console.error(`Failed to verify call ${call.id}:`, err.message);
    }
  }
  return results;
}

// Check for due calls every 5 minutes, automatically.
cron.schedule('*/5 * * * *', () => {
  verifyDueCalls().catch((err) => console.error('Scheduled verify failed:', err));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CallCred running on port ${PORT}`));
