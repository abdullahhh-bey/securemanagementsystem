import { Component } from 'react'

export class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Application render error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6" role="alert">
        <section className="w-full max-w-lg rounded-xl border border-border bg-surface p-8 text-center shadow-lg">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Portal error</p>
          <h1 className="mt-3 text-2xl font-bold text-ink">We couldn’t load this portal</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Reload the page. If the problem continues, share the first error from the browser console.
          </p>
          <button
            type="button"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover"
            onClick={() => window.location.reload()}
          >
            Reload portal
          </button>
        </section>
      </main>
    )
  }
}
