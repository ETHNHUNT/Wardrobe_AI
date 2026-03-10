import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { gsap } from 'gsap'
import { Shirt } from 'lucide-react'
import ItemCard from '../components/ItemCard'
import ItemDetailModal from '../components/ItemDetailModal'
import SplineScene from '../components/SplineScene'
import TextShimmer from '../components/TextShimmer'
import { SCENES } from '../lib/scenes'

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
  boots: 'Boots', formal_shoes: 'Formal', accessory: 'Access.', other: 'Other',
}
const OCCASION_LABELS = { '': 'All', casual: 'Casual', work: 'Work', formal: 'Formal', sport: 'Sport', outdoor: 'Outdoor' }
const SEASON_LABELS   = { '': 'All', spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' }

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <div className="aspect-[3/4] shimmer" />
      <div className="p-2.5 space-y-2">
        <div className="h-3 w-12 shimmer rounded-full" />
        <div className="h-2.5 w-8 shimmer rounded" />
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all duration-200"
      style={
        active
          ? {
              backgroundColor: 'var(--accent)',
              color: '#0C0C0C',
              fontWeight: 600,
              boxShadow: '0 0 10px rgba(200,169,126,0.3)',
            }
          : {
              backgroundColor: 'rgba(255,255,255,0.03)',
              color: 'rgba(107,101,96,0.8)',
              border: '1px solid rgba(255,255,255,0.07)',
            }
      }
    >
      {label}
    </button>
  )
}

function FilterPills({ options, labels, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {options.map((opt) => (
        <FilterPill
          key={opt}
          active={value === opt}
          onClick={() => onChange(opt)}
          label={labels[opt] ?? opt}
        />
      ))}
    </div>
  )
}

export default function Wardrobe() {
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState({ category: '', occasion: '', season: '' })
  const [selectedItem, setSelectedItem] = useState(null)
  const gridRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchItems(controller.signal)
    return () => controller.abort()
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchItems(signal) {
    setLoading(true)
    try {
      const params = {}
      if (filters.category) params.category = filters.category
      if (filters.occasion) params.occasion = filters.occasion
      if (filters.season)   params.season   = filters.season
      const { data } = await axios.get(`${API_URL}/items`, { params, signal })
      setItems(data)
    } catch (err) {
      if (!axios.isCancel(err)) console.error('Failed to fetch items:', err)
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
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.42, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
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
      <div className="relative overflow-hidden" style={{ height: 190 }}>
        {/* 3D scene — non-interactive, blends with dark background */}
        <SplineScene
          scene={SCENES.wardrobeHero}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            opacity: 0.7,
            mixBlendMode: 'lighten',
          }}
        />

        {/* Gradient fade at bottom of hero */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: 80,
            background: 'linear-gradient(to top, var(--bg-primary) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Text always renders on top regardless of Spline load status */}
        <div className="relative z-10 px-5 pt-12 pb-5">
          <p className="text-reveal text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--accent)' }}>
            Personal
          </p>
          <TextShimmer
            as="h1"
            className="text-3xl serif-display"
          >
            My Wardrobe
          </TextShimmer>
          {!loading && (
            <p className="mt-1.5 text-xs" style={{ color: 'rgba(107,101,96,0.7)', letterSpacing: '0.03em' }}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          )}
        </div>
      </div>

      {/* ── Filter Pills ── */}
      <div className="px-5 pb-4 space-y-2.5">
        <FilterPills
          options={CATEGORIES}
          labels={CATEGORY_LABELS}
          value={filters.category}
          onChange={(v) => handleFilter('category', v)}
        />
        <div className="flex gap-2.5">
          <div className="flex gap-2 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            {OCCASIONS.map((opt) => (
              <FilterPill
                key={opt}
                active={filters.occasion === opt}
                onClick={() => handleFilter('occasion', opt)}
                label={OCCASION_LABELS[opt]}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {SEASONS.map((opt) => (
              <FilterPill
                key={opt}
                active={filters.season === opt}
                onClick={() => handleFilter('season', opt)}
                label={SEASON_LABELS[opt]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Thin divider */}
      <div className="mx-5 mb-4" style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }} />

      {/* ── Item Detail Modal ── */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={(id) => {
            setItems((prev) => prev.filter((i) => i.id !== id))
            setSelectedItem(null)
          }}
          onUpdated={(updated) => {
            setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))
            setSelectedItem(updated)
          }}
        />
      )}

      {/* ── Grid ── */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Shirt
              size={52}
              strokeWidth={1}
              style={{ color: 'rgba(107,101,96,0.3)', marginBottom: 20 }}
            />
            <h2
              className="text-lg font-light mb-2"
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                color: 'rgba(240,237,232,0.7)',
                letterSpacing: '0.02em',
              }}
            >
              Your wardrobe is empty
            </h2>
            <p className="text-sm" style={{ color: 'rgba(107,101,96,0.6)' }}>
              Tap + to add your first item
            </p>
          </div>
        ) : (
          <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <div key={item.id} className="item-card">
                <ItemCard
                  item={item}
                  onClick={(i) => setSelectedItem(i)}
                  onWorn={(id, count) =>
                    setItems((prev) => prev.map((i) => i.id === id ? { ...i, times_worn: count } : i))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
