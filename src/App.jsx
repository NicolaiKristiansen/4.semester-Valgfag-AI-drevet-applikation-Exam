import { useState } from 'react'
import './App.css'

const DIFY_API_URL = import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai/v1/workflows/run'
const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY
const DIFY_USER = import.meta.env.VITE_DIFY_USER || 'local-dev-user'

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

    if (!DIFY_API_KEY) {
      setError('Manglende VITE_DIFY_API_KEY i miljøvariablerne.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(DIFY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DIFY_API_KEY}`,
        },
        body: JSON.stringify({
          inputs: {
            customer_message: customerQuestion,
          },
          response_mode: 'blocking',
          user: DIFY_USER,
        }),
      })

      if (!response.ok) {
        throw new Error(`Dify request failed with status ${response.status}`)
      }

      const data = await response.json()
      const result =
        data?.data?.outputs?.result ??
        data?.data?.outputs?.result_text ??
        data?.outputs?.result ??
        data?.outputs?.result_text ??
        ''

      if (!result) {
        throw new Error('Workflow returned no result output.')
      }

      setAiResponse(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
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
