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
        throw new Error(data?.error || `Request failed with status ${response.status}`)
      }

      if (!data?.result) {
        throw new Error('Workflow returned no result output.')
      }

      setAiResponse(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noget gik galt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <form onSubmit={handleSubmit} className="app-card">
        <label htmlFor="customerQuestion">Kundens spørgsmål / mail</label>
        <textarea
          id="customerQuestion"
          placeholder="Indsæt kundens spørgsmål her. Husk at fjerne personlig information."
          value={customerQuestion}
          onChange={(e) => setCustomerQuestion(e.target.value)}
          rows={8}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Sender...' : 'Send to AI'}
        </button>

        {error ? <p className="error">{error}</p> : null}

        <label htmlFor="aiResponse">AI-svar</label>
        <textarea id="aiResponse" value={aiResponse} readOnly rows={10} placeholder="Svaret kommer her..." />
      </form>
    </main>
  )
}

export default App
