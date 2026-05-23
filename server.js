import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.join(__dirname, 'dist')
const instructionsDir = path.join(__dirname, 'src', 'instructions')
const port = Number(process.env.PORT || 3000)
const geminiApiKey = process.env.GEMINI_API_KEY
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

async function readRequestBody(req) {
  const chunks = []

  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')
  return rawBody ? JSON.parse(rawBody) : {}
}

async function readInstructionFile(fileName) {
  const filePath = path.join(instructionsDir, fileName)
  return fs.readFile(filePath, 'utf8')
}

function extractGeminiText(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : []

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts
    if (!Array.isArray(parts)) continue

    const text = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('')

    if (text.trim()) {
      return text
    }
  }

  return ''
}

async function handleApiAsk(req, res) {
  if (!geminiApiKey) {
    return sendJson(res, 500, {
      error: 'Missing GEMINI_API_KEY on the server.',
    })
  }

  try {
    const body = await readRequestBody(req)
    const customerMessage = body?.customerMessage?.trim()

    if (!customerMessage) {
      return sendJson(res, 400, {
        error: 'customerMessage is required.',
      })
    }

    const [aiInstructions, priceChart] = await Promise.all([
      readInstructionFile('AI_Instructions.md'),
      readInstructionFile('Test_PriceChart.md'),
    ])

    const systemInstruction = [
      aiInstructions.trim(),
      '',
      'Kontekst fra prisoversigt:',
      priceChart.trim(),
    ].join('\n')

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: systemInstruction,
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Kundens besked:\n${customerMessage}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 1024,
            responseMimeType: 'text/plain',
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini request failed:', response.status, errorText)
      return sendJson(res, response.status, {
        error: 'Gemini request failed.',
        details: errorText,
      })
    }

    const data = await response.json()
    const result = extractGeminiText(data)

    if (!result) {
      return sendJson(res, 500, {
        error: 'Gemini returned no text output.',
      })
    }

    return sendJson(res, 200, { result })
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unknown server error.',
    })
  }
}

async function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost')
  const urlPath = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const filePath = path.join(distDir, safePath)

  try {
    let fileStat = await fs.stat(filePath)
    let finalPath = filePath

    if (fileStat.isDirectory()) {
      finalPath = path.join(filePath, 'index.html')
      fileStat = await fs.stat(finalPath)
    }

    const fileBuffer = await fs.readFile(finalPath)
    const ext = path.extname(finalPath)

    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
    })
    res.end(fileBuffer)
  } catch {
    const indexPath = path.join(distDir, 'index.html')

    try {
      const html = await fs.readFile(indexPath)
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
      })
      res.end(html)
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Build the app first with npm run build.')
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400)
    res.end()
    return
  }

  if (req.url.startsWith('/api/ask') && req.method === 'POST') {
    await handleApiAsk(req, res)
    return
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    await serveStatic(req, res)
    return
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Method Not Allowed')
})

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
