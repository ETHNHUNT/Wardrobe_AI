const API_URL = import.meta.env.VITE_API_URL

const CATEGORY_COLORS = {
  tshirt: 'bg-blue-100 text-blue-700',
  shirt: 'bg-indigo-100 text-indigo-700',
  polo: 'bg-cyan-100 text-cyan-700',
  jacket: 'bg-gray-100 text-gray-700',
  hoodie: 'bg-purple-100 text-purple-700',
  sweater: 'bg-orange-100 text-orange-700',
  jeans: 'bg-blue-100 text-blue-800',
  chinos: 'bg-yellow-100 text-yellow-800',
  trousers: 'bg-gray-100 text-gray-800',
  shorts: 'bg-green-100 text-green-700',
  shoes: 'bg-red-100 text-red-700',
  sneakers: 'bg-pink-100 text-pink-700',
  boots: 'bg-amber-100 text-amber-800',
  formal_shoes: 'bg-slate-100 text-slate-800',
  accessory: 'bg-rose-100 text-rose-700',
  other: 'bg-gray-100 text-gray-600',
  unknown: 'bg-gray-100 text-gray-400',
}

function parseJson(str, fallback = []) {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

export default function ItemCard({ item, onClick }) {
  const colors = parseJson(item.colors)
  const badgeClass = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.other

  return (
    <div
      className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onClick && onClick(item)}
    >
      {/* Photo */}
      <div className="aspect-[3/4] bg-gray-100 relative">
        {item.photo_path && item.photo_path !== 'tmp' ? (
          <img
            src={`${API_URL}/images/${item.photo_path}`}
            alt={item.category}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${badgeClass}`}>
            {item.category}
          </span>
          {/* Color swatches */}
          <div className="flex gap-1 ml-auto">
            {colors.slice(0, 3).map((color, i) => (
              <span
                key={i}
                title={color}
                className="w-3.5 h-3.5 rounded-full border border-gray-200 inline-block"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        {item.brand && (
          <p className="text-xs text-gray-400 mt-1 truncate">{item.brand}</p>
        )}
      </div>
    </div>
  )
}
