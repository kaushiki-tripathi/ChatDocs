/**
 * CHUNKING SERVICE
 *
 * Responsibility:
 * Takes extracted PDF text and splits it into
 * smaller overlapping pieces called "chunks".
 */

const CHUNK_SIZE = 1000   // characters per chunk
const CHUNK_OVERLAP = 200 // overlap between chunks

/**
 * Estimates which page a chunk belongs to.
 * Based on character position in document.
 *
 * @param {number} chunkStart - where chunk starts
 * @param {number} totalLength - total document length
 * @param {number} totalPages - total PDF pages
 * @returns {number} estimated page number
 */
const estimatePageNumber = (chunkStart, totalLength, totalPages) => {
  if (!totalPages || totalPages === 0) return 1
  const position = chunkStart / totalLength
  return Math.max(1, Math.ceil(position * totalPages))
}

/**
 * Cleans extracted PDF text.
 * Removes excessive whitespace and weird characters.
 *
 * @param {string} text - raw extracted text
 * @returns {string} cleaned text
 */
const cleanText = (text) => {
  return text
    .replace(/\r\n/g, '\n')        // normalize line endings
    .replace(/\r/g, '\n')          // normalize line endings
    .replace(/\n{3,}/g, '\n\n')    // max 2 consecutive newlines
    .replace(/[ \t]{2,}/g, ' ')    // max 1 space
    .replace(/[^\x20-\x7E\n]/g, '') // remove non-printable chars
    .trim()
}

/**
 * Main function: splits document text into chunks.
 *
 * @param {string} text - extracted text from PDF
 * @param {string} documentId - MongoDB document ID
 * @param {number} totalPages - total pages in PDF
 * @returns {Array} array of chunk objects ready for embedding
 *
 * Each chunk looks like:
 * {
 *   text: "the actual text content...",
 *   metadata: {
 *     documentId: "abc123",
 *     chunkIndex: 0,
 *     pageNumber: 3,
 *     startPos: 0,
 *     endPos: 1000
 *   }
 * }
 */
const chunkDocument = (text, documentId, totalPages) => {

  // Step 1: Validate input
  if (!text || text.trim().length === 0) {
    throw new Error('EMPTY_DOCUMENT')
  }

  // Step 2: Clean the text
  const processed = cleanText(text)

  // Step 3: Split into chunks
  const chunks = []
  let chunkIndex = 0
  let startPos = 0

  while (startPos < processed.length) {

    // Calculate where this chunk ends
    let endPos = startPos + CHUNK_SIZE

    // If not at document end, try to end at sentence boundary
    // This prevents cutting sentences in half
    if (endPos < processed.length) {
      const searchArea = processed.slice(startPos, endPos)

      // Find last sentence ending in this chunk
      const lastPeriod = searchArea.lastIndexOf('.')
      const lastQuestion = searchArea.lastIndexOf('?')
      const lastExclaim = searchArea.lastIndexOf('!')

      const lastSentenceEnd = Math.max(
        lastPeriod,
        lastQuestion,
        lastExclaim
      )

      // Use sentence boundary if it exists in second half of chunk
      // This ensures chunks are not too small
      if (lastSentenceEnd > CHUNK_SIZE * 0.5) {
        endPos = startPos + lastSentenceEnd + 1
      }
    } else {
      endPos = processed.length
    }

    // Extract chunk text
    const chunkText = processed.slice(startPos, endPos).trim()

    // Only add non-empty chunks
    if (chunkText.length > 50) {
      chunks.push({
        text: chunkText,
        metadata: {
          documentId: documentId.toString(),
          chunkIndex,
          pageNumber: estimatePageNumber(
            startPos,
            processed.length,
            totalPages
          ),
          startPos,
          endPos,
        }
      })
      chunkIndex++
    }

    // Move forward: Ensure we always move forward by at least (CHUNK_SIZE - CHUNK_OVERLAP)
    // to avoid infinite loops, but use endPos for the overlap logic.
    const nextStart = endPos - CHUNK_OVERLAP
    
    // If nextStart hasn't moved forward from current startPos, force it forward
    if (nextStart <= startPos) {
      startPos = endPos
    } else {
      startPos = nextStart
    }

    // Stop if we've reached or passed the end
    if (startPos >= processed.length - 50) break
  }

  // Log result for debugging
  console.log(`✅ Chunking: ${chunks.length} chunks from ${totalPages} pages`)

  return chunks
}

module.exports = { chunkDocument }