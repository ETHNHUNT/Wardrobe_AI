import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import { RefreshCw, ExternalLink, TrendingUp, AlertTriangle, Palette } from 'lucide-react'
import axios from 'axios'

// Color name → CSS color for swatch display
const COLOR_CSS = {
  black: '#1a1a1a', white: '#f0ede8', grey: '#9e9e9e', gray: '#9e9e9e',
  beige: '#f5f0e8', cream: '#fff8e7', charcoal: '#444',
  navy: '#1a2744', blue: '#2563eb', teal: '#008080', slate: '#708090',
  indigo: '#4b0082', denim: '#1560bd', 'light blue': '#87ceeb',
  red: '#dc2626', burgundy: '#800020', maroon: '#800000', orange: '#f97316',
  rust: '#b45309', terracotta: '#c2673c', pink: '#ec4899',
  brown: '#7c3f00', camel: '#c19a6b', khaki: '#c3b091', olive: '#6b6b35',
  tan: '#d2b48c', stone: '#918474', sand: '#c2b280', taupe: '#8b7d7b',
  yellow: '#fde047', lime: '#84cc16', purple: '#9333ea', coral: '#f87171',
  mint: '#6ee7b7', cyan: '#22d3ee', green: '#16a34a',
}
function getColorCSS(name) {
  return COLOR_CSS[name?.toLowerCase()] ?? name
}

const API = import.meta.env.VITE_API_URL

const OCCASIONS = ['casual', 'work', 'formal', 'sport', 'outdoor']

const PRIORITY_STYLE = {
  high:   { color: '#F87171', bg: 'rgba(248,113,113,0.08)',   border: 'rgba(248,113,113,0.2)'   },
  medium: { color: '#FBB846', bg: 'rgba(251,184,70,0.08)',    border: 'rgba(251,184,70,0.2)'    },
  low:    { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
}

// Coverage arc component using conic-gradient
function CoverageRing({ label, count }) {
  const score  = Math.min(count / 4, 1)   // 4+ items = full ring
  const pct    = Math.round(score * 100)
  const color  = count >= 2 ? '#4ADE80' : count === 1 ? '#FBB846' : '#F87171'
  const ringStyle = {
    width: 60, height: 60, borderRadius: '50%',
    background: `conic-gradient(${color} ${pct}%, rgba(255,255,255,0.06) ${pct}%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div style={ringStyle}>
        <div className="rounded-full flex items-center justify-center"
          style={{ width: 46, height: 46, backgroundColor: 'var(--bg-primary)' }}>
          <span className="text-xs font-semibold" style={{ color }}>{count}</span>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-wide capitalize" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function PulsingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--accent)' }}
        />
      ))}
      <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>Analyzing wardrobe…</span>
    </div>
  )
}

const INPUT_STYLE = {
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.08)',
}

export default function Shop() {
  const [gapsData, setGapsData]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const [brand, setBrand]           = useState('')
  const [budget, setBudget]         = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [sugLoading, setSugLoading] = useState(false)
  const [sugError, setSugError]     = useState(null)

  const [paletteData, setPaletteData] = useState(null)
  const [expandedIdx, setExpandedIdx] = useState(null)  // which suggestion's "Why this?" is open

  useEffect(() => {
    fetchGaps()
    fetchPalette()
  }, [])

  async function fetchPalette() {
    try {
      const { data } = await axios.get(`${API}/shop/palette`)
      setPaletteData(data)
    } catch {
      // Palette is non-critical; silence errors
    }
  }

  async function fetchGaps({ force = false } = {}) {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get(`${API}/shop/gaps`, { params: force ? { force: true } : {} })
      setGapsData(res.data)
    } catch {
      setError('Could not load gap analysis. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSuggestions() {
    setSugLoading(true)
    setSugError(null)
    setSuggestions(null)
    try {
      const params = {}
      if (brand.trim())  params.brand      = brand.trim()
      if (budget.trim()) params.budget_cad = parseFloat(budget)
      const res = await axios.get(`${API}/shop/suggest`, { params })
      setSuggestions(res.data.suggestions)
    } catch {
      setSugError('Could not load suggestions. Make sure the backend is running.')
    } finally {
      setSugLoading(false)
    }
  }

  const counts     = gapsData?.local_coverage?.counts ?? {}
  const flagged    = gapsData?.local_coverage?.flagged ?? []
  const aiGaps     = gapsData?.ai_gaps ?? []
  const totalItems = gapsData?.total_items ?? 0

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* ── Header ── */}
      <div className="px-5 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.32em] uppercase mb-1.5" style={{ color: 'var(--accent)' }}>Intelligence</p>
        <h1 className="text-3xl serif-display" style={{ color: 'var(--text-primary)' }}>Shopping</h1>
        <p className="text-sm mt-1.5" style={{ color: 'rgba(107,101,96,0.7)' }}>Wardrobe gap analysis &amp; recommendations</p>
      </div>

      <div className="px-5 space-y-6">

        {/* ── Section 0: Color Palette Strip — AnimatePresence, appears when data loads ── */}
        <AnimatePresence>
          {paletteData && (paletteData.all_colors?.length ?? 0) > 0 && (
            <motion.section
              key="palette-strip"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Palette size={13} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                <h2 className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
                  Your Palette
                </h2>
              </div>

              {/* Top 8 color swatches */}
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {(paletteData.all_colors ?? []).slice(0, 8).map((color) => (
                  <div key={color} className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{
                        backgroundColor: getColorCSS(color),
                        border: '1.5px solid rgba(255,255,255,0.12)',
                        boxShadow: `0 2px 6px ${getColorCSS(color)}44`,
                      }}
                    />
                    <span className="text-[9px] capitalize" style={{ color: 'var(--text-muted)' }}>{color}</span>
                  </div>
                ))}
              </div>

              {/* Complementary colors to add */}
              {(paletteData.complementary_suggestions?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(107,101,96,0.6)' }}>
                    Complementary to add
                  </p>
                  <div className="flex gap-2">
                    {paletteData.complementary_suggestions.slice(0, 4).map((color) => (
                      <div key={color} className="flex-shrink-0 flex flex-col items-center gap-1">
                        <div
                          className="w-8 h-8 rounded-full"
                          style={{
                            backgroundColor: getColorCSS(color),
                            border: '1.5px dashed rgba(200,169,126,0.5)',
                            boxShadow: `0 2px 6px ${getColorCSS(color)}33`,
                          }}
                        />
                        <span className="text-[9px] capitalize" style={{ color: 'var(--text-primary)' }}>{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Section A: Occasion Coverage ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
              Coverage
            </h2>
            {!loading && (
              <motion.button
                onClick={() => fetchGaps({ force: true })}
                whileTap={{ scale: 0.9 }}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                <RefreshCw size={12} strokeWidth={2} />
                Refresh
              </motion.button>
            )}
          </div>

          {loading ? (
            <PulsingDots />
          ) : error ? (
            <p className="text-sm" style={{ color: '#F87171' }}>{error}</p>
          ) : totalItems === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Add items to your wardrobe to get coverage analysis.
            </p>
          ) : (
            <>
              <div className="flex justify-between">
                {OCCASIONS.map((occ) => (
                  <CoverageRing key={occ} label={occ} count={counts[occ] ?? 0} />
                ))}
              </div>
              {flagged.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: '#F87171' }}>
                  <AlertTriangle size={12} strokeWidth={2} />
                  Needs attention: {flagged.map((o) => o).join(', ')}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Divider ── */}
        <div style={{ height: 1, backgroundColor: 'var(--border)' }} />

        {/* ── Section B: AI Gap Analysis ── */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--accent)' }}>
            Wardrobe Gaps
          </h2>

          {loading ? (
            <PulsingDots />
          ) : error ? null : aiGaps.length === 0 ? (
            <div className="rounded-2xl p-4 text-sm" style={{ backgroundColor: 'rgba(251,184,70,0.06)', border: '1px solid rgba(251,184,70,0.18)', color: '#FBB846' }}>
              {totalItems === 0
                ? 'Add clothing items to enable AI gap analysis.'
                : 'Ollama is offline — showing local coverage only. Start Ollama to get AI gap analysis.'}
            </div>
          ) : (
            <div className="space-y-3">
              {aiGaps.map((gap, i) => {
                const ps = PRIORITY_STYLE[gap.priority] ?? PRIORITY_STYLE.medium
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.3 }}
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderLeft: `3px solid ${ps.color}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="capitalize font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {gap.occasion}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                        {gap.priority}
                      </span>
                    </div>
                    {gap.reason && (
                      <p className="text-xs italic mb-2" style={{ color: 'var(--text-muted)' }}>{gap.reason}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(gap.missing_items ?? []).map((item, j) => (
                        <span key={j} className="text-[10px] px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Divider ── */}
        <div style={{ height: 1, backgroundColor: 'var(--border)' }} />

        {/* ── Section C: Shopping Suggestions ── */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--accent)' }}>
            Shopping Suggestions
          </h2>

          <div className="glass-card rounded-2xl p-4 space-y-3 mb-4">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Brand preference (optional)
              </label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Zara, H&M, Uniqlo"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={INPUT_STYLE} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Budget (CAD, optional)
              </label>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 100" min="0"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={INPUT_STYLE} />
            </div>
            <motion.button
              onClick={fetchSuggestions}
              disabled={sugLoading}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}
            >
              {sugLoading ? (
                <><span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0C0C0C', borderTopColor: 'transparent' }} />
                Getting suggestions…</>
              ) : (
                <><TrendingUp size={15} strokeWidth={2} />Get Suggestions</>
              )}
            </motion.button>
          </div>

          {sugError && <p className="text-sm mb-3" style={{ color: '#F87171' }}>{sugError}</p>}

          {suggestions !== null && suggestions.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              No suggestions — your wardrobe looks well covered!
            </p>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((s, i) => {
                const ps = PRIORITY_STYLE[s.priority] ?? PRIORITY_STYLE.medium
                const compatPct = Math.round((s.compatibility_score ?? 0) * 100)
                const hasMatches = (s.match_count ?? 0) > 0
                const isExpanded = expandedIdx === i
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium capitalize text-sm" style={{ color: 'var(--text-primary)' }}>{s.item}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ backgroundColor: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                        {s.priority}
                      </span>
                    </div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      For <span className="capitalize">{s.occasion}</span> occasions
                    </p>
                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{s.size_note}</p>

                    {/* Compatibility bar — Tailwind CSS width transition */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(107,101,96,0.7)' }}>
                          Wardrobe match
                        </span>
                        <span className="text-[10px] font-semibold" style={{
                          color: compatPct >= 60 ? '#4ADE80' : compatPct >= 30 ? '#FBB846' : 'var(--text-muted)'
                        }}>
                          {hasMatches ? `${s.match_count} item${s.match_count !== 1 ? 's' : ''}` : 'No matches yet'}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${compatPct}%`,
                            backgroundColor: compatPct >= 60 ? '#4ADE80' : compatPct >= 30 ? '#FBB846' : 'rgba(255,255,255,0.2)',
                          }}
                        />
                      </div>
                    </div>

                    {/* "Why this?" expandable — Framer Motion AnimatePresence */}
                    {hasMatches && (
                      <div className="mb-3">
                        <motion.button
                          onClick={() => setExpandedIdx(isExpanded ? null : i)}
                          whileTap={{ scale: 0.97 }}
                          className="flex items-center gap-1 text-[10px] uppercase tracking-wider"
                          style={{ color: 'var(--accent)' }}
                        >
                          <motion.span
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="inline-block"
                          >▶</motion.span>
                          {isExpanded ? 'Hide matches' : `See ${s.match_count} match${s.match_count !== 1 ? 'es' : ''}`}
                        </motion.button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              key="matches"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="flex gap-2 pt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                                {(s.matching_items ?? []).map((mi) => (
                                  <div key={mi.id} className="flex-shrink-0 flex flex-col items-center gap-1">
                                    <div
                                      className="w-12 h-16 rounded-xl overflow-hidden"
                                      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                                    >
                                      {mi.photo_path ? (
                                        <img
                                          src={`${API}/images/${mi.photo_path}`}
                                          alt={mi.category}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[10px]"
                                          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                                          {mi.category?.[0]?.toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-[9px] capitalize text-center max-w-[52px] leading-tight"
                                      style={{ color: 'var(--text-muted)' }}>
                                      {mi.brand || mi.category}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <a href={s.google_shopping_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ color: 'var(--accent)' }}>
                      <ExternalLink size={11} strokeWidth={2} />
                      Shop on Google
                    </a>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
