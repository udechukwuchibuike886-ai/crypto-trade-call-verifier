# CallCred — Proof of Accuracy

A trade-call accuracy ledger. Log a crypto trade call before you know the outcome,
and CallCred automatically verifies it against real market data, then writes a
permanent record to Walrus Memory — so over time you can see which of your own
setups are actually reliable, not just which ones felt right.

## How it uses Walrus Memory and Tatum
- **Walrus Memory** (`@mysten-incubation/memwal`): every logged call and every
  verified verdict is written as a permanent memory on Sui Mainnet. The "Ask the
  ledger" feature uses semantic recall to search your own trading history in
  plain language.
- **Tatum**: the official `@tatumio/tatum` SDK fetches real market prices to
  judge whether a call won or lost.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your own `MEMWAL_PRIVATE_KEY`,
   `MEMWAL_ACCOUNT_ID` (from memory.walrus.xyz) and `TATUM_API_KEY`
   (from dashboard.tatum.io). **Never commit `.env`.**
3. `npm start`

## Built for
Walrus x Tatum "Total Recall" Hackathon — Markets & Sports Prediction track.
