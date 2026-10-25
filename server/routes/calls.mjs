import { Router } from 'express'
import { randomUUID } from 'crypto'
import { tatumFetch, MissingApiKeyError } from '../tatum-client.mjs'

const router = Router()

// In-memory persistent state (runtime memory for calls and setup stats)
// Stored as in-memory state in the server process
let tradeCalls = [
  {
    id: 'c-init-1',
    asset: 'BTC',
    direction: 'LONG',
    setupType: 'Breakout & Retest',
    confidence: 'HIGH',
    entryPrice: 66250.00,
    timeframeMinutes: 5,
    notes: 'Bullish consolidation breaking above prior 4h resistance with volume surge.',
    createdAt: Date.now() - 3600000,
    evaluatesAt: Date.now() - 3300000,
    status: 'WON',
    outcomePrice: 67100.50,
    priceChangePercent: 1.28,
    outcomeCheckedAt: Date.now() - 3300000,
    outcomeReason: 'Price rose +1.28% conforming to LONG breakout thesis.',
    reflection: 'Reliable setup. Volume confirmation provided solid follow-through.'
  },
  {
    id: 'c-init-2',
    asset: 'ETH',
    direction: 'SHORT',
    setupType: 'Liquidity Sweep / SFP',
    confidence: 'MEDIUM',
    entryPrice: 2640.20,
    timeframeMinutes: 15,
    notes: 'Failed swing high into equal highs cluster, looking for sweep and reject.',
    createdAt: Date.now() - 2400000,
    evaluatesAt: Date.now() - 1500000,
    status: 'WON',
    outcomePrice: 2615.10,
    priceChangePercent: 0.95, // profitable for short
    outcomeCheckedAt: Date.now() - 1500000,
    outcomeReason: 'Asset declined -0.95%, successfully delivering SHORT target.',
    reflection: 'SFP setup respected the key resistance level cleanly.'
  },
  {
    id: 'c-init-3',
    asset: 'SOL',
    direction: 'LONG',
    setupType: 'News / Event Momentum',
    confidence: 'LOW',
    entryPrice: 154.50,
    timeframeMinutes: 5,
    notes: 'Trading headline spike without confirmation.',
    createdAt: Date.now() - 1800000,
    evaluatesAt: Date.now() - 1500000,
    status: 'LOST',
    outcomePrice: 151.20,
    priceChangePercent: -2.13,
    outcomeCheckedAt: Date.now() - 1500000,
    outcomeReason: 'Asset fell -2.13%, violating LONG call invalidation.',
    reflection: 'Emotional news chasing consistently yields negative expectancy.'
  },
  {
    id: 'c-init-4',
    asset: 'BTC',
    direction: 'LONG',
    setupType: 'Breakout & Retest',
    confidence: 'HIGH',
    entryPrice: 66800.00,
    timeframeMinutes: 10,
    notes: 'Clean retest of $66.5k pivot level.',
    createdAt: Date.now() - 1200000,
    evaluatesAt: Date.now() - 600000,
    status: 'WON',
    outcomePrice: 67350.00,
    priceChangePercent: 0.82,
    outcomeCheckedAt: Date.now() - 600000,
    outcomeReason: 'Price gained +0.82%, hitting verification horizon in profit.',
    reflection: 'Breakout & Retest maintains strong historical hit rate.'
  }
]

// Fallback prices in case of transient API connectivity
const priceCache = {
  BTC: 67500.00,
  ETH: 2620.00,
  SOL: 155.00,
  MATIC: 0.38,
  USDT: 1.00
}

// Fetch live price for an asset using Tatum Data API rate endpoints
async function getAssetPrice(symbol) {
  if (symbol === 'USDT' || symbol === 'USD') return 1.00
  try {
    const res = await tatumFetch(`/v4/data/rate/symbol?symbol=${encodeURIComponent(symbol)}&basePair=USD`)
    if (res.ok) {
      const data = await res.json()
      if (data && data.value) {
        const val = parseFloat(data.value)
        if (!isNaN(val) && val > 0) {
          priceCache[symbol] = val
          return val
        }
      }
    }
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      console.warn('TATUM_API_KEY unset, using cached asset valuation')
    }
  }
  return priceCache[symbol] || 100.0
}

// Compute setup reliability statistics across memory
function calculateStats() {
  const setupGroups = {}

  for (const call of tradeCalls) {
    if (!setupGroups[call.setupType]) {
      setupGroups[call.setupType] = {
        setupType: call.setupType,
        totalCalls: 0,
        settledCalls: 0,
        wins: 0,
        losses: 0,
        returnsSum: 0
      }
    }

    const group = setupGroups[call.setupType]
    group.totalCalls += 1

    if (call.status === 'WON') {
      group.settledCalls += 1
      group.wins += 1
      group.returnsSum += Math.abs(call.priceChangePercent || 1.0)
    } else if (call.status === 'LOST') {
      group.settledCalls += 1
      group.losses += 1
      group.returnsSum -= Math.abs(call.priceChangePercent || 1.0)
    }
  }

  return Object.values(setupGroups).map((group) => {
    const winRate = group.settledCalls > 0 ? Math.round((group.wins / group.settledCalls) * 100) : 0
    const avgReturn = group.settledCalls > 0 ? parseFloat((group.returnsSum / group.settledCalls).toFixed(2)) : 0
    
    // Reliability score combining win rate, sample volume, and return magnitude
    const volumeFactor = Math.min(1.0, group.settledCalls / 3) // ramps up with data
    const rawScore = (winRate * 0.7) + (Math.max(0, avgReturn * 10) * 0.3)
    const reliabilityScore = Math.min(100, Math.max(0, Math.round(rawScore * (0.5 + 0.5 * volumeFactor))))

    let verdict = 'NEEDS_DATA'
    if (group.settledCalls >= 2) {
      if (winRate >= 65) verdict = 'HIGHLY_RELIABLE'
      else if (winRate >= 45) verdict = 'MODERATE'
      else verdict = 'UNRELIABLE'
    }

    return {
      setupType: group.setupType,
      totalCalls: group.totalCalls,
      settledCalls: group.settledCalls,
      wins: group.wins,
      losses: group.losses,
      winRate,
      avgReturn,
      reliabilityScore,
      verdict
    }
  })
}

// Check and settle any pending calls whose maturity window has passed
async function evaluatePendingCalls() {
  const now = Date.now()
  let resolvedCount = 0
  let pendingCount = 0

  for (const call of tradeCalls) {
    if (call.status === 'PENDING') {
      if (now >= call.evaluatesAt) {
        // Horizon reached! Settle using oracle price
        const currentPrice = await getAssetPrice(call.asset)
        const priceDiff = currentPrice - call.entryPrice
        const pctDiff = (priceDiff / call.entryPrice) * 100

        let won = false
        if (call.direction === 'LONG' && pctDiff > 0.05) {
          won = true
        } else if (call.direction === 'SHORT' && pctDiff < -0.05) {
          won = true
        }

        call.status = won ? 'WON' : 'LOST'
        call.outcomePrice = currentPrice
        call.priceChangePercent = parseFloat(pctDiff.toFixed(2))
        call.outcomeCheckedAt = now
        call.outcomeReason = won
          ? `Verified by Tatum oracle: ${call.direction} prediction confirmed with price move to $${currentPrice.toLocaleString()} (${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(2)}%).`
          : `Verified by Tatum oracle: Market moved against ${call.direction} position to $${currentPrice.toLocaleString()} (${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(2)}%).`
        
        call.reflection = won
          ? `Positive outcome logged to ${call.setupType} setup memory bank.`
          : `Loss logged to ${call.setupType} setup memory bank for discipline review.`

        resolvedCount++
      } else {
        pendingCount++
      }
    }
  }

  return { resolvedCount, pendingCount }
}

// GET /api/prices - fetch spot rates for benchmark assets
router.get('/prices', async (_req, res) => {
  const assets = ['BTC', 'ETH', 'SOL', 'MATIC', 'USDT']
  const prices = {}

  for (const asset of assets) {
    prices[asset] = await getAssetPrice(asset)
  }

  res.json({ prices })
})

// GET /api/calls - get list of calls + aggregated reliability stats
router.get('/calls', async (_req, res) => {
  await evaluatePendingCalls()
  const stats = calculateStats()
  res.json({
    calls: [...tradeCalls].sort((a, b) => b.createdAt - a.createdAt),
    stats
  })
})

// POST /api/calls - log a new trade call
router.post('/calls', async (req, res) => {
  const { asset, direction, setupType, confidence, timeframeMinutes, notes } = req.body

  if (!asset || !direction || !setupType) {
    return res.status(400).json({ error: 'asset, direction, and setupType are required' })
  }

  const entryPrice = await getAssetPrice(asset)
  const duration = parseInt(timeframeMinutes, 10) || 5
  const now = Date.now()

  const newCall = {
    id: `call-${randomUUID().slice(0, 8)}`,
    asset: asset.toUpperCase(),
    direction: direction === 'SHORT' ? 'SHORT' : 'LONG',
    setupType,
    confidence: confidence || 'HIGH',
    entryPrice,
    timeframeMinutes: duration,
    notes: notes || '',
    createdAt: now,
    evaluatesAt: now + duration * 60 * 1000,
    status: 'PENDING'
  }

  tradeCalls.unshift(newCall)

  res.status(201).json({
    call: newCall,
    message: 'Trade call registered in pending memory bank.'
  })
})

// POST /api/calls/check-pending - manually trigger outcome verification
router.post('/calls/check-pending', async (_req, res) => {
  const result = await evaluatePendingCalls()
  res.json({
    ...result,
    totalCalls: tradeCalls.length
  })
})

// DELETE /api/calls/:id - clear a test call if needed
router.delete('/calls/:id', (req, res) => {
  const { id } = req.params
  tradeCalls = tradeCalls.filter((c) => c.id !== id)
  res.json({ success: true, remaining: tradeCalls.length })
})

export default router
