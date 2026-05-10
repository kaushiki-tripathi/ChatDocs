const index = require("../config/pinecone");

const TOP_K = 30;
const MIN_SIMILARITY = 0.3;

const storeEmbeddings = async (documentId, chunks, embeddings) => {
  try {
    const vectors = chunks.map((chunk, i) => ({
      id: `${documentId}_chunk_${chunk.metadata.chunkIndex}`,
      values: embeddings[i],
      metadata: {
        documentId: documentId.toString(),
        text: chunk.text,
        pageNumber: chunk.metadata.pageNumber,
        chunkIndex: chunk.metadata.chunkIndex,
      },
    }));

    console.log(`📤 Upserting ${vectors.length} vectors to Pinecone...`);
    console.log(`   First vector ID: ${vectors[0]?.id}, dimensions: ${vectors[0]?.values?.length}`);

    await index.upsert({ records: vectors });

    console.log(`✅ Stored ${vectors.length} vectors in Pinecone`);
  } catch (error) {
    console.error("❌ Failed to store embeddings:", error);
    throw new Error(`Vector store failed: ${error.message}`);
  }
};

const searchSimilarChunks = async (documentId, queryEmbedding) => {
  try {
    console.log(`🔍 Querying Pinecone for documentId: ${documentId}, embedding dimensions: ${queryEmbedding?.length}`);

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: TOP_K,
      includeMetadata: true,
      filter: {
        documentId: documentId.toString(),
      },
    });

    console.log(`   Raw matches from Pinecone: ${queryResponse.matches?.length || 0}`);

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      return [];
    }

    // Log scores to help debug similarity threshold
    queryResponse.matches.forEach((match, i) => {
      console.log(`   Match ${i}: score=${match.score}, id=${match.id}`);
    });

    const relevantChunks = queryResponse.matches
      .map((match) => ({
        text: match.metadata.text,
        pageNumber: match.metadata.pageNumber || 1,
        chunkIndex: match.metadata.chunkIndex || 0,
        similarity: match.score,
      }))
      .filter((chunk) => chunk.similarity >= MIN_SIMILARITY);

    console.log(`✅ Found ${relevantChunks.length} relevant chunks (after filtering >= ${MIN_SIMILARITY})`);

    return relevantChunks;
  } catch (error) {
    console.error("❌ Search failed:", error);
    throw new Error(`Vector search failed: ${error.message}`);
  }
};

const deleteDocumentVectors = async (documentId) => {
  try {
    // Delete all vectors matching the documentId in a single operation
    await index.deleteMany({ 
      filter: { 
        documentId: documentId.toString() 
      } 
    });

    console.log(`✅ Deleted vectors for document: ${documentId}`);
  } catch (error) {
    console.error(`❌ Failed to delete vectors for document: ${documentId}`, error);
  }
};

module.exports = {
  storeEmbeddings,
  searchSimilarChunks,
  deleteDocumentVectors,
};
