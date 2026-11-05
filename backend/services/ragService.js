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
 * GEMINI RETRY HELPERS
 */

const getRetryDelay = (error) => {
  if (
    Number.isFinite(error.retryDelayMs) &&
    error.retryDelayMs > 0
  ) {
    return error.retryDelayMs;
  }

  const errorMessage = error.message || "";

  const retryMatch = errorMessage.match(
    /retry in\s+([\d.]+)\s*s/i
  );

  if (retryMatch) {
    return Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000;
  }

  return null;
};

const isGeminiRateLimitError = (error) => {
  const message = error.message || "";

  return (
    error.status === 429 ||
    error.code === 429 ||
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED")
  );
};

const embedBatchWithRetry = async (
  batchTexts,
  maxRetries = MAX_EMBEDDING_RETRIES
) => {
  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      return await embedBatch(batchTexts);
    } catch (error) {
      const isRateLimit = isGeminiRateLimitError(error);

      if (!isRateLimit) {
        throw error;
      }

      if (attempt === maxRetries) {
        console.error("\n❌ Gemini retry limit exhausted.");
        throw error;
      }

      const suggestedDelay = getRetryDelay(error);

      const fallbackDelay = Math.min(
        30000 * Math.pow(2, attempt - 1),
        180000
      );

      const delay = suggestedDelay || fallbackDelay;

      console.log("\n⚠️ Gemini embedding rate limit reached.");
      console.log(`   Retry attempt: ${attempt}/${maxRetries}`);
      console.log(`   Waiting ${Math.ceil(delay / 1000)} seconds...`);

      await sleep(delay);
    }
  }

  throw new Error("GEMINI_EMBEDDING_RETRIES_EXHAUSTED");
};

/**
 * PAGE REQUEST DETECTION
 */

const detectPageRequest = (question, totalPages) => {
  const q = question.toLowerCase().trim();

  // Last page
  if (
    /\b(last|final)\s+page\b/.test(q) ||
    /\bpage\s+(last|final)\b/.test(q)
  ) {
    return {
      startPage: totalPages,
      endPage: totalPages,
    };
  }

  // First N pages
  const firstPagesMatch = q.match(
    /\b(first|beginning)\s+(\d+)\s+pages?\b/
  );

  if (firstPagesMatch) {
    return {
      startPage: 1,
      endPage: Math.min(
        Number(firstPagesMatch[2]),
        totalPages
      ),
    };
  }

  // Pages X to Y / pages from X to Y / X-Y
    // Page ranges (must explicitly mention page/pages):
  // pages 1 to 5
  // pages from 1 to 5
  // page 1 to page 5
  // from page 1 to page 5
  // page 1-5, pages 1-5
  const rangeMatch = q.match(
    /\b(?:pages?\s+(?:from\s+)?(\d+)\s*(?:to|through|thru|-|–|—)\s*(?:page\s*)?(\d+)|(?:from\s+)?page\s+(\d+)\s*(?:to|through|thru|-|–|—)\s*(?:page\s*)?(\d+))\b/i
  );

  if (rangeMatch) {
    const first = Number(rangeMatch[1] || rangeMatch[3]);
    const second = Number(rangeMatch[2] || rangeMatch[4]);

    return {
      startPage: Math.min(first, second),
      endPage: Math.max(first, second),
    };
  }

  // Single page
  const singlePageMatch = q.match(
    /\b(?:page|on page|from page)\s+(\d+)\b/
  );

  if (singlePageMatch) {
    const page = Number(singlePageMatch[1]);

    return {
      startPage: page,
      endPage: page,
    };
  }

  return null;
};

/**
 * Get chunks directly from stored PDF pages.
 * Bypasses semantic search for explicit page requests.
 */


const getChunksForPageRange = (
  pages,
  documentId,
  startPage,
  endPage
) => {
  const selectedPages = pages.filter(
    (page) =>
      page.pageNumber >= startPage &&
      page.pageNumber <= endPage &&
      page.text &&
      page.text.trim()
  );

  if (selectedPages.length === 0) {
    return [];
  }

  const chunks = chunkDocument(
    selectedPages,
    documentId.toString()
  );

  // Normalize chunks to the same structure used by Pinecone retrieval.
  return chunks.map((chunk) => ({
    text: chunk.text,
    pageNumber: chunk.metadata.pageNumber,
    chunkIndex: chunk.metadata.chunkIndex,
  }));
};


/**
 * PHASE 1: INDEX DOCUMENT
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
    const BATCH_SIZE = 6

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
        await new Promise(resolve => setTimeout(resolve, 5000))
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

const sendDirectAnswer = (res, answer) => {
  if (res.writableEnded) return;

  if (!res.headersSent) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
  }

  res.write(
    `data: ${JSON.stringify({
      text: answer,
    })}\n\n`
  );

  res.write(
    `data: ${JSON.stringify({
      done: true,
      sources: [],
      fullResponse: answer,
    })}\n\n`
  );

  res.end();

  return {
    fullResponse: answer,
    sourcePages: [],
  };
};

/**
 * PAGE COUNT QUESTION DETECTION
 */

const isPageCountQuestion = (question) => {
  return (
    /\bhow many pages?\b/i.test(question) ||
    /\b(total\s+)?number of pages?\b/i.test(question) ||
    /\bpage count\b/i.test(question) ||
    /\btotal pages?\b/i.test(question) ||
    /\bhow long is (this |the )?document\b/i.test(question) ||
    /\bpages? (does|do|is|are) (it|this|the document) have\b/i.test(question) ||
    /\bhow many pages (is|are|does|in)\b/i.test(question)
  );
};

/**
 * PHASE 2: ANSWER USER QUESTION
 */

const queryDocument = async (
  res,
  documentId,
  documentName,
  question,
  chatHistory = [],
  pageCount = null
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

    // STEP 2: Check if question is about page count — answer directly from DB
    if (isPageCountQuestion(cleanedQuestion) && pageCount != null) {
      console.log(`   ✅ Page count question detected. Answering directly: ${pageCount} pages`)
      return sendDirectAnswer(
        res,
        `This document has **${pageCount} pages** in total.`
      )
    }

    // STEP 3: Check relevance
    if (!isQuestionRelevant(cleanedQuestion)) {

      return sendErrorStream(
        res,
        'This question does not appear to be related to your document. ' +
        'I can only answer questions about the uploaded PDF.'
      )
    }

    // STEP 4: Detect explicit page request (e.g. "last page", "page 5", "pages 3-7")
    const pageRequest = detectPageRequest(cleanedQuestion, pageCount)

    if (pageRequest) {
      console.log(`\n📄 Page request detected: pages ${pageRequest.startPage}–${pageRequest.endPage}`)

      // Load pages array from MongoDB to get text for the requested page(s)
      const Document = require('../models/Document')
      const doc = await Document.findById(documentId).select('pages pageCount')

      if (doc && doc.pages && doc.pages.length > 0) {
        const pageChunks = getChunksForPageRange(
          doc.pages,
          documentId,
          pageRequest.startPage,
          pageRequest.endPage
        )

        if (pageChunks.length > 0) {
          const context = formatChunksAsContext(pageChunks)
          const formattedHistory = formatChatHistory(chatHistory)
          const sourcePages = [
            ...new Set(pageChunks.map(c => `Page ${c.pageNumber}`))
          ]

          console.log(`   Source pages: ${sourcePages.join(', ')}`)

          const fullResponse = await streamAnswer(
            res,
            documentName,
            context,
            cleanedQuestion,
            formattedHistory,
            sourcePages,
            pageCount
          )

          return { fullResponse, sourcePages }
        }
      }

      // Fall through to semantic search if page data unavailable
      console.log('   ⚠️ Page data unavailable, falling back to semantic search')
    }

    // STEP 5: Convert question to embedding
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
      sourcePages,
      pageCount
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
  if (res.writableEnded) return;

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