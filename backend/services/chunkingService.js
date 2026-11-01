
/**
 * CHUNKING SERVICE
 *
 * Creates chunks independently for each actual PDF page.
 * Preserves real page numbers and Unicode characters.
 */

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/**
 * Clean extracted page text without removing Unicode.
 */
const cleanText = (text) => {
  if (!text) return '';

  return text
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
};

/**
 * Find a suitable sentence boundary.
 */
const findSentenceBoundary = (text, start, end) => {
  const section = text.slice(start, end);

  const punctuation = /[.!?।॥]\s/g;
  let match;
  let lastBoundary = -1;

  while ((match = punctuation.exec(section)) !== null) {
    if (match.index >= CHUNK_SIZE * 0.5) {
      lastBoundary = match.index + match[0].length;
    }
  }

  return lastBoundary > 0
    ? start + lastBoundary
    : end;
};

/**
 * Split one page into overlapping chunks.
 */
const chunkPage = (page, documentId, startingChunkIndex) => {
  const processed = cleanText(page.text);

  if (!processed) return [];

  const chunks = [];
  let startPos = 0;
  let chunkIndex = startingChunkIndex;

  while (startPos < processed.length) {
    let endPos = Math.min(
      startPos + CHUNK_SIZE,
      processed.length
    );

    if (endPos < processed.length) {
      endPos = findSentenceBoundary(
        processed,
        startPos,
        endPos
      );
    }

    const chunkText = processed
      .slice(startPos, endPos)
      .trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        metadata: {
          documentId: documentId.toString(),
          chunkIndex,
          pageNumber: page.pageNumber,
          startPos,
          endPos,
        },
      });

      chunkIndex++;
    }

    if (endPos >= processed.length) break;

    const nextStart = endPos - CHUNK_OVERLAP;

    startPos = nextStart > startPos
      ? nextStart
      : endPos;
  }

  return chunks;
};

/**
 * Main function.
 *
 * @param {Array} pages Actual page-by-page PDF content
 * @param {string} documentId MongoDB document ID
 */
const chunkDocument = (pages, documentId) => {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('EMPTY_DOCUMENT_PAGES');
  }

  const chunks = [];
  let nextChunkIndex = 0;

  // Sort by actual PDF page number
  const orderedPages = [...pages].sort(
    (a, b) => a.pageNumber - b.pageNumber
  );

  for (const page of orderedPages) {
    if (
      !Number.isInteger(page.pageNumber) ||
      page.pageNumber < 1
    ) {
      throw new Error('INVALID_PAGE_NUMBER');
    }

    if (!page.text || !page.text.trim()) {
      console.log(
        `⚠️ Skipping empty page ${page.pageNumber}`
      );
      continue;
    }

    const pageChunks = chunkPage(
      page,
      documentId,
      nextChunkIndex
    );

    chunks.push(...pageChunks);
    nextChunkIndex += pageChunks.length;
  }

  if (chunks.length === 0) {
    throw new Error('NO_CHUNKS_CREATED');
  }

  console.log('\n✅ Page-aware chunking completed');
  console.log(`   Pages received: ${orderedPages.length}`);
  console.log(`   Chunks created: ${chunks.length}`);

  return chunks;
};

module.exports = {
  chunkDocument,
  cleanText,
};
