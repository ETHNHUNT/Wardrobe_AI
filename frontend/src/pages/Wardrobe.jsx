import { useEffect, useState } from 'react'
import axios from 'axios'
import ItemCard from '../components/ItemCard'

const API_URL = import.meta.env.VITE_API_URL

const CATEGORIES = ['', 'tshirt', 'shirt', 'polo', 'jacket', 'hoodie', 'sweater', 'jeans', 'chinos', 'trousers', 'shorts', 'shoes', 'sneakers', 'boots', 'formal_shoes', 'accessory', 'other']
const OCCASIONS = ['', 'casual', 'work', 'formal', 'sport', 'outdoor']
const SEASONS = ['', 'spring', 'summer', 'fall', 'winter']

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
      <div className="aspect-[3/4] bg-gray-200" />
      <div className="p-2 space-y-1.5">
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
        <div className="h-3 w-12 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

export default function Wardrobe() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ category: '', occasion: '', season: '' })

  useEffect(() => {
    fetchItems()
  }, [filters])

  async function fetchItems() {
    setLoading(true)
    try {
      const params = {}
      if (filters.category) params.category = filters.category
      if (filters.occasion) params.occasion = filters.occasion
      if (filters.season) params.season = filters.season
      const { data } = await axios.get(`${API_URL}/items`, { params })
      setItems(data)
    } catch (err) {
      console.error('Failed to fetch items:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-xl font-bold text-gray-900">My Wardrobe</h1>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          <select
            value={filters.category}
            onChange={(e) => handleFilter('category', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 flex-shrink-0"
          >
            <option value="">All categories</option>
            {CATEGORIES.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filters.occasion}
            onChange={(e) => handleFilter('occasion', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 flex-shrink-0"
          >
            <option value="">All occasions</option>
            {OCCASIONS.filter(Boolean).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          <select
            value={filters.season}
            onChange={(e) => handleFilter('season', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 flex-shrink-0"
          >
            <option value="">All seasons</option>
            {SEASONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="p-3">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">👔</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">Your wardrobe is empty</h2>
            <p className="text-sm text-gray-400">Tap + to add your first item</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
