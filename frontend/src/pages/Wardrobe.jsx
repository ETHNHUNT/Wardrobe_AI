import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { gsap } from 'gsap'
import { Shirt, Grid3X3, Palette } from 'lucide-react'
import ItemCard from '../components/ItemCard'
import ItemDetailModal from '../components/ItemDetailModal'
import SplineScene from '../components/SplineScene'
import TextShimmer from '../components/TextShimmer'
import { useToast } from '../components/Toast'
import { SCENES } from '../lib/scenes'
import { getColorCSS } from '../lib/colors'
import { CATEGORIES as BASE_CATEGORIES, OCCASIONS as BASE_OCCASIONS, SEASONS as BASE_SEASONS } from '../lib/constants'

const GROUP_ORDER = ['neutrals', 'cool', 'warm', 'earth', 'bright']
const GROUP_LABEL = { neutrals: 'Neutrals', cool: 'Cool', warm: 'Warm', earth: 'Earth', bright: 'Bright' }
const GROUP_COLOR = {
  neutrals: 'rgba(200,169,126,0.7)',
  cool:     '#4A9EDE',
  warm:     '#E07B5A',
  earth:    '#9A7A52',
  bright:   '#A78BFA',
}

const API_URL = import.meta.env.VITE_API_URL

const CATEGORIES = ['', ...BASE_CATEGORIES]
const OCCASIONS  = ['', ...BASE_OCCASIONS]
const SEASONS    = ['', ...BASE_SEASONS]

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
  const [view, setView]             = useState('grid')  // 'grid' | 'palette'
  const [paletteData, setPaletteData] = useState(null)
  const [paletteLoading, setPaletteLoading] = useState(false)
  const gridRef    = useRef(null)
  const swatchRef  = useRef(null)
  const { toast }  = useToast()

  useEffect(() => {
    const controller = new AbortController()
    fetchItems(controller.signal)
    return () => controller.abort()
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'palette' && !paletteData) fetchPalette()
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPalette() {
    setPaletteLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/shop/palette`)
      setPaletteData(data)
    } catch (err) {
      console.error('[DEBUG] Failed to fetch palette:', err)
      toast({ message: 'Could not load palette — check backend connection.', type: 'error', duration: 4000 })
    } finally {
      setPaletteLoading(false)
    }
  }

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
      if (!axios.isCancel(err)) {
        console.error('[DEBUG] Failed to fetch items:', err)
        toast({ message: 'Could not load wardrobe — check backend connection.', type: 'error', duration: 4000 })
      }
    } finally {
      setLoading(false)
    }
  }

  // GSAP stagger entrance — wardrobe grid
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

  // GSAP stagger entrance — palette swatches
  useEffect(() => {
    if (!paletteLoading && paletteData && swatchRef.current) {
      const swatches = swatchRef.current.querySelectorAll('.palette-swatch')
      if (swatches.length) {
        gsap.fromTo(
          swatches,
          { scale: 0.7, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.35, stagger: 0.04, ease: 'back.out(1.4)', clearProps: 'all' }
        )
      }
    }
  }, [paletteLoading, paletteData])

  // Memoize palette color CSS lookups — getColorCSS is pure and only changes with paletteData
  const allColorsMemo = useMemo(
    () => (paletteData?.all_colors ?? []).map((color) => ({ color, css: getColorCSS(color) })),
    [paletteData]
  )
  const complementaryMemo = useMemo(
    () => (paletteData?.complementary_suggestions ?? []).map((color) => ({ color, css: getColorCSS(color) })),
    [paletteData]
  )

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

      {/* ── View Toggle + divider ── */}
      <div className="mx-5 mb-4 flex items-center justify-between">
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', flex: 1 }} />
        <div className="flex mx-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => setView('grid')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all"
            style={view === 'grid'
              ? { backgroundColor: 'var(--accent)', color: '#0C0C0C', fontWeight: 600 }
              : { backgroundColor: 'transparent', color: 'var(--text-muted)' }}
          >
            <Grid3X3 size={12} strokeWidth={2} />
            Grid
          </button>
          <button
            onClick={() => setView('palette')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all"
            style={view === 'palette'
              ? { backgroundColor: 'var(--accent)', color: '#0C0C0C', fontWeight: 600 }
              : { backgroundColor: 'transparent', color: 'var(--text-muted)' }}
          >
            <Palette size={12} strokeWidth={2} />
            Palette
          </button>
        </div>
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', flex: 1 }} />
      </div>

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

      {/* ── Grid View ── */}
      {view === 'grid' && (
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
      )}

      {/* ── Palette View ── */}
      {view === 'palette' && (
        <div className="px-5 pb-8">
          {paletteLoading && (
            <div className="flex items-center gap-2 py-8">
              <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Analyzing palette…</span>
            </div>
          )}

          {!paletteLoading && !paletteData && (
            <p className="text-sm py-8" style={{ color: 'var(--text-muted)' }}>
              Add items to see your color palette.
            </p>
          )}

          {!paletteLoading && paletteData && (
            <div className="space-y-6">
              {/* ── Color groups ── */}
              {GROUP_ORDER.map((group) => {
                const count = paletteData.by_group?.[group] ?? 0
                if (count === 0) return null
                const total = Object.values(paletteData.by_group ?? {}).reduce((a, b) => a + b, 0)
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={group}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-[0.15em]" style={{ color: GROUP_COLOR[group] }}>
                        {GROUP_LABEL[group]}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {count} item{count !== 1 ? 's' : ''} · {pct}%
                      </span>
                    </div>
                    {/* Tailwind CSS bar fill — simple width transition */}
                    <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: GROUP_COLOR[group] }}
                      />
                    </div>
                  </div>
                )
              })}

              {/* ── All colors swatches — GSAP stagger ── */}
              <div>
                <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--accent)' }}>
                  Your Colors
                </p>
                <div ref={swatchRef} className="flex flex-wrap gap-2">
                  {allColorsMemo.map(({ color, css }) => (
                    <div key={color} className="palette-swatch flex flex-col items-center gap-1">
                      <div
                        className="w-9 h-9 rounded-full"
                        style={{
                          backgroundColor: css,
                          border: '2px solid rgba(255,255,255,0.1)',
                          boxShadow: `0 2px 8px ${css}55`,
                        }}
                      />
                      <span className="text-[9px] capitalize text-center max-w-[44px] leading-tight"
                        style={{ color: 'var(--text-muted)' }}>
                        {color}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Divider ── */}
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

              {/* ── Complementary suggestions ── */}
              {complementaryMemo.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--accent)' }}>
                    What to Add
                  </p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Colors that would complement your wardrobe
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {complementaryMemo.map(({ color, css }) => (
                      <div key={color} className="flex flex-col items-center gap-1.5">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: css,
                            border: '2px dashed rgba(200,169,126,0.4)',
                            boxShadow: `0 4px 12px ${css}44`,
                          }}
                        >
                          <span className="text-[8px] font-bold text-white/60">+</span>
                        </div>
                        <span className="text-[10px] capitalize" style={{ color: 'var(--text-primary)' }}>{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Underrepresented note ── */}
              {(paletteData.underrepresented?.length ?? 0) > 0 && (
                <div className="rounded-2xl p-4"
                  style={{ backgroundColor: 'rgba(200,169,126,0.05)', border: '1px solid rgba(200,169,126,0.12)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>
                    Underrepresented groups
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Your wardrobe has little of: {paletteData.underrepresented.map((g) => GROUP_LABEL[g] ?? g).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
