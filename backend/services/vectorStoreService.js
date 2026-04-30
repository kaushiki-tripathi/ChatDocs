/**
 * VECTOR STORE SERVICE
 *
 * Responsibility:
 * Stores chunk embeddings in ChromaDB.
 * Searches ChromaDB to find relevant chunks.
 *
 * Why ChromaDB:
 * Regular databases find exact matches only.
 * ChromaDB finds SIMILAR meanings.
 * Perfect for semantic search.
 *
 * Collections:
 * Each document gets its OWN collection.
 * Collection name = "doc_" + documentId
 * This keeps documents separate.
 * User only searches their own document.
 */

const { ChromaClient } = require('chromadb')

// Connects to ChromaDB running in memory
const client = new ChromaClient({
  path: process.env.CHROMA_URL,
})


const TOP_K = 4              // How many chunks to retrieve per question


const MIN_SIMILARITY = 0.3        // Minimum similarity score (0 to 1)
// Below this = not relevant enough


const getCollectionName = (documentId) => {
  return `doc_${documentId.toString()}`
}


const storeEmbeddings = async (documentId, chunks, embeddings) => {
  const collectionName = getCollectionName(documentId)

  try {
    // Delete existing collection if it exists
    // This handles re-upload of same document
    try {
      await client.deleteCollection({ name: collectionName, })
      console.log(`🗑️  Deleted existing collection: ${collectionName}`)
    } catch {
      // Collection did not exist, that is fine
    }

    // Create fresh collection
    const collection = await client.createCollection({
  name: collectionName,
  metadata: { documentId: documentId.toString() },
  embeddingFunction: null,
})


    // Prepare data for ChromaDB
    const ids = chunks.map((_, i) => `chunk_${i}`)
    const documents = chunks.map(chunk => chunk.text)
    const metadatas = chunks.map(chunk => ({
      documentId: chunk.metadata.documentId,
      chunkIndex: chunk.metadata.chunkIndex.toString(),
      pageNumber: chunk.metadata.pageNumber.toString(),
      startPos: chunk.metadata.startPos.toString(),
      endPos: chunk.metadata.endPos.toString(),
    }))

    // Store everything in ChromaDB
    await collection.add({
      ids,
      embeddings,
      documents,
      metadatas,
    })

    console.log(`✅ Stored ${chunks.length} chunks in ChromaDB`)
    console.log(`   Collection: ${collectionName}`)

  } catch (error) {
    console.error('❌ Failed to store embeddings:', error)
    throw new Error(`Vector store failed: ${error.message}`)
  }
}


const searchSimilarChunks = async (documentId, queryEmbedding) => {
  const collectionName = getCollectionName(documentId)

  try {
    // Get the collection for this document
    const collection = await client.getCollection({
  name: collectionName,
  embeddingFunction: null,
})

    // Search for similar chunks
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: TOP_K,
      include: ['documents', 'metadatas', 'distances']
    })

    // No results found
    if (!results.documents[0] || results.documents[0].length === 0) {
      return []
    }

    // Format results
    const chunks = results.documents[0].map((text, i) => {
      const distance = results.distances[0][i]

      // ChromaDB returns distance (lower = more similar)
      // Convert to similarity score (higher = more similar)
      const similarity = 1 - distance

      return {
        text,
        pageNumber: parseInt(results.metadatas[0][i].pageNumber) || 1,
        chunkIndex: parseInt(results.metadatas[0][i].chunkIndex) || 0,
        similarity,
      }
    })

    // Filter by minimum similarity threshold
    const relevantChunks = chunks.filter(
      chunk => chunk.similarity >= MIN_SIMILARITY
    )

    console.log(`✅ Found ${relevantChunks.length} relevant chunks`)
    relevantChunks.forEach(chunk => {
      console.log(`   Page ${chunk.pageNumber} - similarity: ${chunk.similarity.toFixed(3)}`)
    })

    return relevantChunks

  } catch (error) {
    console.error('❌ Search failed:', error)
    // Handle missing collection — document was never indexed successfully
    if (error.name === 'ChromaNotFoundError' || error.message?.includes('not found')) {
      throw new Error(
        'DOCUMENT_NOT_INDEXED'
      )
    }
    throw new Error(`Vector search failed: ${error.message}`)
  }
}

/**
 */
const deleteDocumentVectors = async (documentId) => {
  const collectionName = getCollectionName(documentId)

  try {
    await client.deleteCollection({
  name: collectionName
})
    console.log(`✅ Deleted vectors for document: ${documentId}`)
  } catch (error) {
    // Collection might not exist if indexing failed
    console.log(`ℹ️  No vectors found for document: ${documentId}`)
  }
}

module.exports = {
  storeEmbeddings,
  searchSimilarChunks,
  deleteDocumentVectors,
}