/**
 * STREAM API
 *
 * Handles Server-Sent Events (SSE) from backend.
 * Connects to /api/chat/ask endpoint.
 * Receives AI response word by word.
 *
 * Why not use axios for this?
 * Axios waits for complete response.
 * SSE needs to read partial responses.
 * We use fetch() with ReadableStream instead.
 */

const BASE_URL = 'http://localhost:5000/api'

/**
 * Sends question to backend and streams response.
 *
 * @param {string} conversationId - current conversation
 * @param {string} question - user question
 * @param {string} token - JWT auth token
 * @param {function} onChunk - called with each word received
 * @param {function} onDone - called when streaming complete
 * @param {function} onError - called if error occurs
 */
const streamQuestion = async (
  conversationId,
  question,
  token,
  onChunk,
  onDone,
  onError
) => {
  try {
    const response = await fetch(`${BASE_URL}/chat/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ conversationId, question }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    // Get readable stream from response
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // Read chunks as they arrive
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      // Decode binary chunk to text
      buffer += decoder.decode(value, { stream: true })

      // SSE format: "data: {json}\n\n"
      // Split by double newline to get individual events
      const lines = buffer.split('\n\n')

      // Keep last incomplete line in buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        // Remove "data: " prefix
        if (!line.startsWith('data: ')) continue

        const jsonStr = line.slice(6).trim()
        if (!jsonStr) continue

        try {
          const data = JSON.parse(jsonStr)

          if (data.error) {
            onError(data.message || 'Something went wrong')
            return
          }

          if (data.done) {
            onDone({
              fullResponse: data.fullResponse,
              sources: data.sources || [],
            })
            return
          }

          if (data.text) {
            onChunk(data.text)
          }

        } catch {
          // Skip malformed JSON
          continue
        }
      }
    }

  } catch (error) {
    console.error('Stream error:', error)
    onError('Connection failed. Please try again.')
  }
}

export { streamQuestion }