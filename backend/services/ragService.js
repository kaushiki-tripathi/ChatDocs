/**
 * RAG SERVICE
 *
 * Responsibility:
 * Orchestrates the entire RAG pipeline.
 * Connects all other services together.
 * Handles all error cases.
 *
 * Two main functions:
 * 1. indexDocument() - processes PDF for searching
 * 2. queryDocument() - answers user questions
 *
 * Error cases handled:
 * - Empty PDF (no text extracted)
 * - No relevant chunks found
 * - Irrelevant question
 * - API failures
 */

const { chunkDocument } = require('./chunkingService')
const { embedText, embedBatch } = require('./embeddingService')
const {
  storeEmbeddings,
  searchSimilarChunks,
  deleteDocumentVectors
} = require('./vectorStoreService')
const {
  cleanQuery,
  formatChatHistory,
  formatChunksAsContext,
  isQuestionRelevant
} = require('./queryService')
const { streamAnswer } = require('./groqService')

/**
 * PHASE 1: Index a document.
 *
 * Called after PDF is uploaded and text extracted.
 * Prepares document for semantic search.
 *
 * Steps:
 * 1. Validate text is not empty
 * 2. Split text into chunks
 * 3. Convert chunks to embeddings
 * 4. Store in ChromaDB
 *
 * @param {string} documentId - MongoDB document ID
 * @param {string} extractedText - text from PDF
 * @param {number} totalPages - PDF page count
 * @returns {Object} indexing result
 */
const indexDocument = async (documentId, extractedText, totalPages) => {
  console.log('\n🚀 Starting document indexing...')
  console.log(`   Document ID: ${documentId}`)
  console.log(`   Total pages: ${totalPages}`)
  console.log(`   Text length: ${extractedText?.length || 0} characters`)

  try {

    // STEP 1: Check for empty document
    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error('EMPTY_DOCUMENT')
    }

    // STEP 2: Split into chunks
    console.log('\n📄 Step 1: Chunking document...')
    const chunks = chunkDocument(extractedText, documentId, totalPages)

    if (chunks.length === 0) {
      throw new Error('NO_CHUNKS_CREATED')
    }

    // STEP 3 + 4: Embed and store in SMALL BATCHES to save memory
    // On a 2GB system, processing all at once causes OOM
    const BATCH_SIZE = 5
    console.log(`\n🔢 Step 2: Embedding + storing in batches of ${BATCH_SIZE}...`)

    // Prepare ChromaDB collection first (delete old, create new)
    const { ChromaClient } = require('chromadb')
    const chromaClient = new ChromaClient({ path: process.env.CHROMA_URL })
    const collectionName = `doc_${documentId.toString()}`

    try {
      await chromaClient.deleteCollection({ name: collectionName })
      console.log(`🗑️  Deleted existing collection: ${collectionName}`)
    } catch {
      // Collection did not exist, that is fine
    }

    const collection = await chromaClient.createCollection({
      name: collectionName,
      metadata: { documentId: documentId.toString() },
      embeddingFunction: null
    })

    let totalStored = 0

    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length)
      const batchChunks = chunks.slice(batchStart, batchEnd)
      const batchTexts = batchChunks.map(c => c.text)

      console.log(`   Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: chunks ${batchStart + 1}-${batchEnd}`)

      // Embed this batch
      const batchEmbeddings = await embedBatch(batchTexts)

      // Store this batch immediately
      const ids = batchChunks.map((_, i) => `chunk_${batchStart + i}`)
      const documents = batchTexts
      const metadatas = batchChunks.map(chunk => ({
        documentId: chunk.metadata.documentId,
        chunkIndex: chunk.metadata.chunkIndex.toString(),
        pageNumber: chunk.metadata.pageNumber.toString(),
        startPos: chunk.metadata.startPos.toString(),
        endPos: chunk.metadata.endPos.toString(),
      }))

      await collection.add({ ids, embeddings: batchEmbeddings, documents, metadatas })
      totalStored += batchChunks.length

      console.log(`   ✅ Stored ${totalStored}/${chunks.length} chunks`)
    }

    console.log('\n✅ Document indexing complete!')
    console.log(`   ${totalStored} chunks indexed and ready`)

    return {
      success: true,
      chunksCount: totalStored,
    }

  } catch (error) {
    console.error('\n❌ Document indexing failed:', error.message)
    throw error
  }
}

/**
 * PHASE 2: Answer a user question.
 *
 * Called when user sends a message in chat.
 * Finds relevant content and streams answer.
 *
 * Steps:
 * 1. Clean and validate question
 * 2. Check if question is relevant
 * 3. Convert question to embedding
 * 4. Search ChromaDB for similar chunks
 * 5. Check if relevant chunks found
 * 6. Format context and history
 * 7. Stream answer from Groq
 *
 * @param {Object} res - Express response (for streaming)
 * @param {string} documentId - which document to search
 * @param {string} documentName - PDF filename
 * @param {string} question - user's raw question
 * @param {Array} chatHistory - previous messages
 */
const queryDocument = async (
  res,
  documentId,
  documentName,
  question,
  chatHistory = []
) => {
  console.log('\n🔍 Processing question...')
  console.log(`   Question: "${question}"`)
  console.log(`   Document: ${documentName}`)

  try {

    // STEP 1: Clean the question
    let cleanedQuestion
    try {
      cleanedQuestion = cleanQuery(question)
      console.log(`   Cleaned: "${cleanedQuestion}"`)
    } catch (error) {
      if (error.message === 'EMPTY_QUESTION') {
        return sendErrorStream(res, 'Please type a question.')
      }
      if (error.message === 'QUESTION_TOO_SHORT') {
        return sendErrorStream(res, 'Question is too short. Please be more specific.')
      }
      if (error.message === 'QUESTION_TOO_LONG') {
        return sendErrorStream(res, 'Question is too long. Please shorten it.')
      }
      throw error
    }

    // STEP 2: Check if question is relevant
    if (!isQuestionRelevant(cleanedQuestion)) {
      return sendErrorStream(
        res,
        'This question does not appear to be related to your document. ' +
        'I can only answer questions about the uploaded PDF.'
      )
    }

    // STEP 3: Convert question to embedding
    console.log('\n🔢 Converting question to embedding...')
    const questionEmbedding = await embedText(cleanedQuestion,'RETRIEVAL_QUERY')

    // STEP 4: Search ChromaDB
    console.log('\n🔍 Searching for relevant chunks...')
    let relevantChunks
    try {
      relevantChunks = await searchSimilarChunks(
        documentId,
        questionEmbedding
      )
    } catch (searchError) {
      if (searchError.message === 'DOCUMENT_NOT_INDEXED') {
        // Auto-reindex: fetch stored text from MongoDB and index on-the-fly
        console.log('\n🔄 Document not indexed. Auto-reindexing...')
        const Document = require('../models/Document')
        const doc = await Document.findById(documentId)
        if (!doc || !doc.extractedText || doc.extractedText.trim().length < 50) {
          return sendErrorStream(
            res,
            'This document could not be indexed. Please delete and re-upload it.'
          )
        }
        // Stream a progress message to the user
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.flushHeaders()
        }
        res.write(`data: ${JSON.stringify({ text: '⏳ Indexing your document for the first time. This may take a moment...\n\n' })}\n\n`)

        await indexDocument(doc._id.toString(), doc.extractedText, doc.pageCount)
        console.log('✅ Auto-reindex complete. Retrying search...')

        // Clear the progress message and retry search
        relevantChunks = await searchSimilarChunks(documentId, questionEmbedding)
      } else {
        throw searchError
      }
    }

    // STEP 5: Check if relevant chunks found
    if (!relevantChunks || relevantChunks.length === 0) {
      return sendErrorStream(
        res,
        'I could not find relevant information about this in your document. ' +
        'Try rephrasing your question or ask about a different topic covered in the PDF.'
      )
    }

    // STEP 6: Format context and history
    console.log('\n📝 Formatting context...')
    const context = formatChunksAsContext(relevantChunks)
    const formattedHistory = formatChatHistory(chatHistory)

    // Get unique page numbers for source references
    const sourcePages = [
      ...new Set(relevantChunks.map(chunk => `Page ${chunk.pageNumber}`))
    ]

    console.log(`   Context length: ${context.length} characters`)
    console.log(`   Source pages: ${sourcePages.join(', ')}`)
    console.log(`   History messages: ${formattedHistory.length}`)

    // STEP 7: Stream answer from Groq
    console.log('\n🤖 Streaming answer from Groq...')
    const fullResponse = await streamAnswer(
      res,
      documentName,
      context,
      cleanedQuestion,
      formattedHistory,
      sourcePages
    )
    return { fullResponse, sourcePages }

  } catch (error) {
    console.error('\n❌ Query failed:', error.message)
    if (error.message === 'DOCUMENT_NOT_INDEXED') {
      sendErrorStream(
        res,
        'This document hasn\'t been indexed yet. ' +
        'Please delete it and re-upload, or use the re-index option.'
      )
    } else {
      sendErrorStream(res, 'Something went wrong. Please try again.')
    }
  }
}

/**
 * Sends an error message as a stream.
 * Used when we catch errors before
 * reaching Groq (validation errors etc.)
 *
 * This keeps the frontend consistent:
 * It always receives SSE format
 * whether success or error.
 *
 * @param {Object} res - Express response
 * @param {string} message - error message to show user
 */
const sendErrorStream = (res, message) => {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
  }

  res.write(`data: ${JSON.stringify({ text: message })}\n\n`)
  res.write(`data: ${JSON.stringify({
    done: true,
    sources: [],
    fullResponse: message,
    isError: true
  })}\n\n`)

  res.end()
}

module.exports = {
  indexDocument,
  queryDocument,
  deleteDocumentVectors
}