import { useEffect, useState } from 'react'
import axios from 'axios'
import OutfitCard from '../components/OutfitCard'

const API_URL = import.meta.env.VITE_API_URL
const OCCASIONS = ['casual', 'work', 'formal', 'sport', 'outdoor']
const SEASONS = ['spring', 'summer', 'fall', 'winter']

function inferCurrentSeason() {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'fall'
  return 'winter'
}

export default function OutfitBuilder() {
  const [tab, setTab] = useState('generate')
  const [occasion, setOccasion] = useState('casual')
  const [season, setSeason] = useState(inferCurrentSeason)
  const [suggestions, setSuggestions] = useState([])
  const [savedOutfits, setSavedOutfits] = useState([])
  const [generating, setGenerating] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [todayLoading, setTodayLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tab === 'saved') fetchSaved()
  }, [tab, occasion, season])

  async function fetchSaved() {
    setLoadingSaved(true)
    try {
      const params = {}
      if (occasion) params.occasion = occasion
      if (season) params.season = season
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
      const { data } = await axios.post(`${API_URL}/outfits/generate`, {
        occasion: 'casual',
        season: todaySeason,
      })
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
      await axios.post(`${API_URL}/outfits`, {
        item_ids: suggestion.item_ids,
        occasion,
        season,
      })
      setSuggestions((prev) => prev.filter((s) => s !== suggestion))
      fetchSaved()
    } catch {
      setError('Failed to save outfit.')
    }
  }

  async function handleRate(outfitId, rating) {
    try {
      const { data } = await axios.put(`${API_URL}/outfits/${outfitId}`, { rating })
      setSavedOutfits((prev) =>
        prev.map((o) => (o.id === outfitId ? { ...o, rating: data.rating } : o))
      )
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-xl font-bold text-gray-900">Outfits</h1>
          <button
            onClick={handleTodaySuggestion}
            disabled={todayLoading || generating}
            className="text-sm bg-indigo-600 text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-60 flex items-center gap-1.5 transition-opacity"
          >
            {todayLoading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            )}
            Wear Today?
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 flex-shrink-0"
          >
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 flex-shrink-0"
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-100">
          {['generate', 'saved'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500'
              }`}
            >
              {t === 'generate' ? 'Generate' : 'Saved'}
            </button>
          ))}
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Generate tab */}
      {tab === 'generate' && (
        <div className="p-4 space-y-4">
          <button
            onClick={handleGenerate}
            disabled={generating || todayLoading}
            className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
          >
            {generating ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                AI is thinking… (up to 30s)
              </>
            ) : (
              'Generate Outfits'
            )}
          </button>

          {suggestions.length === 0 && !generating && !error && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-sm">
                Choose an occasion and season,
                <br />
                then tap Generate.
              </p>
            </div>
          )}

          {suggestions.map((s, i) => (
            <OutfitCard
              key={i}
              outfit={{ ...s, occasion, season }}
              onSave={handleSave}
              isSaved={false}
            />
          ))}
        </div>
      )}

      {/* Saved tab */}
      {tab === 'saved' && (
        <div className="p-4 space-y-4">
          {loadingSaved ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl h-48 animate-pulse border border-gray-100"
                />
              ))}
            </div>
          ) : savedOutfits.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">💾</p>
              <p className="text-sm">
                No saved outfits yet.
                <br />
                Generate some and tap Save.
              </p>
            </div>
          ) : (
            savedOutfits.map((o) => (
              <OutfitCard
                key={o.id}
                outfit={o}
                onRate={handleRate}
                onDelete={handleDelete}
                isSaved={true}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
