import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Sparkles,
  BarChart3,
  Award,
  PlusCircle,
  RefreshCw,
  Filter,
  AlertCircle,
  BrainCircuit,
  History,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  ChevronRight,
  Trash2
} from 'lucide-react'

export interface CallRecord {
  id: string
  asset: string
  direction: 'LONG' | 'SHORT'
  setupType: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  entryPrice: number
  targetPrice?: number
  stopPrice?: number
  timeframeMinutes: number
  notes?: string
  createdAt: number
  evaluatesAt: number
  status: 'PENDING' | 'WON' | 'LOST' | 'EXPIRED'
  outcomePrice?: number
  priceChangePercent?: number
  outcomeCheckedAt?: number
  outcomeReason?: string
  reflection?: string
}

export interface SetupStat {
  setupType: string
  totalCalls: number
  settledCalls: number
  wins: number
  losses: number
  winRate: number
  avgReturn: number
  reliabilityScore: number
  verdict: 'HIGHLY_RELIABLE' | 'MODERATE' | 'UNRELIABLE' | 'NEEDS_DATA'
}

export default function App() {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [stats, setStats] = useState<SetupStat[]>([])
  const [activeTab, setActiveTab] = useState<'calls' | 'reliability' | 'log'>('calls')
  const [selectedAsset, setSelectedAsset] = useState<string>('BTC')
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG')
  const [setupType, setSetupType] = useState<string>('Breakout & Retest')
  const [confidence, setConfidence] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('HIGH')
  const [timeframeMinutes, setTimeframeMinutes] = useState<number>(3)
  const [notes, setNotes] = useState<string>('')
  const [filterSetup, setFilterSetup] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState<boolean>(false)
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({})
  const [priceLoading, setPriceLoading] = useState<boolean>(false)
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [selectedCallDetail, setSelectedCallDetail] = useState<CallRecord | null>(null)

  useEffect(() => {
    fetchCalls()
    fetchPrices()
    const interval = setInterval(() => {
      autoCheckSettlements()
    }, 12000)
    return () => clearInterval(interval)
  }, [])

  const fetchPrices = async () => {
    try {
      setPriceLoading(true)
      const res = await fetch('/api/prices')
      if (res.ok) {
        const data = await res.json()
        if (data.prices) {
          setCurrentPrices(data.prices)
        }
      }
    } catch {
      // quiet fallback
    } finally {
      setPriceLoading(false)
    }
  }

  const fetchCalls = async () => {
    try {
      const res = await fetch('/api/calls')
      if (res.ok) {
        const data = await res.json()
        setCalls(data.calls || [])
        setStats(data.stats || [])
      }
    } catch {
      // quiet fallback
    }
  }

  const autoCheckSettlements = async () => {
    try {
      const res = await fetch('/api/calls/check-pending', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.resolvedCount > 0) {
          setBannerMessage({
            type: 'success',
            text: `Evaluated ${data.resolvedCount} pending trade call(s) against live market data!`
          })
          fetchCalls()
          fetchPrices()
        }
      }
    } catch {
      // silent
    }
  }

  const handleManualCheck = async () => {
    setIsChecking(true)
    try {
      const res = await fetch('/api/calls/check-pending', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setBannerMessage({
          type: 'info',
          text: `Market check complete: ${data.resolvedCount} call(s) matured and resolved, ${data.pendingCount} active.`
        })
        await fetchCalls()
        await fetchPrices()
      }
    } catch {
      setBannerMessage({ type: 'error', text: 'Failed to verify market outcomes.' })
    } finally {
      setIsChecking(false)
    }
  }

  const handleCreateCall = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setBannerMessage(null)

    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: selectedAsset,
          direction,
          setupType,
          confidence,
          timeframeMinutes,
          notes
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to log trade call')
      }

      const created = await res.json()
      setBannerMessage({
        type: 'success',
        text: `Call #${created.call.id.slice(0, 8)} recorded at entry $${created.call.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Auto-settlement scheduled in ${timeframeMinutes}m.`
      })
      setNotes('')
      setActiveTab('calls')
      await fetchCalls()
      await fetchPrices()
    } catch (err: unknown) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error logging call'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCall = async (id: string) => {
    try {
      const res = await fetch(`/api/calls/${id}`, { method: 'DELETE' })
      if (res.ok) {
        if (selectedCallDetail?.id === id) setSelectedCallDetail(null)
        await fetchCalls()
      }
    } catch {
      // silent
    }
  }

  const filteredCalls = calls.filter((c) => {
    if (filterSetup !== 'ALL' && c.setupType !== filterSetup) return false
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false
    return true
  })

  const totalCallsCount = calls.length
  const settledCalls = calls.filter((c) => c.status === 'WON' || c.status === 'LOST')
  const wonCalls = calls.filter((c) => c.status === 'WON')
  const overallWinRate = settledCalls.length > 0 ? Math.round((wonCalls.length / settledCalls.length) * 100) : 0
  const pendingCallsCount = calls.filter((c) => c.status === 'PENDING').length

  return (
    <div className="min-h-screen bg-secondary text-primary font-sans antialiased">
      {/* Top Header */}
      <header className="border-b border-secondary bg-primary sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-xl py-lg flex flex-col md:flex-row md:items-center md:justify-between gap-md">
          <div className="flex items-center gap-md">
            <div className="p-sm bg-utility-brand-50 border border-utility-brand-200 rounded-lg flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <div className="flex items-center gap-xs">
                <span className="text-heading-xs font-bold text-primary">CallCred</span>
                <span className="inline-flex items-center gap-xs rounded-full border border-utility-brand-200 bg-utility-brand-50 px-md py-xxs text-xs font-medium text-utility-brand-700">
                  Proof of Accuracy
                </span>
              </div>
              <p className="text-xs text-tertiary">
                Immutable trade hypothesis memory & setup reliability engine
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-md flex-wrap">
            <div className="flex items-center gap-xs px-md py-xs bg-secondary rounded-lg border border-secondary">
              <History className="w-4 h-4 text-fg-tertiary" />
              <span className="text-xs text-tertiary">Logged:</span>
              <span className="text-sm font-semibold text-primary">{totalCallsCount}</span>
            </div>
            <div className="flex items-center gap-xs px-md py-xs bg-secondary rounded-lg border border-secondary">
              <Clock className="w-4 h-4 text-fg-warning-primary" />
              <span className="text-xs text-tertiary">Pending:</span>
              <span className="text-sm font-semibold text-primary">{pendingCallsCount}</span>
            </div>
            <div className="flex items-center gap-xs px-md py-xs bg-secondary rounded-lg border border-secondary">
              <Award className="w-4 h-4 text-fg-brand-primary" />
              <span className="text-xs text-tertiary">Win Rate:</span>
              <span className="text-sm font-semibold text-brand-primary">{overallWinRate}%</span>
            </div>
            <button
              onClick={handleManualCheck}
              disabled={isChecking}
              className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-xs text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-fg-secondary ${isChecking ? 'animate-spin' : ''}`} />
              Verify Pending
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-xl py-2xl space-y-xl">
        {/* Banner Alert */}
        {bannerMessage && (
          <div
            className={`p-md rounded-lg border flex items-center justify-between shadow-xs ${
              bannerMessage.type === 'success'
                ? 'bg-utility-success-50 border-utility-success-200 text-utility-success-700'
                : bannerMessage.type === 'error'
                ? 'bg-utility-error-50 border-utility-error-200 text-utility-error-700'
                : 'bg-utility-brand-50 border-utility-brand-200 text-utility-brand-700'
            }`}
          >
            <div className="flex items-center gap-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bannerMessage.text}</span>
            </div>
            <button
              onClick={() => setBannerMessage(null)}
              className="text-xs font-semibold hover:underline px-xs py-xxs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Tatum Spot Price Feeds */}
        <section className="bg-primary border border-secondary rounded-xl p-xl shadow-xs">
          <div className="flex items-center justify-between mb-md">
            <div className="flex items-center gap-xs">
              <BarChart3 className="w-4 h-4 text-fg-brand-primary" />
              <span className="text-xs font-semibold text-quaternary uppercase tracking-wider">
                Live Asset Benchmarks (Tatum Data API)
              </span>
            </div>
            <button
              onClick={fetchPrices}
              disabled={priceLoading}
              className="text-xs text-brand-primary hover:underline flex items-center gap-xxs"
            >
              <RefreshCw className={`w-3 h-3 ${priceLoading ? 'animate-spin' : ''}`} />
              Sync Rates
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-md">
            {['BTC', 'ETH', 'SOL', 'MATIC', 'USDT'].map((asset) => {
              const price = currentPrices[asset]
              const isSelected = selectedAsset === asset
              return (
                <div
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  className={`p-md rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-utility-brand-50 border-utility-brand-200'
                      : 'bg-secondary border-secondary hover:bg-secondary-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-brand-primary' : 'text-primary'}`}>
                      {asset}
                    </span>
                    <span className="text-xs px-xs py-xxs rounded bg-primary text-quaternary border border-secondary">
                      ORACLE
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-primary mt-xs font-mono">
                    {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Syncing...'}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Tabs Control */}
        <div className="flex gap-lg border-b border-secondary">
          <button
            onClick={() => setActiveTab('calls')}
            className={`border-b-2 px-md py-sm text-sm font-semibold transition-colors flex items-center gap-xs ${
              activeTab === 'calls'
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            <History className="w-4 h-4" />
            Logged Calls ({calls.length})
          </button>
          <button
            onClick={() => setActiveTab('reliability')}
            className={`border-b-2 px-md py-sm text-sm font-semibold transition-colors flex items-center gap-xs ${
              activeTab === 'reliability'
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            <Target className="w-4 h-4" />
            Reliability & Setup Memory
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`border-b-2 px-md py-sm text-sm font-semibold transition-colors flex items-center gap-xs ${
              activeTab === 'log'
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Log New Call
          </button>
        </div>

        {/* TAB 1: LOG CALL FORM */}
        {activeTab === 'log' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
            <div className="lg:col-span-2 bg-primary border border-secondary rounded-xl p-xl shadow-xs">
              <div className="mb-lg">
                <h2 className="text-heading-xs font-bold text-primary">Commit Trade Prediction</h2>
                <p className="text-sm text-tertiary mt-xxs">
                  Timestamp your directional setup prior to market outcome. CallCred snapshots entry valuation and executes automated verification once the horizon elapses.
                </p>
              </div>

              <form onSubmit={handleCreateCall} className="space-y-lg">
                {/* Asset Selection */}
                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Crypto Asset</label>
                  <div className="grid grid-cols-5 gap-sm">
                    {['BTC', 'ETH', 'SOL', 'MATIC', 'USDT'].map((sym) => (
                      <button
                        type="button"
                        key={sym}
                        onClick={() => setSelectedAsset(sym)}
                        className={`py-sm px-md rounded-lg text-xs font-semibold border transition-all ${
                          selectedAsset === sym
                            ? 'bg-brand-solid text-primary-on-brand border-transparent shadow-xs'
                            : 'bg-primary text-secondary border-primary hover:bg-primary-hover'
                        }`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direction: Long or Short */}
                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Predicted Direction</label>
                  <div className="grid grid-cols-2 gap-md">
                    <button
                      type="button"
                      onClick={() => setDirection('LONG')}
                      className={`p-md rounded-lg border flex items-center justify-center gap-xs font-semibold text-sm transition-all ${
                        direction === 'LONG'
                          ? 'bg-utility-success-50 border-utility-success-200 text-utility-success-700'
                          : 'bg-primary text-secondary border-primary hover:bg-primary-hover'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      LONG (Bullish Breakout / Up)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('SHORT')}
                      className={`p-md rounded-lg border flex items-center justify-center gap-xs font-semibold text-sm transition-all ${
                        direction === 'SHORT'
                          ? 'bg-utility-error-50 border-utility-error-200 text-utility-error-700'
                          : 'bg-primary text-secondary border-primary hover:bg-primary-hover'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4" />
                      SHORT (Rejection / Down)
                    </button>
                  </div>
                </div>

                {/* Setup Type & Confidence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div className="flex flex-col gap-sm">
                    <label className="text-sm font-medium text-secondary">Setup Strategy Archetype</label>
                    <select
                      value={setupType}
                      onChange={(e) => setSetupType(e.target.value)}
                      className="rounded-md bg-primary px-lg py-sm text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <option value="Breakout & Retest">Breakout & Retest</option>
                      <option value="Liquidity Sweep / SFP">Liquidity Sweep / SFP</option>
                      <option value="Trend Continuation">Trend Continuation</option>
                      <option value="Mean Reversion">Mean Reversion</option>
                      <option value="Support/Resistance Bounce">Support/Resistance Bounce</option>
                      <option value="News / Event Momentum">News / Event Momentum</option>
                      <option value="Chart Pattern (Flags/Triangles)">Chart Pattern (Flags/Triangles)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-sm">
                    <label className="text-sm font-medium text-secondary">Conviction / Confidence</label>
                    <div className="grid grid-cols-3 gap-xs">
                      {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
                        <button
                          type="button"
                          key={lvl}
                          onClick={() => setConfidence(lvl)}
                          className={`py-sm text-xs font-semibold rounded-lg border transition-all ${
                            confidence === lvl
                              ? lvl === 'HIGH'
                                ? 'bg-utility-brand-50 border-utility-brand-200 text-utility-brand-700'
                                : lvl === 'MEDIUM'
                                ? 'bg-utility-warning-50 border-utility-warning-200 text-utility-warning-700'
                                : 'bg-utility-gray-50 border-utility-gray-200 text-utility-gray-700'
                              : 'bg-primary text-secondary border-primary hover:bg-primary-hover'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Horizon */}
                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Maturity Window</label>
                  <div className="grid grid-cols-4 gap-sm">
                    {[
                      { label: '2 Minutes (Rapid Test)', val: 2 },
                      { label: '5 Minutes', val: 5 },
                      { label: '15 Minutes', val: 15 },
                      { label: '60 Minutes', val: 60 }
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.val}
                        onClick={() => setTimeframeMinutes(opt.val)}
                        className={`py-sm px-xs rounded-lg text-xs font-semibold border transition-all ${
                          timeframeMinutes === opt.val
                            ? 'bg-utility-brand-50 border-utility-brand-200 text-utility-brand-700'
                            : 'bg-primary text-secondary border-primary hover:bg-primary-hover'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-tertiary">
                    Call outcome is auto-settled using Tatum price feed at entry + {timeframeMinutes} minutes.
                  </p>
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Setup Rationale & Confluences</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 4H volume spike after tapping liquidity pocket, MACD bullish divergence"
                    rows={3}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-sm rounded-lg border border-transparent bg-brand-solid py-md text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4 text-fg-white" />
                  {isSubmitting ? 'Recording Call Memory...' : 'Commit Call to Memory Bank'}
                </button>
              </form>
            </div>

            {/* Explanation & Live Anchor Card */}
            <div className="space-y-md">
              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <div className="flex items-center gap-xs text-brand-primary mb-md">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="text-heading-xs font-semibold text-primary">The Credibility Loop</h3>
                </div>
                <div className="space-y-md text-xs text-secondary">
                  <div className="flex items-start gap-sm">
                    <span className="w-5 h-5 rounded-full bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <div>
                      <strong className="text-primary font-semibold block">Pre-Commitment</strong>
                      Timestamp your call before price unfolds to eliminate hindsight bias.
                    </div>
                  </div>
                  <div className="flex items-start gap-sm">
                    <span className="w-5 h-5 rounded-full bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <div>
                      <strong className="text-primary font-semibold block">Market Verification</strong>
                      Tatum Data API verifies real settlement pricing without subjective bias.
                    </div>
                  </div>
                  <div className="flex items-start gap-sm">
                    <span className="w-5 h-5 rounded-full bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                    <div>
                      <strong className="text-primary font-semibold block">Setup Memory Bank</strong>
                      Every call aggregates into strategy reliability matrix over time.
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <p className="text-xs text-quaternary uppercase font-semibold">Active Snapshot</p>
                <div className="flex items-baseline justify-between mt-sm">
                  <span className="text-heading-sm font-bold text-primary">{selectedAsset}/USD</span>
                  <span className="text-sm font-mono text-brand-primary">
                    {currentPrices[selectedAsset]
                      ? `$${currentPrices[selectedAsset].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Fetching...'}
                  </span>
                </div>
                <p className="text-xs text-tertiary mt-xs">
                  Your entry price is locked at this spot rate upon committing.
                </p>
              </section>
            </div>
          </div>
        )}

        {/* TAB 2: CALLS LIST */}
        {activeTab === 'calls' && (
          <div className="space-y-lg">
            {/* Filter Header */}
            <div className="rounded-xl border border-secondary bg-primary p-md flex flex-col md:flex-row md:items-center justify-between gap-md shadow-xs">
              <div className="flex items-center gap-md flex-wrap">
                <div className="flex items-center gap-xs">
                  <Filter className="w-4 h-4 text-fg-tertiary" />
                  <span className="text-xs text-tertiary font-medium">Filter:</span>
                </div>
                <select
                  value={filterSetup}
                  onChange={(e) => setFilterSetup(e.target.value)}
                  className="rounded-md bg-primary px-md py-xs text-xs text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <option value="ALL">All Setups</option>
                  <option value="Breakout & Retest">Breakout & Retest</option>
                  <option value="Liquidity Sweep / SFP">Liquidity Sweep / SFP</option>
                  <option value="Trend Continuation">Trend Continuation</option>
                  <option value="Mean Reversion">Mean Reversion</option>
                  <option value="Support/Resistance Bounce">Support/Resistance Bounce</option>
                  <option value="News / Event Momentum">News / Event Momentum</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-md bg-primary px-md py-xs text-xs text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending (Active)</option>
                  <option value="WON">Verified Win</option>
                  <option value="LOST">Verified Loss</option>
                </select>
              </div>

              <div className="flex items-center gap-sm">
                <span className="text-xs text-tertiary">
                  Showing {filteredCalls.length} of {calls.length} calls
                </span>
                <button
                  onClick={() => setActiveTab('log')}
                  className="inline-flex items-center gap-xs rounded-lg border border-transparent bg-brand-solid px-md py-xs text-xs font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-fg-white" />
                  New Call
                </button>
              </div>
            </div>

            {/* Calls Table */}
            {filteredCalls.length === 0 ? (
              <div className="rounded-xl border border-secondary bg-primary p-3xl text-center shadow-xs">
                <Clock className="w-10 h-10 text-fg-quaternary mx-auto mb-sm" />
                <h3 className="text-heading-xs font-semibold text-primary">No Trade Calls Found</h3>
                <p className="text-xs text-tertiary mt-xxs max-w-sm mx-auto">
                  {calls.length === 0
                    ? 'Commit your first trade prediction before the market moves to initiate your verifiable setup memory.'
                    : 'No trade calls match your active filter.'}
                </p>
                {calls.length === 0 && (
                  <button
                    onClick={() => setActiveTab('log')}
                    className="mt-lg inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-xs font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover"
                  >
                    Log First Call
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-secondary">
                      <tr className="border-b border-secondary">
                        <th className="px-lg py-md text-xs font-semibold text-quaternary">Asset / Time</th>
                        <th className="px-lg py-md text-xs font-semibold text-quaternary">Setup Archetype</th>
                        <th className="px-lg py-md text-xs font-semibold text-quaternary">Direction</th>
                        <th className="px-lg py-md text-xs font-semibold text-quaternary">Entry Price</th>
                        <th className="px-lg py-md text-xs font-semibold text-quaternary">Outcome Price</th>
                        <th className="px-lg py-md text-xs font-semibold text-quaternary">Performance</th>
                        <th className="px-lg py-md text-xs font-semibold text-quaternary">Status</th>
                        <th className="px-lg py-md text-xs font-semibold text-quaternary">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary">
                      {filteredCalls.map((call) => {
                        const isPending = call.status === 'PENDING'
                        const isWon = call.status === 'WON'
                        const isLost = call.status === 'LOST'

                        return (
                          <tr
                            key={call.id}
                            className="border-b border-secondary hover:bg-secondary-hover cursor-pointer transition-colors"
                            onClick={() => setSelectedCallDetail(call)}
                          >
                            <td className="px-lg py-md text-sm">
                              <div className="font-semibold text-primary">{call.asset}</div>
                              <div className="text-xs text-tertiary">
                                {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="px-lg py-md text-sm">
                              <span className="font-medium text-primary">{call.setupType}</span>
                              <div className="text-xs text-quaternary">
                                Conviction: {call.confidence}
                              </div>
                            </td>
                            <td className="px-lg py-md text-sm">
                              <span
                                className={`inline-flex items-center gap-xs rounded-full border px-md py-xxs text-xs font-medium ${
                                  call.direction === 'LONG'
                                    ? 'border-utility-success-200 bg-utility-success-50 text-utility-success-700'
                                    : 'border-utility-error-200 bg-utility-error-50 text-utility-error-700'
                                }`}
                              >
                                {call.direction === 'LONG' ? (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-fg-success-primary" />
                                ) : (
                                  <ArrowDownRight className="w-3.5 h-3.5 text-fg-error-primary" />
                                )}
                                {call.direction}
                              </span>
                            </td>
                            <td className="px-lg py-md text-sm font-mono text-secondary">
                              ${call.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-lg py-md text-sm font-mono text-secondary">
                              {call.outcomePrice
                                ? `$${call.outcomePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : isPending
                                ? (currentPrices[call.asset] ? `$${currentPrices[call.asset].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...')
                                : '—'}
                            </td>
                            <td className="px-lg py-md text-sm font-mono">
                              {call.priceChangePercent !== undefined ? (
                                <span
                                  className={`font-semibold ${
                                    call.priceChangePercent > 0
                                      ? 'text-success-primary'
                                      : call.priceChangePercent < 0
                                      ? 'text-error-primary'
                                      : 'text-tertiary'
                                  }`}
                                >
                                  {call.priceChangePercent > 0 ? '+' : ''}
                                  {call.priceChangePercent.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-tertiary text-xs">Maturing ({call.timeframeMinutes}m)</span>
                              )}
                            </td>
                            <td className="px-lg py-md text-sm">
                              {isPending && (
                                <span className="inline-flex items-center gap-xs rounded-full border border-utility-warning-200 bg-utility-warning-50 px-md py-xxs text-xs font-medium text-utility-warning-700">
                                  <Clock className="w-3 h-3 text-fg-warning-primary" />
                                  Pending
                                </span>
                              )}
                              {isWon && (
                                <span className="inline-flex items-center gap-xs rounded-full border border-utility-success-200 bg-utility-success-50 px-md py-xxs text-xs font-medium text-utility-success-700">
                                  <CheckCircle2 className="w-3 h-3 text-fg-success-primary" />
                                  Win
                                </span>
                              )}
                              {isLost && (
                                <span className="inline-flex items-center gap-xs rounded-full border border-utility-error-200 bg-utility-error-50 px-md py-xxs text-xs font-medium text-utility-error-700">
                                  <AlertCircle className="w-3 h-3 text-fg-error-primary" />
                                  Loss
                                </span>
                              )}
                            </td>
                            <td className="px-lg py-md text-sm" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-sm">
                                <button
                                  onClick={() => setSelectedCallDetail(call)}
                                  className="text-xs text-brand-primary hover:underline"
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => handleDeleteCall(call.id)}
                                  className="text-tertiary hover:text-error-primary transition-colors p-xxs"
                                  title="Delete Call"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-fg-quaternary hover:text-fg-error-primary" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal / Slide-out for Call Details */}
            {selectedCallDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-lg bg-overlay">
                <div className="bg-primary border border-secondary rounded-xl max-w-lg w-full p-xl shadow-lg space-y-md">
                  <div className="flex items-center justify-between border-b border-secondary pb-md">
                    <div className="flex items-center gap-xs">
                      <BrainCircuit className="w-5 h-5 text-brand-primary" />
                      <h3 className="text-heading-xs font-bold text-primary">
                        Call Memory #{selectedCallDetail.id}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedCallDetail(null)}
                      className="text-tertiary hover:text-primary text-xs font-semibold px-xs py-xxs"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-sm text-xs">
                    <div className="flex justify-between py-xs border-b border-secondary">
                      <span className="text-tertiary">Asset & Setup</span>
                      <span className="font-semibold text-primary">{selectedCallDetail.asset} &bull; {selectedCallDetail.setupType}</span>
                    </div>
                    <div className="flex justify-between py-xs border-b border-secondary">
                      <span className="text-tertiary">Direction & Conviction</span>
                      <span className="font-semibold text-primary">{selectedCallDetail.direction} ({selectedCallDetail.confidence})</span>
                    </div>
                    <div className="flex justify-between py-xs border-b border-secondary">
                      <span className="text-tertiary">Entry Valuation</span>
                      <span className="font-mono text-primary">${selectedCallDetail.entryPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-xs border-b border-secondary">
                      <span className="text-tertiary">Settlement Valuation</span>
                      <span className="font-mono text-primary">
                        {selectedCallDetail.outcomePrice ? `$${selectedCallDetail.outcomePrice.toLocaleString()}` : 'Awaiting settlement'}
                      </span>
                    </div>
                    <div className="flex justify-between py-xs border-b border-secondary">
                      <span className="text-tertiary">Outcome Status</span>
                      <span className="font-semibold text-primary">{selectedCallDetail.status}</span>
                    </div>
                    {selectedCallDetail.outcomeReason && (
                      <div className="p-md bg-secondary rounded-lg border border-secondary mt-sm">
                        <span className="font-semibold text-primary block mb-xxs">Oracle Verification:</span>
                        <p className="text-secondary">{selectedCallDetail.outcomeReason}</p>
                      </div>
                    )}
                    {selectedCallDetail.reflection && (
                      <div className="p-md bg-utility-brand-50 rounded-lg border border-utility-brand-200 text-utility-brand-700 mt-xs">
                        <span className="font-semibold block mb-xxs">Memory Reflection:</span>
                        <p>{selectedCallDetail.reflection}</p>
                      </div>
                    )}
                    {selectedCallDetail.notes && (
                      <div className="p-md bg-secondary rounded-lg border border-secondary mt-xs">
                        <span className="font-semibold text-primary block mb-xxs">Initial Thesis Notes:</span>
                        <p className="text-secondary">{selectedCallDetail.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-sm">
                    <button
                      onClick={() => setSelectedCallDetail(null)}
                      className="w-full inline-flex items-center justify-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RELIABILITY STATS & MEMORY */}
        {activeTab === 'reliability' && (
          <div className="space-y-xl">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <p className="text-sm text-tertiary">Cumulative Win Rate</p>
                <p className="mt-md text-heading-xs font-semibold text-brand-primary">{overallWinRate}%</p>
                <p className="text-xs text-tertiary mt-xs">
                  From {settledCalls.length} verified trade calls
                </p>
              </section>

              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <p className="text-sm text-tertiary">Active Predictions</p>
                <p className="mt-md text-heading-xs font-semibold text-primary">{pendingCallsCount}</p>
                <p className="text-xs text-tertiary mt-xs">
                  Pending maturity oracle checks
                </p>
              </section>

              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <p className="text-sm text-tertiary">Archetypes in Memory</p>
                <p className="mt-md text-heading-xs font-semibold text-primary">{stats.length}</p>
                <p className="text-xs text-tertiary mt-xs">
                  Strategies tracked with historical proof
                </p>
              </section>
            </div>

            {/* Matrix */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
              <div className="mb-lg">
                <h3 className="text-heading-xs font-bold text-primary">Setup Reliability Matrix</h3>
                <p className="text-sm text-tertiary mt-xxs">
                  Evidence-based ranking of setup consistency. Compare which playbooks have verifiable positive expectancy vs. negative return profiles.
                </p>
              </div>

              {stats.length === 0 ? (
                <div className="py-2xl text-center">
                  <BarChart3 className="w-8 h-8 text-fg-quaternary mx-auto mb-xs" />
                  <p className="text-xs text-tertiary">
                    No settled trade memories yet. Log and mature calls to compute setup reliability scores.
                  </p>
                </div>
              ) : (
                <div className="space-y-md">
                  {stats.map((s) => (
                    <div
                      key={s.setupType}
                      className="p-lg bg-secondary border border-secondary rounded-lg space-y-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs">
                        <div>
                          <div className="flex items-center gap-xs">
                            <span className="text-sm font-semibold text-primary">{s.setupType}</span>
                            <span
                              className={`inline-flex items-center gap-xs rounded-full border px-md py-xxs text-xs font-medium ${
                                s.verdict === 'HIGHLY_RELIABLE'
                                  ? 'border-utility-success-200 bg-utility-success-50 text-utility-success-700'
                                  : s.verdict === 'MODERATE'
                                  ? 'border-utility-brand-200 bg-utility-brand-50 text-utility-brand-700'
                                  : s.verdict === 'UNRELIABLE'
                                  ? 'border-utility-error-200 bg-utility-error-50 text-utility-error-700'
                                  : 'border-utility-gray-200 bg-utility-gray-50 text-utility-gray-700'
                              }`}
                            >
                              {s.verdict.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-xs text-tertiary mt-xxs block">
                            {s.totalCalls} logged &bull; {s.settledCalls} settled ({s.wins}W / {s.losses}L) &bull; Avg P&L: {s.avgReturn > 0 ? '+' : ''}{s.avgReturn}%
                          </span>
                        </div>

                        <div className="flex items-center gap-lg">
                          <div className="text-right">
                            <span className="text-xs text-tertiary block">Win Rate</span>
                            <span className="text-sm font-bold text-primary">{s.winRate}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-tertiary block">Reliability Score</span>
                            <span className="text-sm font-bold text-brand-primary">{s.reliabilityScore}/100</span>
                          </div>
                        </div>
                      </div>

                      {/* Visual Win Rate Bar */}
                      <div className="w-full bg-primary h-2 rounded-full overflow-hidden border border-secondary">
                        <div
                          className={`h-full transition-all ${
                            s.winRate >= 65
                              ? 'bg-success-primary'
                              : s.winRate >= 45
                              ? 'bg-brand-solid'
                              : 'bg-error-primary'
                          }`}
                          style={{ width: `${Math.max(4, s.winRate)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
