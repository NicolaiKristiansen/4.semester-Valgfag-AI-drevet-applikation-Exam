import { useState } from 'react'
import './App.css'

function App() {
  const [customerQuestion, setCustomerQuestion] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setAiResponse('')

    if (!customerQuestion.trim()) {
      setError('Skriv venligst kundens spørgsmål først.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerMessage: customerQuestion,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const details = data?.details ? `\n${data.details}` : ''
        throw new Error((data?.error || `Request failed with status ${response.status}`) + details)
      }

      if (!data?.result) {
        throw new Error('AI returned no result output.')
      }

      setAiResponse(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noget gik galt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="estate-app">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Engestofte-inspireret kundeservice</p>
          <h1>Giv kundens spørgsmål til AI’en og lad den finde svarene på deres spørgsmål. I kan nu justere den som i vil uden at skulle finde priserne</h1>
          <p className="hero__lede">
            Indsæt kundens mail, og lad AI’en formulere en tekst som i kan frit justere.
          </p>
        </div>

        <aside className="hero__panel" aria-label="Kort statuspanel">
          <p className="hero__panel-label">Arbejdsgang</p>
          <ol>
            <li>Indsæt kundens spørgsmål eller mail</li>
            <li>AI’en læser prislisten og instruktionerne om hvad den skal gøre</li>
            <li>Du får et klart svar på dansk</li>
          </ol>
        </aside>
      </section>

      <section className="workspace">
        <form onSubmit={handleSubmit} className="card card--input">
          <div className="card__header">
            <p className="card__eyebrow">1 · Kundehenvendelse</p>
            <h2>Indsæt kundens spørgsmål. Husk at fjerne personlig information.</h2>
          </div>

          <label htmlFor="customerQuestion">Mail eller besked</label>
          <textarea
            id="customerQuestion"
            placeholder="Indsæt kundens spørgsmål her. Husk at fjerne personlig information."
            value={customerQuestion}
            onChange={(e) => setCustomerQuestion(e.target.value)}
            rows={11}
          />

          <div className="form-row">
            <p className="helper-text">Svarene bliver genereret ud fra din Dify-workflow og prisoversigten.</p>
            <button type="submit" disabled={loading}>
              {loading ? 'Sender...' : 'Send til AI'}
            </button>
          </div>

          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <aside className="card card--result">
          <div className="card__header">
            <p className="card__eyebrow">2 · AI-svar</p>
            <h2>Det formulerede svar</h2>
          </div>

          <label htmlFor="aiResponse">Klar til at sende</label>
          <textarea
            id="aiResponse"
            value={aiResponse}
            readOnly
            rows={16}
            placeholder="Svaret kommer her..."
          />

          <div className="result-note">
            <span className="result-dot" />
            <p>Ai'en kan lave fejl og alt information burde dobbeltsjekkes.</p>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default App
