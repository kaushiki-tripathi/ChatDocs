
/**
 * QUERY SERVICE
 *
 * Cleans questions, formats chat history,
 * and prepares document context for OpenRouter.
 */

// Approximate token estimation.
const CHARS_PER_TOKEN = 4

// Keep room for the model's response.
const MAX_CONTEXT_TOKENS = 6000
const MAX_HISTORY_TOKENS = 1000

// Context budget for retrieved chunks.
const MAX_CHUNKS_TOKENS = MAX_CONTEXT_TOKENS

/**
 * Estimate token count.
 */
const estimateTokens = (text) => {
  if (!text) return 0

  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Clean user question.
 */
const cleanQuery = (question) => {
  if (!question || question.trim().length === 0) {
    throw new Error('EMPTY_QUESTION')
  }

  const cleaned = question
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[!]{2,}/g, '!')
    .replace(/[?]{2,}/g, '?')
    .replace(/[.]{4,}/g, '...')

  if (cleaned.length < 2) {
    throw new Error('QUESTION_TOO_SHORT')
  }

  if (cleaned.length > 1000) {
    throw new Error('QUESTION_TOO_LONG')
  }

  return cleaned
}

/**
 * Format recent chat history.
 */
const formatChatHistory = (messages) => {
  if (!messages || messages.length === 0) {
    return []
  }

  const recentMessages = messages.slice(-6)

  const formatted = recentMessages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
  }))

  const historyText = formatted
    .map(message => message.content)
    .join(' ')

  const historyTokens = estimateTokens(historyText)

  if (historyTokens > MAX_HISTORY_TOKENS) {
    console.log(
      '⚠️ Chat history too long. Keeping last 4 messages.'
    )

    return messages.slice(-4).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }))
  }

  return formatted
}

/**
 * Format retrieved chunks into document context.
 *
 * Keeps actual PDF page numbers.
 * Stops at the context token budget.
 */
const formatChunksAsContext = (chunks) => {
  if (!chunks || chunks.length === 0) {
    return ''
  }

  let context = ''
  let totalTokens = 0

  for (const chunk of chunks) {
    const chunkText =
      `[Page ${chunk.pageNumber}]\n${chunk.text}\n\n`

    const chunkTokens = estimateTokens(chunkText)

    if (totalTokens + chunkTokens > MAX_CHUNKS_TOKENS) {
      console.log(
        '⚠️ Context token budget reached. Remaining chunks omitted.'
      )
      break
    }

    context += chunkText
    totalTokens += chunkTokens
  }

  return context.trim()
}

/**
 * Check whether a question is suitable for document Q&A.
 */
const isQuestionRelevant = (question) => {
  const lowerQuestion = question.toLowerCase()

  const irrelevantPatterns = [
    /^(hi|hello|hey|howdy|sup)\s*[!?.]?$/,
    /^(how are you|how r u|whats up)/,
    /^(weather|temperature|forecast)/,
    /^(tell me a joke|make me laugh)/,
    /^(what is your name|who are you|are you an ai)/,
  ]

  return !irrelevantPatterns.some(
    pattern => pattern.test(lowerQuestion)
  )
}

module.exports = {
  cleanQuery,
  formatChatHistory,
  formatChunksAsContext,
  estimateTokens,
  isQuestionRelevant,
}
