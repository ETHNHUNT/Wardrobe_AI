import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader
      .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result && scanning) {
          setScanning(false)
          reader.reset()
          onScan(result.getText())
        }
        // Ignore errors — they fire continuously for each frame with no barcode
      })
      .catch(() => {
        setError('Camera not available. Check permissions.')
      })

    return () => {
      reader.reset()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="flex-1 w-full object-cover"
      />

      {/* Targeting overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="border-2 border-white rounded-lg opacity-70" style={{ width: '70%', height: '25%' }}>
          {/* Corner accents */}
          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-indigo-400 rounded-tl" />
          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-indigo-400 rounded-tr" />
          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-indigo-400 rounded-bl" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-indigo-400 rounded-br" />
        </div>
      </div>

      {/* Instruction text */}
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        <span className="bg-black/60 text-white text-sm px-4 py-2 rounded-full">
          Point at a clothing barcode
        </span>
      </div>

      {error && (
        <div className="absolute top-20 left-4 right-4">
          <p className="bg-red-600 text-white text-sm text-center px-4 py-2 rounded-lg">{error}</p>
        </div>
      )}

      <div className="p-6 bg-black flex items-center justify-center">
        <button
          onClick={onClose}
          className="text-white font-medium text-base px-8 py-3 border border-white/30 rounded-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
