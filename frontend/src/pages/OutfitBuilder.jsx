import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Sun } from 'lucide-react'
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

const PILL_ACTIVE = { backgroundColor: 'var(--accent)', color: '#0C0C0C', fontWeight: 600 }
const PILL_IDLE   = { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }

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

  useEffect(() => {
    if (tab === 'saved') fetchSaved()
  }, [tab, occasion, season])

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

  async function handleSave(suggestion) {
    try {
      await axios.post(`${API_URL}/outfits`, { item_ids: suggestion.item_ids, occasion, season })
      setSuggestions((prev) => prev.filter((s) => s !== suggestion))
      fetchSaved()
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
            <p className="text-xs tracking-[0.28em] uppercase mb-1.5" style={{ color: 'var(--accent)' }}>AI Styled</p>
            <h1 className="text-2xl font-light" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Outfits</h1>
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
          {['generate', 'saved'].map((t) => (
            <div key={t} className="relative flex-1">
              <button
                onClick={() => setTab(t)}
                className="relative w-full py-2.5 text-sm font-medium capitalize z-10 transition-colors duration-200"
                style={{ color: tab === t ? '#0C0C0C' : 'var(--text-muted)' }}
              >
                {t === 'generate' ? 'Generate' : 'Saved'}
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
                <OutfitCard key={o.id} outfit={o} onRate={handleRate} onDelete={handleDelete} isSaved={true} />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
