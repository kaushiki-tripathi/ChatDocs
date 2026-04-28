/**
 * GROQ SERVICE
 *
 * Responsibility:
 * Sends prompts to Groq AI and streams responses.
 * Combines chunks + chat history into a good prompt.
 * Ensures AI stays within document boundaries.
 *
 * Why Groq:
 * Fastest free AI API available.
 * Same interface as OpenAI.
 * Generous free tier.
 *
 * Why streaming:
 * Users see response immediately.
 * Feels alive and professional.
 * Industry standard for AI apps.
 */

const Groq = require('groq-sdk')

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

// Model to use
const MODEL = 'llama-3.3-70b-versatile'

/**
 * Builds the system prompt.
 * This tells AI HOW to behave.
 * Very important for accuracy.
 *
 * Rules we enforce:
 * - Only answer from document
 * - Always cite page numbers
 * - Admit when answer not found
 * - Never make things up
 *
 * @param {string} documentName - name of uploaded PDF
 * @returns {string} system prompt
 */
const buildSystemPrompt = (documentName) => {
  return `You are ChatDocs AI, an intelligent document assistant.

You are helping a user understand their document: "${documentName}"

STRICT RULES YOU MUST FOLLOW:
1. Answer ONLY using the context provided below.
2. NEVER use outside knowledge or make things up.
3. ALWAYS mention page numbers when referencing content.
   Example: "According to page 5..." or "As stated on page 12..."
4. If the answer is NOT in the context, respond with:
   "I could not find relevant information about this in your document.
    Try rephrasing your question or ask about a different topic."
5. Keep answers clear, concise and helpful.
6. If the user asks something unrelated to the document, say:
   "This question does not appear to be related to your document.
    I can only answer questions about the uploaded PDF."

Remember: You are a document assistant. Stay focused on the document.`
}

/**
 * Builds the user message with context.
 * This is what AI reads to generate answer.
 *
 * Format:
 * CONTEXT FROM DOCUMENT:
 * [Page 3]
 * chunk text here...
 *
 * [Page 7]
 * another chunk here...
 *
 * USER QUESTION:
 * What is photosynthesis?
 *
 * @param {string} context - formatted chunks
 * @param {string} question - cleaned user question
 * @returns {string} formatted user message
 */
const buildUserMessage = (context, question) => {
  return `CONTEXT FROM DOCUMENT:
${context}

USER QUESTION:
${question}

Please answer based strictly on the context above.
Always reference the page numbers in your answer.`
}

/**
 * Streams AI response to client.
 * 
 * Flow:
 * 1. Build messages array (system + history + user)
 * 2. Call Groq with stream: true
 * 3. For each chunk received from Groq:
 *    → Extract text
 *    → Send to frontend via SSE
 * 4. Send [DONE] signal when finished
 *
 * @param {Object} res - Express response object
 * @param {string} documentName - name of PDF
 * @param {string} context - formatted chunks
 * @param {string} question - cleaned user question
 * @param {Array} chatHistory - formatted chat history
 * @param {Array} sourcePages - page numbers to cite
 */
const streamAnswer = async (
  res,
  documentName,
  context,
  question,
  chatHistory,
  sourcePages
) => {
  try {

    // Build messages array for Groq
    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt(documentName)
      },
      // Include recent chat history for context awareness
      ...chatHistory,
      {
        role: 'user',
        content: buildUserMessage(context, question)
      }
    ]

    // Setup SSE headers for streaming
    // This tells browser: "data is coming in chunks"
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL)
      res.flushHeaders()
    }

    // Call Groq with streaming enabled
    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
      temperature: 0.3,     // low = more factual, less creative
      max_tokens: 1024,     // limit response length
    })

    let fullResponse = ''

    // Process each chunk as it arrives from Groq
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''

      if (text) {
        fullResponse += text

        // Send chunk to frontend
        // SSE format: "data: {json}\n\n"
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    }

    // Send source pages after response is complete
    res.write(`data: ${JSON.stringify({
      done: true,
      sources: sourcePages,
      fullResponse
    })}\n\n`)

    res.end()

    console.log(`✅ Streaming complete: ${fullResponse.length} characters`)
    return fullResponse

  } catch (error) {
    console.error('❌ Groq streaming error:', error)

    // Send error to frontend
    res.write(`data: ${JSON.stringify({
      error: true,
      message: 'AI service error. Please try again.'
    })}\n\n`)

    res.end()
    throw error
  }
}

/**
 * Non-streaming version.
 * Used internally when we need
 * the full response as a string.
 * (For saving to database)
 *
 * @param {string} documentName
 * @param {string} context
 * @param {string} question
 * @param {Array} chatHistory
 * @returns {string} full AI response
 */
const getAnswer = async (
  documentName,
  context,
  question,
  chatHistory
) => {
  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt(documentName)
    },
    ...chatHistory,
    {
      role: 'user',
      content: buildUserMessage(context, question)
    }
  ]

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    stream: false,
    temperature: 0.3,
    max_tokens: 1024,
  })

  return completion.choices[0]?.message?.content || ''
}

module.exports = { streamAnswer, getAnswer }