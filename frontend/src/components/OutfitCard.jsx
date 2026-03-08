const API_URL = import.meta.env.VITE_API_URL

function StarRating({ rating, outfitId, onRate, disabled }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          disabled={disabled}
          onClick={() => onRate && onRate(outfitId, star)}
          className={`text-xl transition-colors ${
            star <= (rating ?? 0) ? 'text-yellow-400' : 'text-gray-300'
          } disabled:cursor-default`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function OutfitCard({ outfit, onSave, onRate, onDelete, isSaved }) {
  const items = outfit.items ?? []

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Item thumbnails */}
      <div className="flex gap-1 p-2 overflow-x-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-gray-100"
          >
            {item.photo_path && item.photo_path !== 'tmp' ? (
              <img
                src={`${API_URL}/images/${item.photo_path.split('/').pop()}`}
                alt={item.category}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center px-1">
                {item.category}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="px-3 pb-3 space-y-2">
        {outfit.reason && (
          <p className="text-sm text-gray-600 italic">"{outfit.reason}"</p>
        )}

        {/* Badges */}
        <div className="flex gap-2 flex-wrap">
          {outfit.occasion && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {outfit.occasion}
            </span>
          )}
          {outfit.season && (
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {outfit.season}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <StarRating
            rating={outfit.rating}
            outfitId={outfit.id}
            onRate={onRate}
            disabled={!isSaved}
          />
          {isSaved ? (
            <button
              onClick={() => onDelete && onDelete(outfit.id)}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          ) : (
            <button
              onClick={() => onSave && onSave(outfit)}
              className="text-sm bg-indigo-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
