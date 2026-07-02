import { Component } from 'react'
import { exportAll } from '../db.js'

/* Fanger renderfeil så én knekt skjerm ikke blir hvit skjerm for hele appen.
   Dataene ligger trygt i IndexedDB uansett — fallbacken tilbyr backup + retry. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary fanget:', error, info?.componentStack)
  }

  handleRetry = () => this.setState({ error: null })

  handleBackup = async () => {
    try {
      const data = await exportAll()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fabipilot-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Backup fra feilskjerm feilet:', e)
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen crash">
        <div className="crash-panel">
          <div className="crash-glyph" aria-hidden="true">🧯</div>
          <h1 className="crash-title">Noe gikk galt</h1>
          <p className="crash-text">
            Denne skjermen krasjet, men <b>dataene dine er trygge</b> — de ligger lagret
            lokalt og i skyen. Prøv igjen, eller bytt til en annen fane.
          </p>
          <div className="crash-actions">
            <button type="button" className="crash-retry" onClick={this.handleRetry}>
              Prøv igjen
            </button>
            <button type="button" className="crash-backup" onClick={this.handleBackup}>
              Last ned backup
            </button>
          </div>
          <p className="crash-detail">{String(this.state.error?.message || this.state.error)}</p>
        </div>
      </div>
    )
  }
}
