// Walrus Memory integration — this is the permanent, tamper-evident record
// of every trade call CallCred logs. Uses the real @mysten-incubation/memwal
// SDK (app-managed path, no Para wallet needed — see memory.walrus.xyz docs).

const { MemWal } = require('@mysten-incubation/memwal');

let client = null;

function getClient() {
  if (client) return client;

  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;

  if (!key || !accountId) {
    throw new Error(
      'Missing MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID. ' +
      'Create an account + delegate key at https://memory.walrus.xyz and set them in .env'
    );
  }

  client = MemWal.create({
    key,
    accountId,
    serverUrl: process.env.MEMWAL_RELAYER_URL || 'https://relayer.memory.walrus.xyz',
    namespace: process.env.MEMWAL_NAMESPACE || 'callcred',
  });

  return client;
}

// Writes one permanent memory describing a logged call.
async function rememberCallLogged(call) {
  const text =
    `Logged a ${call.direction} call on ${call.asset} using the "${call.setupType}" setup, ` +
    `${call.conviction} conviction, entry price $${call.entryPrice}, logged at ${call.loggedAt}.`;
  return getClient().rememberAndWait(text);
}

// Writes one permanent memory recording the verified outcome.
async function rememberVerdict(call) {
  const text =
    `VERDICT for ${call.asset} ${call.direction} call (${call.setupType}, logged ${call.loggedAt}): ` +
    `${call.status.toUpperCase()}. Entry $${call.entryPrice}, outcome price $${call.outcomePrice}, ` +
    `verified at ${call.verifiedAt}.`;
  return getClient().rememberAndWait(text);
}

// Semantic search over everything CallCred has ever remembered — this powers
// the "Ask the ledger" feature in the UI.
async function askLedger(query) {
  const { results } = await getClient().recall({ query, limit: 8 });
  return results.map((r) => r.text);
}

async function health() {
  return getClient().health();
}

module.exports = { rememberCallLogged, rememberVerdict, askLedger, health };
