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

    const chunks = chunkDocument(
      extractedText,
      documentId,
      totalPages
    )

    if (chunks.length === 0) {
      throw new Error('NO_CHUNKS_CREATED')
    }

    // STEP 3 + 4: Embed and store in batches
    const BATCH_SIZE = 15

    console.log(
      `\n🔢 Step 2: Embedding + storing in batches of ${BATCH_SIZE}...`
    )

    let totalStored = 0

    for (
      let batchStart = 0;
      batchStart < chunks.length;
      batchStart += BATCH_SIZE
    ) {

      const batchEnd = Math.min(
        batchStart + BATCH_SIZE,
        chunks.length
      )

      const batchChunks = chunks.slice(
        batchStart,
        batchEnd
      )

      const batchTexts = batchChunks.map(
        chunk => chunk.text
      )

      console.log(
        `   Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: chunks ${batchStart + 1}-${batchEnd}`
      )

      // Create embeddings
      const batchEmbeddings = await embedBatch(batchTexts)

      // Store in Pinecone
      await storeEmbeddings(
        documentId,
        batchChunks,
        batchEmbeddings
      )

      totalStored += batchChunks.length

      console.log(
        `   ✅ Stored ${totalStored}/${chunks.length} chunks`
      )

      // Strict 10-second delay between batches to stay under 100 requests/minute limit
      if (batchEnd < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }

    console.log('\n✅ Document indexing complete!')
    console.log(`   ${totalStored} chunks indexed and ready`)

    return {
      success: true,
      chunksCount: totalStored,
    }

  } catch (error) {

    console.error(
      '\n❌ Document indexing failed:',
      error.message
    )

    throw error
  }
}

/**
 * PHASE 2: Answer a user question.
 *
 * Called when user sends a message in chat.
 * Finds relevant content and streams answer.
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

    // STEP 1: Clean question
    let cleanedQuestion

    try {

      cleanedQuestion = cleanQuery(question)

      console.log(`   Cleaned: "${cleanedQuestion}"`)

    } catch (error) {

      if (error.message === 'EMPTY_QUESTION') {
        return sendErrorStream(
          res,
          'Please type a question.'
        )
      }

      if (error.message === 'QUESTION_TOO_SHORT') {
        return sendErrorStream(
          res,
          'Question is too short. Please be more specific.'
        )
      }

      if (error.message === 'QUESTION_TOO_LONG') {
        return sendErrorStream(
          res,
          'Question is too long. Please shorten it.'
        )
      }

      throw error
    }

    // STEP 2: Check relevance
    if (!isQuestionRelevant(cleanedQuestion)) {

      return sendErrorStream(
        res,
        'This question does not appear to be related to your document. ' +
        'I can only answer questions about the uploaded PDF.'
      )
    }

    // STEP 3: Convert question to embedding
    console.log('\n🔢 Converting question to embedding...')

    const questionEmbedding = await embedText(
      cleanedQuestion,
      'RETRIEVAL_QUERY'
    )

    // STEP 4: Search Pinecone
    console.log('\n🔍 Searching for relevant chunks...')

    let relevantChunks

    try {

      relevantChunks = await searchSimilarChunks(
        documentId,
        questionEmbedding
      )

    } catch (searchError) {

      if (searchError.message === 'DOCUMENT_NOT_INDEXED') {

        console.log('\n🔄 Document not indexed. Auto-reindexing...')

        const Document = require('../models/Document')

        const doc = await Document.findById(documentId)

        if (
          !doc ||
          !doc.extractedText ||
          doc.extractedText.trim().length < 50
        ) {

          return sendErrorStream(
            res,
            'This document could not be indexed. Please delete and re-upload it.'
          )
        }

        // Stream progress message
        if (!res.headersSent) {

          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')

          res.flushHeaders()
        }

        res.write(
          `data: ${JSON.stringify({
            text: '⏳ Indexing your document for the first time. This may take a moment...\n\n'
          })}\n\n`
        )

        // Re-index document
        await indexDocument(
          doc._id.toString(),
          doc.extractedText,
          doc.pageCount
        )

        console.log('✅ Auto-reindex complete. Retrying search...')

        relevantChunks = await searchSimilarChunks(
          documentId,
          questionEmbedding
        )

      } else {

        throw searchError
      }
    }

    // STEP 5: No relevant chunks found
    if (
      !relevantChunks ||
      relevantChunks.length === 0
    ) {

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

    const sourcePages = [
      ...new Set(
        relevantChunks.map(
          chunk => `Page ${chunk.pageNumber}`
        )
      )
    ]

    console.log(
      `   Context length: ${context.length} characters`
    )

    console.log(
      `   Source pages: ${sourcePages.join(', ')}`
    )

    console.log(
      `   History messages: ${formattedHistory.length}`
    )

    // STEP 7: Stream answer
    console.log('\n🤖 Streaming answer from Groq...')

    const fullResponse = await streamAnswer(
      res,
      documentName,
      context,
      cleanedQuestion,
      formattedHistory,
      sourcePages
    )

    return {
      fullResponse,
      sourcePages
    }

  } catch (error) {

    console.error(
      '\n❌ Query failed:',
      error.message
    )

    if (error.message === 'DOCUMENT_NOT_INDEXED') {

      sendErrorStream(
        res,
        'This document hasn\'t been indexed yet. ' +
        'Please delete it and re-upload, or use the re-index option.'
      )

    } else {

      sendErrorStream(
        res,
        'Something went wrong. Please try again.'
      )
    }
  }
}

/**
 * Sends error message as stream.
 */
const sendErrorStream = (res, message) => {

  if (!res.headersSent) {

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    res.flushHeaders()
  }

  res.write(
    `data: ${JSON.stringify({
      text: message
    })}\n\n`
  )

  res.write(
    `data: ${JSON.stringify({
      done: true,
      sources: [],
      fullResponse: message,
      isError: true
    })}\n\n`
  )

  res.end()
}

module.exports = {
  indexDocument,
  queryDocument,
  deleteDocumentVectors
}