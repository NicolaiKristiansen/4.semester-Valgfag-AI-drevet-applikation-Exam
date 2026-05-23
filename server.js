import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.join(__dirname, 'dist')
const port = Number(process.env.PORT || 3000)
const difyApiKey = process.env.DIFY_API_KEY
const difyUser = process.env.DIFY_USER || 'customer-service-web'

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

function extractWorkflowResult(data) {
  const outputs =
    data?.data?.outputs ??
    data?.outputs ??
    {}

  if (typeof outputs.result === 'string' && outputs.result.trim()) {
    return outputs.result
  }

  if (typeof outputs.result_text === 'string' && outputs.result_text.trim()) {
    return outputs.result_text
  }

  const outputValues = Object.values(outputs)

  for (const value of outputValues) {
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return ''
}

async function handleApiAsk(req, res) {
  if (!difyApiKey) {
    return sendJson(res, 500, {
      error: 'Missing DIFY_API_KEY on the server.',
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

    const response = await fetch('https://api.dify.ai/v1/workflows/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${difyApiKey}`,
      },
      body: JSON.stringify({
        inputs: {
          customer_message: customerMessage,
        },
        response_mode: 'blocking',
        user: difyUser,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return sendJson(res, response.status, {
        error: 'Dify request failed.',
        details: errorText,
      })
    }

    const data = await response.json()
    const result = extractWorkflowResult(data)

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
