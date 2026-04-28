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
  console.log(`⏳ Embedding ${texts.length} chunks via Gemini...`)
  const embeddings = []

  for (let i = 0; i < texts.length; i++) {
    const embedding = await embedText(texts[i], 'RETRIEVAL_DOCUMENT')
    embeddings.push(embedding)

    if ((i + 1) % 10 === 0 || i === texts.length - 1) {
      console.log(`   Progress: ${i + 1}/${texts.length} chunks embedded`)
    }

    // Pause every 10 chunks to respect free tier rate limits
    if ((i + 1) % 10 === 0 && i !== texts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`✅ Embedding complete: ${embeddings.length} vectors`)
  return embeddings
}

module.exports = { embedText, embedBatch }