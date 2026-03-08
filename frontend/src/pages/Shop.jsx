import { useState, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL

const OCCASIONS = ['casual', 'work', 'formal', 'sport', 'outdoor']

const PRIORITY_STYLES = {
  high:   'bg-red-100 text-red-700 border border-red-200',
  medium: 'bg-orange-100 text-orange-700 border border-orange-200',
  low:    'bg-gray-100 text-gray-600 border border-gray-200',
}

function coverageColor(count) {
  if (count >= 2) return 'bg-green-100 text-green-700 border border-green-200'
  if (count === 1) return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
  return 'bg-red-100 text-red-700 border border-red-200'
}

function Spinner() {
  return (
    <div className="flex items-center gap-2 text-gray-500 text-sm">
      <div className="w-4 h-4 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
      Analyzing wardrobe… (up to 30s)
    </div>
  )
}

export default function Shop() {
  const [gapsData, setGapsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [brand, setBrand] = useState('')
  const [budget, setBudget] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [sugLoading, setSugLoading] = useState(false)
  const [sugError, setSugError] = useState(null)

  useEffect(() => {
    fetchGaps()
  }, [])

  async function fetchGaps() {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get(`${API}/shop/gaps`)
      setGapsData(res.data)
    } catch (e) {
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
      if (brand.trim()) params.brand = brand.trim()
      if (budget.trim()) params.budget_cad = parseFloat(budget)
      const res = await axios.get(`${API}/shop/suggest`, { params })
      setSuggestions(res.data.suggestions)
    } catch (e) {
      setSugError('Could not load suggestions. Make sure the backend is running.')
    } finally {
      setSugLoading(false)
    }
  }

  const counts = gapsData?.local_coverage?.counts ?? {}
  const flagged = gapsData?.local_coverage?.flagged ?? []
  const aiGaps = gapsData?.ai_gaps ?? []
  const totalItems = gapsData?.total_items ?? 0

  return (
    <div className="min-h-screen bg-gray-50 pb-24 px-4 pt-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Shopping</h1>
      <p className="text-sm text-gray-500 mb-6">Wardrobe gap analysis &amp; recommendations</p>

      {/* ── Section A: Coverage Overview ── */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">Occasion Coverage</h2>

        {loading ? (
          <Spinner />
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : totalItems === 0 ? (
          <p className="text-sm text-gray-400">Add items to your wardrobe to get coverage analysis.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-2">
              {OCCASIONS.map(occ => {
                const count = counts[occ] ?? 0
                return (
                  <span
                    key={occ}
                    className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium ${coverageColor(count)}`}
                  >
                    <span className="capitalize font-semibold">{occ}</span>
                    <span className="text-xs opacity-80 mt-0.5">{count} item{count !== 1 ? 's' : ''}</span>
                  </span>
                )
              })}
            </div>
            {flagged.length > 0 && (
              <p className="text-xs text-red-500 mt-1">
                Needs attention: {flagged.map(o => <span key={o} className="font-semibold capitalize">{o}</span>).reduce((a, b) => [a, ', ', b])}
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Section B: AI Gap Analysis ── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">Wardrobe Gaps</h2>
          {!loading && (
            <button
              onClick={fetchGaps}
              className="text-xs text-teal-600 underline"
            >
              Refresh
            </button>
          )}
        </div>

        {loading ? (
          <Spinner />
        ) : error ? null : aiGaps.length === 0 ? (
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
            {totalItems === 0
              ? 'Add clothing items to enable AI gap analysis.'
              : 'Ollama is offline — showing local coverage only. Start Ollama to get AI gap analysis.'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {aiGaps.map((gap, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="capitalize font-semibold text-gray-800">{gap.occasion}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[gap.priority] ?? PRIORITY_STYLES.medium}`}>
                    {gap.priority}
                  </span>
                </div>
                {gap.reason && (
                  <p className="text-xs text-gray-400 italic mb-2">{gap.reason}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {(gap.missing_items ?? []).map((item, j) => (
                    <span key={j} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section C: Shopping Suggestions ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Shopping Suggestions</h2>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Brand preference (optional)</label>
              <input
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="e.g. Zara, H&M, Uniqlo"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Budget (CAD, optional)</label>
              <input
                type="number"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="e.g. 100"
                min="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <button
              onClick={fetchSuggestions}
              disabled={sugLoading}
              className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              {sugLoading ? 'Getting suggestions…' : 'Get Suggestions'}
            </button>
          </div>
        </div>

        {sugLoading && <Spinner />}
        {sugError && <p className="text-sm text-red-500 mb-3">{sugError}</p>}

        {suggestions !== null && suggestions.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-4">
            No suggestions — your wardrobe looks well covered!
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-col gap-3">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-gray-800 capitalize">{s.item}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PRIORITY_STYLES[s.priority] ?? PRIORITY_STYLES.medium}`}>
                    {s.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  For <span className="capitalize font-medium">{s.occasion}</span> occasions
                </p>
                <p className="text-xs text-gray-400 mb-3">{s.size_note}</p>
                <a
                  href={s.google_shopping_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Shop on Google →
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
