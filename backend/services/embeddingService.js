
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'models/gemini-embedding-001'

const BASE_URL =
  `https://generativelanguage.googleapis.com/v1beta/${MODEL}`

/**
 * Custom Gemini API error.
 * Preserves status and retry duration.
 */
class GeminiEmbeddingError extends Error {
  constructor(errorData, status) {
    const apiError = errorData?.error || {}

    super(
      `Gemini embedding error: ${JSON.stringify(errorData)}`
    )

    this.name = 'GeminiEmbeddingError'
    this.status = status
    this.code = apiError.code
    this.retryDelayMs = null

    const retryInfo = apiError.details?.find(
      detail => detail['@type']?.includes('RetryInfo')
    )

    if (retryInfo?.retryDelay) {
      const seconds = parseFloat(retryInfo.retryDelay)

      if (!Number.isNaN(seconds)) {
        this.retryDelayMs =
          Math.ceil(seconds * 1000) + 2000
      }
    }

    // Fallback: extract retry duration from message.
    if (!this.retryDelayMs) {
      const match = apiError.message?.match(
        /retry in\s+([\d.]+)\s*s/i
      )

      if (match) {
        this.retryDelayMs =
          Math.ceil(parseFloat(match[1]) * 1000) + 2000
      }
    }
  }
}

/**
 * Handle Gemini API response.
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    let errorData

    try {
      errorData = await response.json()
    } catch {
      errorData = {
        error: {
          message: 'Unable to read Gemini API error response'
        }
      }
    }

    throw new GeminiEmbeddingError(
      errorData,
      response.status
    )
  }

  return response.json()
}

/**
 * Embeds a single text.
 *
 * RETRIEVAL_DOCUMENT = PDF chunks
 * RETRIEVAL_QUERY = User questions
 */
const embedText = async (
  text,
  taskType = 'RETRIEVAL_DOCUMENT'
) => {

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing')
  }

  const response = await fetch(
    `${BASE_URL}:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        content: {
          parts: [{ text }]
        },
        output_dimensionality: 768,
        task_type: taskType
      })
    }
  )

  const data = await handleResponse(response)

  return data.embedding.values
}

/**
 * Embeds multiple texts using Gemini Batch API.
 */
const embedBatch = async (texts) => {

  console.log(
    `⏳ Embedding ${texts.length} chunks via Gemini Batch API...`
  )

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing')
  }

  if (!texts || texts.length === 0) {
    return []
  }

  const requests = texts.map(text => ({
    model: MODEL,
    content: {
      parts: [{ text }]
    },
    output_dimensionality: 768,
    task_type: 'RETRIEVAL_DOCUMENT'
  }))

  const response = await fetch(
    `${BASE_URL}:batchEmbedContents?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    }
  )

  const data = await handleResponse(response)

  if (
    !data.embeddings ||
    data.embeddings.length !== texts.length
  ) {
    throw new Error(
      'Gemini returned an unexpected number of embeddings'
    )
  }

  const embeddings = data.embeddings.map(
    item => item.values
  )

  console.log(
    `✅ Embedding complete: ${embeddings.length} vectors`
  )

  return embeddings
}

module.exports = {
  embedText,
  embedBatch
}
