
/**
 * RAG SERVICE
 *
 * Page-aware document indexing and retrieval.
 * - Indexes individual PDF pages.
 * - Retrieves exact pages/ranges directly.
 * - Answers page-count questions from MongoDB.
 * - Uses Pinecone for normal semantic questions.
 * - Preserves Gemini retry and batch settings.
 */

const { chunkDocument } = require("./chunkingService");
const { embedText, embedBatch } = require("./embeddingService");

const {
  storeEmbeddings,
  searchSimilarChunks,
  deleteDocumentVectors,
} = require("./vectorStoreService");

const {
  cleanQuery,
  formatChatHistory,
  formatChunksAsContext,
  isQuestionRelevant,
} = require("./queryService");

const { streamAnswer } = require("./openRouterService");
const Document = require("../models/Document");

// Gemini configuration
const BATCH_SIZE = 5;
const BATCH_DELAY = 5000;
const MAX_EMBEDDING_RETRIES = 5;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
  const rangeMatch = q.match(
    /\bpages?\s+(?:from\s+)?(\d+)\s*(?:to|through|thru|-|–|—)\s*(?:page\s*)?(\d+)\b/
  );

  if (rangeMatch) {
    const first = Number(rangeMatch[1]);
    const second = Number(rangeMatch[2]);

    return {
      startPage: Math.min(first, second),
      endPage: Math.max(first, second),
    };
  }

  // From page X to page Y
  const fromToMatch = q.match(
    /\bfrom\s+page\s+(\d+)\s+to\s+page\s+(\d+)\b/
  );

  if (fromToMatch) {
    const first = Number(fromToMatch[1]);
    const second = Number(fromToMatch[2]);

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
 * indexDocument(documentId, pages)
 */

const indexDocument = async (documentId, pages) => {
  console.log("\n🚀 Starting page-aware document indexing...");
  console.log(`   Document ID: ${documentId}`);
  console.log(`   Total extracted pages: ${pages?.length || 0}`);

  try {
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error("EMPTY_DOCUMENT");
    }

    const totalCharacters = pages.reduce(
      (total, page) =>
        total + (page.text?.length || 0),
      0
    );

    console.log(
      `   Total text length: ${totalCharacters} characters`
    );

    if (totalCharacters < 50) {
      throw new Error("EMPTY_DOCUMENT");
    }

    // STEP 1: Chunk individual pages
    console.log("\n📄 Step 1: Chunking individual pages...");

    const chunks = chunkDocument(
      pages,
      documentId.toString()
    );

    if (!chunks || chunks.length === 0) {
      throw new Error("NO_CHUNKS_CREATED");
    }

    console.log(`   Created ${chunks.length} chunks.`);

    // STEP 2: Embed and store in batches
    console.log(
      `\n🔢 Step 2: Embedding in batches of ${BATCH_SIZE}...`
    );

    let totalStored = 0;

    for (
      let batchStart = 0;
      batchStart < chunks.length;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(
        batchStart + BATCH_SIZE,
        chunks.length
      );

      const batchChunks = chunks.slice(
        batchStart,
        batchEnd
      );

      const batchTexts = batchChunks.map(
        (chunk) => chunk.text
      );

      const batchNumber =
        Math.floor(batchStart / BATCH_SIZE) + 1;

      console.log(
        `\n   Batch ${batchNumber}: chunks ${batchStart + 1}-${batchEnd}`
      );

      // STEP 3: Generate embeddings with retry
      const batchEmbeddings = await embedBatchWithRetry(
        batchTexts
      );

      // STEP 4: Store embeddings in Pinecone
      await storeEmbeddings(
        documentId,
        batchChunks,
        batchEmbeddings
      );

      totalStored += batchChunks.length;

      console.log(
        `   ✅ Stored ${totalStored}/${chunks.length} chunks`
      );

      // Preserve 15-second delay
      if (batchEnd < chunks.length) {
        console.log(
          `   ⏳ Waiting ${BATCH_DELAY / 1000} seconds...`
        );

        await sleep(BATCH_DELAY);
      }
    }

    console.log("\n✅ Page-aware indexing complete!");

    return {
      success: true,
      chunksCount: totalStored,
    };
  } catch (error) {
    console.error(
      "\n❌ Document indexing failed:",
      error.message
    );

    throw error;
  }
};

/**
 * SSE ERROR RESPONSE
 */

const sendErrorStream = (res, message) => {
  if (res.writableEnded) return;

  if (!res.headersSent) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
  }

  res.write(
    `data: ${JSON.stringify({
      text: message,
    })}\n\n`
  );

  res.write(
    `data: ${JSON.stringify({
      done: true,
      sources: [],
      fullResponse: message,
      isError: true,
    })}\n\n`
  );

  res.end();
};

/**
 * DIRECT ANSWER RESPONSE
 *
 * Used for factual metadata such as total page count.
 * Does not call OpenRouter.
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
};

/**
 * PAGE COUNT QUESTION DETECTION
 */

const isPageCountQuestion = (question) => {
  return (
    /\bhow many pages?\b/i.test(question) ||
    /\b(total\s+)?number of pages?\b/i.test(question) ||
    /\bpage count\b/i.test(question) ||
    /\btotal pages?\b/i.test(question)
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
  chatHistory = []
) => {
  console.log("\n🔍 Processing question...");
  console.log(`   Question: "${question}"`);
  console.log(`   Document: ${documentName}`);

  try {
    // STEP 1: Clean question
    let cleanedQuestion;

    try {
      cleanedQuestion = cleanQuery(question);
    } catch (error) {
      if (error.message === "EMPTY_QUESTION") {
        return sendErrorStream(res, "Please type a question.");
      }

      if (error.message === "QUESTION_TOO_SHORT") {
        return sendErrorStream(
          res,
          "Question is too short. Please be more specific."
        );
      }

      if (error.message === "QUESTION_TOO_LONG") {
        return sendErrorStream(
          res,
          "Question is too long. Please shorten it."
        );
      }

      throw error;
    }

    // STEP 2: Load document and verify status
    const doc = await Document.findById(documentId)
      .select("pages pageCount extractedText status");

    if (!doc) {
      return sendErrorStream(
        res,
        "Document not found. Please upload it again."
      );
    }

    if (doc.status !== "ready") {
      return sendErrorStream(
        res,
        "Your document is not ready yet. Please wait for indexing to finish."
      );
    }

    // STEP 3: Answer page-count questions directly
    if (isPageCountQuestion(cleanedQuestion)) {
      const totalPages = Number(doc.pageCount);

      if (!Number.isFinite(totalPages) || totalPages < 1) {
        return sendErrorStream(
          res,
          "I couldn't determine the total page count of this document."
        );
      }

      const answer =
        `Your document contains **${totalPages} pages**.`;

      console.log(
        `📄 Direct page-count answer: ${totalPages}`
      );

      return sendDirectAnswer(res, answer);
    }

    // STEP 4: Check relevance for other questions
    if (!isQuestionRelevant(cleanedQuestion)) {
      return sendErrorStream(
        res,
        "This question does not appear to be related to your document. I can only answer questions about the uploaded PDF."
      );
    }

    // STEP 5: Detect explicit page requests
    const pageRequest = detectPageRequest(
      cleanedQuestion,
      doc.pageCount
    );

    let relevantChunks = [];
    let retrievalType = "semantic";

    if (pageRequest) {
      retrievalType = "page";

      const { startPage, endPage } = pageRequest;

      console.log(
        `\n📖 Direct page retrieval: ${startPage}-${endPage}`
      );

      if (
        startPage < 1 ||
        endPage > doc.pageCount ||
        startPage > endPage
      ) {
        return sendErrorStream(
          res,
          `Please provide a valid page range between 1 and ${doc.pageCount}.`
        );
      }

      relevantChunks = getChunksForPageRange(
        doc.pages || [],
        documentId,
        startPage,
        endPage
      );

      if (relevantChunks.length === 0) {
        return sendErrorStream(
          res,
          `I couldn't extract readable text from pages ${startPage}-${endPage}. This may be an image-only or scanned section of the PDF.`
        );
      }
    } else {
      // STEP 6: Normal topic-based semantic search
      console.log("\n🔢 Embedding question...");

      const questionEmbedding = await embedText(
        cleanedQuestion,
        "RETRIEVAL_QUERY"
      );

      console.log("\n🔍 Searching Pinecone...");

      try {
        relevantChunks = await searchSimilarChunks(
          documentId,
          questionEmbedding
        );
      } catch (searchError) {
        if (
          searchError.message !== "DOCUMENT_NOT_INDEXED"
        ) {
          throw searchError;
        }

        console.log(
          "\n🔄 Document vectors missing. Re-indexing..."
        );

        if (!doc.pages || doc.pages.length === 0) {
          return sendErrorStream(
            res,
            "This document has no stored page text. Please delete and re-upload it."
          );
        }

        // Show progress through SSE
        if (!res.headersSent) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders();
        }

        res.write(
          `data: ${JSON.stringify({
            text: "⏳ Re-indexing your document. Please wait...\n\n",
          })}\n\n`
        );

        await indexDocument(
          doc._id.toString(),
          doc.pages
        );

        console.log(
          "✅ Re-index complete. Retrying search..."
        );

        relevantChunks = await searchSimilarChunks(
          documentId,
          questionEmbedding
        );
      }
    }

    // STEP 7: Check retrieval result
    if (
      !relevantChunks ||
      relevantChunks.length === 0
    ) {
      return sendErrorStream(
        res,
        "I could not find relevant information in your document. Try rephrasing your question."
      );
    }

    // STEP 8: Format context
    console.log("\n📝 Formatting context...");

    const context = formatChunksAsContext(
      relevantChunks
    );

    const formattedHistory = formatChatHistory(
      chatHistory
    );

    const sourcePages = [
      ...new Set(
        relevantChunks.map(
          (chunk) => `Page ${chunk.pageNumber}`
        )
      ),
    ].sort((a, b) => {
      return (
        Number(a.replace("Page ", "")) -
        Number(b.replace("Page ", ""))
      );
    });

    console.log(`   Retrieval type: ${retrievalType}`);
    console.log(`   Context length: ${context.length}`);
    console.log(`   Source pages: ${sourcePages.join(", ")}`);

    // STEP 9: Stream answer
    console.log("\n🤖 Streaming answer from OpenRouter...");

    const fullResponse = await streamAnswer(
      res,
      documentName,
      context,
      cleanedQuestion,
      formattedHistory,
      sourcePages
    );

    return {
      fullResponse,
      sourcePages,
    };
  } catch (error) {
    console.error(
      "\n❌ Query failed:",
      error.message
    );

    if (error.message === "DOCUMENT_NOT_INDEXED") {
      return sendErrorStream(
        res,
        "This document has not been indexed yet. Please try re-indexing it."
      );
    }

    return sendErrorStream(
      res,
      "Something went wrong. Please try again."
    );
  }
};

module.exports = {
  indexDocument,
  queryDocument,
  deleteDocumentVectors,
};
