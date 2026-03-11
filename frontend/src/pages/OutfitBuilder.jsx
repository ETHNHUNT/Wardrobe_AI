import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Sun, Clock, CheckCircle2 } from 'lucide-react'
import { gsap } from 'gsap'
import axios from 'axios'
import OutfitCard from '../components/OutfitCard'

const API_URL = import.meta.env.VITE_API_URL
const OCCASIONS = ['casual', 'work', 'formal', 'sport', 'outdoor']
const SEASONS   = ['spring', 'summer', 'fall', 'winter']

function inferCurrentSeason() {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'fall'
  return 'winter'
}

const PILL_ACTIVE = {
  backgroundColor: 'var(--accent)',
  color: '#0C0C0C',
  fontWeight: 600,
  boxShadow: '0 0 10px rgba(200,169,126,0.3)',
}
const PILL_IDLE = {
  backgroundColor: 'rgba(255,255,255,0.03)',
  color: 'rgba(107,101,96,0.8)',
  border: '1px solid rgba(255,255,255,0.07)',
}

export default function OutfitBuilder() {
  const [tab, setTab]               = useState('generate')
  const [occasion, setOccasion]     = useState('casual')
  const [season, setSeason]         = useState(inferCurrentSeason)
  const [suggestions, setSuggestions] = useState([])
  const [savedOutfits, setSavedOutfits] = useState([])
  const [generating, setGenerating] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [todayLoading, setTodayLoading] = useState(false)
  const [error, setError]           = useState('')
  // Iteration 6: history + worn tracking + naming
  const [historyOutfits, setHistoryOutfits] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [nameInputs, setNameInputs]   = useState({})     // {outfit_id: string}
  const [wornLoading, setWornLoading] = useState(null)   // outfit_id being marked
  const historyRef = useRef(null)

  useEffect(() => {
    if (tab === 'saved') fetchSaved()
    if (tab === 'history') fetchHistory()
  }, [tab, occasion, season]) // eslint-disable-line react-hooks/exhaustive-deps

  // GSAP stagger on history list
  useEffect(() => {
    if (!loadingHistory && historyOutfits.length && historyRef.current) {
      const cards = historyRef.current.querySelectorAll('.history-card')
      if (cards.length) {
        gsap.fromTo(cards,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, stagger: 0.06, ease: 'power2.out', clearProps: 'all' }
        )
      }
    }
  }, [loadingHistory, historyOutfits])

  async function fetchHistory() {
    setLoadingHistory(true)
    try {
      const { data } = await axios.get(`${API_URL}/outfits/history`)
      setHistoryOutfits(data)
    } catch {
      // Silently ignore — history is non-critical
    } finally {
      setLoadingHistory(false)
    }
  }

  async function fetchSaved() {
    setLoadingSaved(true)
    try {
      const params = {}
      if (occasion) params.occasion = occasion
      if (season)   params.season   = season
      const { data } = await axios.get(`${API_URL}/outfits`, { params })
      setSavedOutfits(data)
    } catch {
      setError('Failed to load saved outfits.')
    } finally {
      setLoadingSaved(false)
    }
  }

  async function handleGenerate() {
    if (!occasion || !season) return
    setGenerating(true)
    setError('')
    setSuggestions([])
    try {
      const { data } = await axios.post(`${API_URL}/outfits/generate`, { occasion, season })
      setSuggestions(data.suggestions)
      if (data.suggestions.length === 0) {
        setError('AI returned no suggestions. Try a different occasion or add more items.')
      }
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Generation failed. Is Ollama running?'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  async function handleTodaySuggestion() {
    setTodayLoading(true)
    setError('')
    try {
      const todaySeason = inferCurrentSeason()
      const { data } = await axios.post(`${API_URL}/outfits/generate`, { occasion: 'casual', season: todaySeason })
      setSuggestions(data.suggestions)
      setOccasion('casual')
      setSeason(todaySeason)
      setTab('generate')
      if (data.suggestions.length === 0) {
        setError('AI returned no suggestions. Try adding more casual items to your wardrobe.')
      }
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Could not generate suggestions.'
      setError(msg)
    } finally {
      setTodayLoading(false)
    }
  }

  async function handleMarkWorn(outfitId) {
    setWornLoading(outfitId)
    try {
      const { data } = await axios.post(`${API_URL}/outfits/${outfitId}/worn`)
      setSavedOutfits((prev) => prev.map((o) => o.id === outfitId ? { ...o, times_worn: data.times_worn, worn_date: data.worn_date } : o))
    } catch {
      setError('Failed to mark outfit as worn.')
    } finally {
      setWornLoading(null)
    }
  }

  async function handleRename(outfitId) {
    const name = nameInputs[outfitId] ?? ''
    try {
      await axios.put(`${API_URL}/outfits/${outfitId}`, { name: name || null })
      setSavedOutfits((prev) => prev.map((o) => o.id === outfitId ? { ...o, name: name || null } : o))
    } catch {
      setError('Failed to save outfit name.')
    }
  }

  async function handleSave(suggestion) {
    try {
      await axios.post(`${API_URL}/outfits`, { item_ids: suggestion.item_ids, occasion, season })
      setSuggestions((prev) => prev.filter((s) => s !== suggestion))
      // Don't prefetch saved outfits here — the useEffect on [tab] fetches when user switches tabs
    } catch {
      setError('Failed to save outfit.')
    }
  }

  async function handleRate(outfitId, rating) {
    try {
      const { data } = await axios.put(`${API_URL}/outfits/${outfitId}`, { rating })
      setSavedOutfits((prev) => prev.map((o) => (o.id === outfitId ? { ...o, rating: data.rating } : o)))
    } catch {
      setError('Failed to save rating.')
    }
  }

  async function handleDelete(outfitId) {
    try {
      await axios.delete(`${API_URL}/outfits/${outfitId}`)
      setSavedOutfits((prev) => prev.filter((o) => o.id !== outfitId))
    } catch {
      setError('Failed to delete outfit.')
    }
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* ── Header ── */}
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.32em] uppercase mb-1.5" style={{ color: 'var(--accent)' }}>AI Styled</p>
            <h1 className="text-3xl serif-display" style={{ color: 'var(--text-primary)' }}>Outfits</h1>
          </div>
          {/* Wear Today button */}
          <motion.button
            onClick={handleTodaySuggestion}
            disabled={todayLoading || generating}
            whileTap={{ scale: 0.93 }}
            className="flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-2xl transition-opacity disabled:opacity-50"
            style={{ border: '1px solid rgba(200,169,126,0.35)', color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }}
          >
            {todayLoading ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            ) : (
              <Sun size={14} strokeWidth={1.75} />
            )}
            Wear Today?
          </motion.button>
        </div>
      </div>

      {/* ── Occasion filter pills ── */}
      <div className="px-5 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {OCCASIONS.map((o) => (
          <button key={o} onClick={() => setOccasion(o)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 capitalize"
            style={occasion === o ? PILL_ACTIVE : PILL_IDLE}
          >
            {o}
          </button>
        ))}
      </div>

      {/* ── Season filter pills ── */}
      <div className="px-5 pb-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {SEASONS.map((s) => (
          <button key={s} onClick={() => setSeason(s)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 capitalize"
            style={season === s ? PILL_ACTIVE : PILL_IDLE}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="px-5 mb-4">
        <div className="flex rounded-2xl p-1" style={{ backgroundColor: 'var(--bg-surface)' }}>
          {[
            { id: 'generate', label: 'Generate' },
            { id: 'saved', label: 'Saved' },
            { id: 'history', label: 'History', icon: Clock },
          ].map(({ id: t, label, icon: Icon }) => (
            <div key={t} className="relative flex-1">
              <button
                onClick={() => setTab(t)}
                className="relative w-full py-2.5 text-xs font-medium z-10 transition-colors duration-200 flex items-center justify-center gap-1"
                style={{ color: tab === t ? '#0C0C0C' : 'var(--text-muted)' }}
              >
                {Icon && <Icon size={11} strokeWidth={2} />}
                {label}
              </button>
              {tab === t && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: 'var(--accent)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-5 mb-4 p-3.5 rounded-2xl text-xs" style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
          {error}
        </div>
      )}

      {/* ── Generate tab ── */}
      <AnimatePresence mode="wait">
        {tab === 'generate' && (
          <motion.div key="generate" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.22 }}
            className="px-5 space-y-4">
            <motion.button
              onClick={handleGenerate}
              disabled={generating || todayLoading}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #C8A97E 0%, #9A7A52 100%)', color: '#0C0C0C' }}
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0C0C0C', borderTopColor: 'transparent' }} />
                  AI is thinking… (up to 30s)
                </>
              ) : (
                <>
                  <Sparkles size={16} strokeWidth={2} />
                  Generate Outfits
                </>
              )}
            </motion.button>

            {suggestions.length === 0 && !generating && !error && (
              <div className="text-center py-20">
                <Sparkles size={40} strokeWidth={1} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 16px' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Choose an occasion and season,<br />then tap Generate.
                </p>
              </div>
            )}

            {suggestions.map((s, i) => (
              <OutfitCard key={i} outfit={{ ...s, occasion, season }} onSave={handleSave} isSaved={false} />
            ))}
          </motion.div>
        )}

        {/* ── Saved tab ── */}
        {tab === 'saved' && (
          <motion.div key="saved" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22 }}
            className="px-5 space-y-4">
            {loadingSaved ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-48 rounded-2xl shimmer" />
                ))}
              </div>
            ) : savedOutfits.length === 0 ? (
              <div className="text-center py-20">
                <Sparkles size={40} strokeWidth={1} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 16px' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No saved outfits yet.<br />Generate some and tap Save.
                </p>
              </div>
            ) : (
              savedOutfits.map((o) => (
                <div key={o.id} className="space-y-2">
                  {/* Outfit name display */}
                  {o.name && (
                    <p className="text-xs font-medium px-1" style={{ color: 'var(--accent)' }}>
                      {o.name}
                    </p>
                  )}
                  <OutfitCard outfit={o} onRate={handleRate} onDelete={handleDelete} isSaved={true} />

                  {/* Iteration 6: Worn tracking + naming below the card */}
                  <div className="rounded-xl px-3 py-2.5 space-y-2.5"
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {/* Worn stats */}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Worn {o.times_worn ?? 0} time{(o.times_worn ?? 0) !== 1 ? 's' : ''}
                        {o.worn_date && (
                          <span> · {new Date(o.worn_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>
                        )}
                      </p>
                      {/* Mark as Worn — whileTap scale (Framer Motion, existing pattern) */}
                      <motion.button
                        onClick={() => handleMarkWorn(o.id)}
                        disabled={wornLoading === o.id}
                        whileTap={{ scale: 0.92 }}
                        className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-xl disabled:opacity-50 transition-all"
                        style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(200,169,126,0.2)' }}
                      >
                        {wornLoading === o.id ? (
                          <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                        ) : (
                          <CheckCircle2 size={11} strokeWidth={2} />
                        )}
                        Worn Today
                      </motion.button>
                    </div>

                    {/* Name this look */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={o.name ? `Rename: ${o.name}` : 'Name this look… (optional)'}
                        value={nameInputs[o.id] ?? ''}
                        onChange={(e) => setNameInputs((p) => ({ ...p, [o.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(o.id)}
                        className="flex-1 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.07)' }}
                      />
                      <motion.button
                        onClick={() => handleRename(o.id)}
                        whileTap={{ scale: 0.92 }}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-medium"
                        style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        Save
                      </motion.button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* ── History tab — GSAP stagger on list ── */}
        {tab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22 }}
            className="px-5">
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl shimmer" />)}
              </div>
            ) : historyOutfits.length === 0 ? (
              <div className="text-center py-20">
                <Clock size={40} strokeWidth={1} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 16px' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Start marking outfits as worn<br />to see your history here.
                </p>
              </div>
            ) : (
              <div ref={historyRef} className="space-y-3">
                {historyOutfits.map((o) => (
                  <div key={o.id} className="history-card rounded-2xl p-4"
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Date chip + name */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {o.worn_date && (
                          <span className="text-[10px] px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: 'rgba(200,169,126,0.08)', color: 'var(--accent)', border: '1px solid rgba(200,169,126,0.2)' }}>
                            {new Date(o.worn_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        {o.name && (
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{o.name}</span>
                        )}
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        ×{o.times_worn}
                      </span>
                    </div>

                    {/* Item thumbnails */}
                    <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                      {(o.items ?? []).slice(0, 5).map((item) => (
                        <div key={item.id} className="flex-shrink-0 w-14 h-18 rounded-xl overflow-hidden"
                          style={{ height: 72, border: '1px solid rgba(255,255,255,0.07)' }}>
                          {item.photo_path ? (
                            <img src={`${API_URL}/images/${item.photo_path}`} alt={item.category}
                              className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px]"
                              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                              {item.category?.[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Rating */}
                    {o.rating && (
                      <div className="mt-2 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className="text-xs" style={{ color: star <= o.rating ? 'var(--accent)' : 'rgba(255,255,255,0.15)' }}>★</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
