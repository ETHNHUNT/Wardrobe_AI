import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

function ErrorFallback({ message, onReset }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 pb-24 text-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <AlertTriangle
        size={48}
        strokeWidth={1.25}
        style={{ color: '#F87171', marginBottom: 20, opacity: 0.8 }}
      />
      <h2
        className="text-xl font-light mb-2"
        style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
      >
        Something went wrong
      </h2>
      {message && (
        <p
          className="text-xs mb-6 max-w-xs"
          style={{ color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.7 }}
        >
          {message}
        </p>
      )}
      <button
        onClick={onReset}
        className="px-6 py-3 rounded-2xl text-sm font-medium"
        style={{
          border: '1px solid rgba(200,169,126,0.4)',
          color: 'var(--accent)',
          backgroundColor: 'var(--accent-soft)',
        }}
      >
        Try Again
      </button>
    </div>
  )
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
    this.reset = this.reset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log for debugging without crashing
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  reset() {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          message={this.state.error?.message}
          onReset={this.reset}
        />
      )
    }
    return this.props.children
  }
}
