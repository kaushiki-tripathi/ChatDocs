
/**
 * OPENROUTER SERVICE
 *
 * Connects ChatDocs to OpenRouter's free model router.
 * Uses streaming responses and preserves the existing SSE format.
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Uses OpenRouter's dynamic free-model router.
// Can be overridden through the environment variable.
const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';



const buildSystemPrompt = (documentName) => {
  return `You are ChatDocs AI, an intelligent and friendly PDF assistant.

You are helping the user understand their uploaded document: "${documentName}".

YOUR PERSONALITY:
- Respond like a helpful, knowledgeable ChatGPT assistant.
- Be natural, conversational, clear, and engaging.
- Explain concepts in simple language.
- Be precise and avoid unnecessary details.

STRICT DOCUMENT RULES:
1. Answer using ONLY the document context provided in the user's message.
2. Never invent information or use outside knowledge.
3. Answer the exact question asked.
4. Include page references whenever relevant.
5. Ignore author names, watermarks, advertisements, URLs, and repeated headers or footers unless explicitly asked about them.
6. If information is unavailable, clearly say:
   "I couldn't find this information in your uploaded document."

RESPONSE FORMATTING:
1. Use Markdown formatting.
2. Use ## headings only when they genuinely improve readability.
3. Use **bold** for important terms.
4. Use bullet points for lists.
5. Use numbered steps for processes or procedures.
6. Use code blocks for code examples.
7. Use short paragraphs with appropriate spacing.
8. Avoid repeating the same information.
9. Do not begin every answer with "Based on the provided context."
10. Do not add unnecessary introductions or conclusions.

HOW TO HANDLE QUESTIONS:

If the user asks "What is this document about?":
Give a concise overview of the main subjects covered. Do not explain every individual topic in detail.

If the user asks "Explain [topic]":
Explain the topic clearly, step by step, using relevant examples from the document.

If the user asks for a definition:
Give the definition first, followed by a simple explanation if the context supports it.

If the user asks for differences:
Use a comparison table when the document contains enough information.

If the user asks for a summary:
Organize the main points into concise sections.

If the user asks something unrelated to the document:
Politely explain that you can only answer questions about the uploaded document.

Your goal is to make the user understand their document, not simply repeat extracted text.`;
};

const buildUserMessage = (context, question, pageCount) => {
  const pageNote = pageCount != null
    ? `\nIMPORTANT: This document has exactly ${pageCount} pages in total. Use this fact when answering questions about the document length.\n`
    : '';
  return `DOCUMENT CONTEXT:
${context}
${pageNote}
USER QUESTION:
${question}

Answer the question naturally and directly.

Use only the document context above.
Include relevant page numbers.
Do not mention irrelevant author credits, watermarks, or metadata.`;
};



const streamAnswer = async (
  res,
  documentName,
  context,
  question,
  chatHistory,
  sourcePages,
  pageCount = null
) => {
  try {
    // Validate API key
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is missing from environment variables.');
    }

    const messages = [
      { role: 'system', content: buildSystemPrompt(documentName) },
      ...chatHistory,
      { role: 'user', content: buildUserMessage(context, question, pageCount) }
    ];

    // Setup SSE headers
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
    }

    console.log(`🤖 Streaming answer from OpenRouter...`);
    console.log(`🧠 Selected model: ${MODEL}`);

    // Call OpenRouter API with streaming enabled
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://chatdocs-ai.vercel.app',
          'X-Title': 'ChatDocs AI',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          stream: true,
          temperature: 0.3,
          max_tokens: 4096
        })
      }
    );

    // Handle API errors
    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `OpenRouter API error [${response.status}]: ${errorText}`
      );
    }

    if (!response.body) {
      throw new Error('OpenRouter returned an empty response stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullResponse = '';
    let buffer = '';

    // Read streaming response
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.replace(/^data:\s*/, '');

        if (dataStr === '[DONE]') continue;

        try {
          const json = JSON.parse(dataStr);

          const text = json.choices?.[0]?.delta?.content || '';

          if (text) {
            fullResponse += text;

            // Preserve existing frontend SSE format
            res.write(
              `data: ${JSON.stringify({ text })}\n\n`
            );
          }
        } catch (parseError) {
          // Ignore malformed or incomplete SSE chunks
        }
      }
    }

    // Process any remaining buffered data
    if (buffer.trim().startsWith('data:')) {
      const dataStr = buffer.trim().replace(/^data:\s*/, '');

      if (dataStr && dataStr !== '[DONE]') {
        try {
          const json = JSON.parse(dataStr);
          const text = json.choices?.[0]?.delta?.content || '';

          if (text) {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch (parseError) {
          // Ignore incomplete final chunk
        }
      }
    }

    // Send final payload
    res.write(
      `data: ${JSON.stringify({
        done: true,
        sources: sourcePages,
        fullResponse
      })}\n\n`
    );

    res.end();

    console.log(
      `✅ OpenRouter streaming complete: ${fullResponse.length} chars`
    );

    return fullResponse;

  } catch (error) {
    console.error('❌ OpenRouter streaming error:', error);

    if (!res.writableEnded) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
      }

      res.write(
        `data: ${JSON.stringify({
          error: true,
          message: 'AI service error. Please try again.'
        })}\n\n`
      );

      res.end();
    }

    throw error;
  }
};

module.exports = { streamAnswer };
