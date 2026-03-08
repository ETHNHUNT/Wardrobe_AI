import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { gsap } from 'gsap'
import { Shirt } from 'lucide-react'
import ItemCard from '../components/ItemCard'

const API_URL = import.meta.env.VITE_API_URL

const CATEGORIES = [
  '', 'tshirt', 'shirt', 'polo', 'jacket', 'hoodie', 'sweater',
  'jeans', 'chinos', 'trousers', 'shorts', 'shoes', 'sneakers',
  'boots', 'formal_shoes', 'accessory', 'other',
]
const OCCASIONS = ['', 'casual', 'work', 'formal', 'sport', 'outdoor']
const SEASONS   = ['', 'spring', 'summer', 'fall', 'winter']

const CATEGORY_LABELS = {
  '': 'All',
  tshirt: 'T-Shirt', shirt: 'Shirt', polo: 'Polo',
  jacket: 'Jacket', hoodie: 'Hoodie', sweater: 'Sweater',
  jeans: 'Jeans', chinos: 'Chinos', trousers: 'Trousers',
  shorts: 'Shorts', shoes: 'Shoes', sneakers: 'Sneakers',
  boots: 'Boots', formal_shoes: 'Formal', accessory: 'Accessories', other: 'Other',
}
const OCCASION_LABELS = { '': 'All', casual: 'Casual', work: 'Work', formal: 'Formal', sport: 'Sport', outdoor: 'Outdoor' }
const SEASON_LABELS   = { '': 'All', spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' }

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <div className="aspect-[3/4] shimmer" />
      <div className="p-2.5 space-y-2">
        <div className="h-4 w-14 shimmer rounded-full" />
        <div className="h-3 w-10 shimmer rounded" />
      </div>
    </div>
  )
}

function FilterPills({ options, labels, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all duration-200"
            style={
              active
                ? { backgroundColor: 'var(--accent)', color: '#0C0C0C', fontWeight: 600 }
                : {
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }
            }
          >
            {labels[opt] ?? opt}
          </button>
        )
      })}
    </div>
  )
}

export default function Wardrobe() {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ category: '', occasion: '', season: '' })
  const gridRef = useRef(null)

  useEffect(() => { fetchItems() }, [filters])

  async function fetchItems() {
    setLoading(true)
    try {
      const params = {}
      if (filters.category) params.category = filters.category
      if (filters.occasion) params.occasion = filters.occasion
      if (filters.season)   params.season   = filters.season
      const { data } = await axios.get(`${API_URL}/items`, { params })
      setItems(data)
    } catch (err) {
      console.error('Failed to fetch items:', err)
    } finally {
      setLoading(false)
    }
  }

  // GSAP stagger entrance
  useEffect(() => {
    if (!loading && items.length && gridRef.current) {
      const cards = gridRef.current.querySelectorAll('.item-card')
      if (cards.length) {
        gsap.fromTo(
          cards,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, stagger: 0.055, ease: 'power2.out', clearProps: 'all' }
        )
      }
    }
  }, [loading, items])

  function handleFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* ── Hero Header ── */}
      <div className="px-5 pt-12 pb-5">
        <p className="text-reveal text-xs tracking-[0.28em] uppercase mb-2" style={{ color: 'var(--accent)' }}>
          Personal
        </p>
        <h1 className="text-3xl font-light tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          My Wardrobe
        </h1>
        {!loading && (
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        )}
      </div>

      {/* ── Filter Pills ── */}
      <div className="px-5 pb-4 space-y-3">
        <FilterPills
          options={CATEGORIES}
          labels={CATEGORY_LABELS}
          value={filters.category}
          onChange={(v) => handleFilter('category', v)}
        />
        <div className="flex gap-2.5">
          <div className="flex gap-2 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            {OCCASIONS.map((opt) => {
              const active = filters.occasion === opt
              return (
                <button
                  key={opt}
                  onClick={() => handleFilter('occasion', opt)}
                  className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200"
                  style={
                    active
                      ? { backgroundColor: 'rgba(200,169,126,0.18)', color: 'var(--accent)', border: '1px solid rgba(200,169,126,0.35)' }
                      : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                  }
                >
                  {OCCASION_LABELS[opt]}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {SEASONS.map((opt) => {
              const active = filters.season === opt
              return (
                <button
                  key={opt}
                  onClick={() => handleFilter('season', opt)}
                  className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200"
                  style={
                    active
                      ? { backgroundColor: 'rgba(200,169,126,0.18)', color: 'var(--accent)', border: '1px solid rgba(200,169,126,0.35)' }
                      : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                  }
                >
                  {SEASON_LABELS[opt]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Thin divider ── */}
      <div className="mx-5 mb-4" style={{ height: '1px', backgroundColor: 'var(--border)' }} />

      {/* ── Grid ── */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Shirt size={56} strokeWidth={1} style={{ color: 'var(--text-muted)', opacity: 0.4 }} className="mb-5" />
            <h2 className="text-base font-light mb-1.5" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Your wardrobe is empty
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Tap + to add your first item
            </p>
          </div>
        ) : (
          <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <div key={item.id} className="item-card">
                <ItemCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
