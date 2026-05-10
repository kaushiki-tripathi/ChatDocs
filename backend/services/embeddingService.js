const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'models/gemini-embedding-001'
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:embedContent?key=${GEMINI_API_KEY}`

/**
 * Converts a single text to a 768-dim embedding vector
 * taskType:
 *   'RETRIEVAL_DOCUMENT' → when indexing PDF chunks
 *   'RETRIEVAL_QUERY'    → when embedding user questions
 */
const embedText = async (text, taskType = 'RETRIEVAL_DOCUMENT') => {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      content: { parts: [{ text }] },
      output_dimensionality: 768,
      task_type: taskType
    })
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Gemini embedding error: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  return data.embedding.values
}

/**
 * Embeds multiple texts in sequence.
 * Used when indexing PDF chunks into ChromaDB.
 * Pauses every 10 chunks to respect free tier rate limits.
 */
const embedBatch = async (texts) => {
  console.log(`⏳ Embedding ${texts.length} chunks via Gemini Batch API...`)

  const requests = texts.map(text => ({
    model: MODEL,
    content: { parts: [{ text }] },
    output_dimensionality: 768,
    task_type: 'RETRIEVAL_DOCUMENT'
  }))

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Gemini embedding error: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  
  const embeddings = data.embeddings.map(e => e.values)

  console.log(`✅ Embedding complete: ${embeddings.length} vectors`)
  return embeddings
}

module.exports = { embedText, embedBatch }