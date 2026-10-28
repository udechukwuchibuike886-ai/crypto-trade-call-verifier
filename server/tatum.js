// Tatum integration — used to verify a logged call against the real market
// price once the verification window has passed. Uses the official
// @tatumio/tatum SDK (tatum.rates.getCurrentRate), not a guessed REST call.

const { TatumSDK, Network } = require('@tatumio/tatum');

// Map our simple asset tickers to the Tatum network they live on.
const NETWORK_MAP = {
  BTC: Network.BITCOIN,
  ETH: Network.ETHEREUM,
  SOL: Network.SOLANA,
  MATIC: Network.POLYGON,
};

async function getCurrentPrice(asset) {
  const network = NETWORK_MAP[asset.toUpperCase()];
  if (!network) throw new Error(`Unsupported asset: ${asset}`);

  const tatum = await TatumSDK.init({
    network,
    apiKey: { v4: process.env.TATUM_API_KEY },
  });

  try {
    const res = await tatum.rates.getCurrentRate(asset.toUpperCase(), 'USD');
    return Number(res?.data?.value ?? res?.data);
  } finally {
    await tatum.destroy();
  }
}

// Decides WIN or LOSS for a call given its direction and the real outcome price.
function judgeOutcome(call, outcomePrice) {
  const movedUp = outcomePrice > call.entryPrice;
  const won = call.direction === 'long' ? movedUp : !movedUp;
  return won ? 'win' : 'loss';
}

module.exports = { getCurrentPrice, judgeOutcome };
