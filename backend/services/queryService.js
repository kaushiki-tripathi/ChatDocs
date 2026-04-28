/**
 * QUERY SERVICE
 *
 * Responsibility:
 * Cleans and prepares user questions
 * before sending to ChromaDB and Groq AI.
 *
 * Also manages context window:
 * Makes sure we do not exceed
 * Groq's token limit (8192 tokens).
 *
 * Why we need this:
 * Raw user input is messy.
 * Clean input = better search results.
 * Token management = prevents API errors.
 */

// Rough token estimator
// 1 token ≈ 4 characters (OpenAI standard approximation)
const CHARS_PER_TOKEN = 4

// Groq LLaMA3 8B context window
const MAX_CONTEXT_TOKENS = 6000  // leaving 2000 for response

// Max tokens for chat history
const MAX_HISTORY_TOKENS = 1000

// Max tokens for retrieved chunks
const MAX_CHUNKS_TOKENS = 3000

/**
 * Estimates token count for a string.
 * Not 100% accurate but good enough
 * for context window management.
 *
 * @param {string} text
 * @returns {number} estimated token count
 */
const estimateTokens = (text) => {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Cleans user question.
 *
 * Steps:
 * 1. Trim whitespace
 * 2. Normalize multiple spaces
 * 3. Remove excessive punctuation
 * 4. Convert to lowercase for better search
 *
 * @param {string} question - raw user question
 * @returns {string} cleaned question
 */
const cleanQuery = (question) => {
  if (!question || question.trim().length === 0) {
    throw new Error('EMPTY_QUESTION')
  }

  const cleaned = question
    .trim()
    .replace(/\s+/g, ' ')              // multiple spaces → one space
    .replace(/[!]{2,}/g, '!')          // !!! → !
    .replace(/[?]{2,}/g, '?')          // ??? → ?
    .replace(/[.]{4,}/g, '...')        // ..... → ...

  // Validate cleaned question is not too short
  if (cleaned.length < 2) {
    throw new Error('QUESTION_TOO_SHORT')
  }

  // Validate question is not too long
  if (cleaned.length > 1000) {
    throw new Error('QUESTION_TOO_LONG')
  }

  return cleaned
}

/**
 * Formats chat history for AI context.
 * Takes last N messages and formats them
 * as a conversation string.
 *
 * Why limit history:
 * Sending ALL history = context window overflow
 * Last 6 messages = enough for natural conversation
 *
 * @param {Array} messages - array of message objects
 * @returns {Array} formatted messages for Groq API
 */
const formatChatHistory = (messages) => {
  if (!messages || messages.length === 0) return []

  // Take last 6 messages only
  const recentMessages = messages.slice(-6)

  // Format for Groq API
  const formatted = recentMessages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
  }))

  // Check if history fits in token budget
  const historyText = formatted
    .map(m => m.content)
    .join(' ')

  const historyTokens = estimateTokens(historyText)

  // If history too long, reduce to last 4 messages
  if (historyTokens > MAX_HISTORY_TOKENS) {
    console.log('⚠️  History too long, reducing to last 4 messages')
    return messages.slice(-4).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }))
  }

  return formatted
}

/**
 * Formats retrieved chunks into context string.
 * This is what the AI reads to answer the question.
 *
 * @param {Array} chunks - retrieved chunks from ChromaDB
 * @returns {string} formatted context string
 */
const formatChunksAsContext = (chunks) => {
  if (!chunks || chunks.length === 0) return ''

  let context = ''
  let totalTokens = 0

  for (const chunk of chunks) {
    const chunkText = `[Page ${chunk.pageNumber}]\n${chunk.text}\n\n`
    const chunkTokens = estimateTokens(chunkText)

    // Stop adding chunks if we exceed token budget
    if (totalTokens + chunkTokens > MAX_CHUNKS_TOKENS) {
      console.log('⚠️  Context window limit reached, truncating chunks')
      break
    }

    context += chunkText
    totalTokens += chunkTokens
  }

  return context.trim()
}

/**
 * Validates if question is relevant
 * to document-based Q&A.
 *
 * Catches obviously irrelevant questions
 * before wasting API calls.
 *
 * @param {string} question - cleaned question
 * @returns {boolean} true if question seems relevant
 */
const isQuestionRelevant = (question) => {
  const lowerQuestion = question.toLowerCase()

  // Questions that are clearly NOT about a document
  const irrelevantPatterns = [
    /^(hi|hello|hey|howdy|sup)\s*[!?.]?$/,
    /^(how are you|how r u|whats up)/,
    /^(weather|temperature|forecast)/,
    /^(tell me a joke|make me laugh)/,
    /^(what is your name|who are you|are you an ai)/,
  ]

  for (const pattern of irrelevantPatterns) {
    if (pattern.test(lowerQuestion)) {
      return false
    }
  }

  return true
}

module.exports = {
  cleanQuery,
  formatChatHistory,
  formatChunksAsContext,
  estimateTokens,
  isQuestionRelevant,
}