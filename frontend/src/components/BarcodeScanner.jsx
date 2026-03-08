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
        <div className="relative rounded-2xl" style={{ width: '70%', height: '25%', border: '1px solid rgba(255,255,255,0.25)' }}>
          {/* Gold corner accents */}
          <div className="absolute -top-0.5 -left-0.5 w-6 h-6 rounded-tl-xl" style={{ borderTop: '2.5px solid #C8A97E', borderLeft: '2.5px solid #C8A97E' }} />
          <div className="absolute -top-0.5 -right-0.5 w-6 h-6 rounded-tr-xl" style={{ borderTop: '2.5px solid #C8A97E', borderRight: '2.5px solid #C8A97E' }} />
          <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 rounded-bl-xl" style={{ borderBottom: '2.5px solid #C8A97E', borderLeft: '2.5px solid #C8A97E' }} />
          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-br-xl" style={{ borderBottom: '2.5px solid #C8A97E', borderRight: '2.5px solid #C8A97E' }} />
        </div>
      </div>

      {/* Instruction text */}
      <div className="absolute top-10 left-0 right-0 flex justify-center">
        <span className="text-xs tracking-[0.25em] uppercase px-4 py-2 rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#C8A97E', border: '1px solid rgba(200,169,126,0.2)' }}>
          Point at a clothing barcode
        </span>
      </div>

      {error && (
        <div className="absolute top-24 left-4 right-4">
          <p className="text-sm text-center px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171' }}>
            {error}
          </p>
        </div>
      )}

      <div className="p-6 bg-black flex items-center justify-center">
        <button
          onClick={onClose}
          className="font-medium text-sm px-8 py-3 rounded-2xl transition-opacity"
          style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
