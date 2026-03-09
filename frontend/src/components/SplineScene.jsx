import { Suspense, lazy, Component, useMemo } from 'react'

// Code-split: Spline runtime (~500 KB) only loads when a scene actually mounts
const Spline = lazy(() => import('@splinetool/react-spline'))

class SplineErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

export default function SplineScene({ scene, style, className }) {
  // Respect OS "reduce motion" setting — skip 3D entirely
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  if (reducedMotion) return null

  return (
    <SplineErrorBoundary>
      <div className={className} style={style}>
        {/* Force the Spline <canvas> background transparent so it blends
            with the app's dark theme instead of painting a solid colour */}
        <style>{'.spline-wrapper canvas { background: transparent !important; }'}</style>
        <div className="spline-wrapper" style={{ width: '100%', height: '100%' }}>
          <Suspense fallback={null}>
            <Spline scene={scene} style={{ width: '100%', height: '100%' }} />
          </Suspense>
        </div>
      </div>
    </SplineErrorBoundary>
  )
}
