/**
 * STREAM API
 * Handles Server-Sent Events (SSE) from backend.
 */

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ conversationId, question }),
    });

    // Handle backend errors returned before SSE streaming begins
    if (!response.ok) {
      let errorData = {};

      try {
        errorData = await response.json();
      } catch {
        // Response wasn't JSON
      }

      onError(
        errorData.message || `Request failed (${response.status})`,
        errorData.code || "REQUEST_FAILED"
      );

      return;
    }

    if (!response.body) {
      onError("Streaming is not supported by this response.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);

          if (data.error) {
            onError(
              data.message || "Something went wrong",
              data.code || "STREAM_ERROR"
            );
            return;
          }

          if (data.done) {
            onDone({
              fullResponse: data.fullResponse,
              sources: data.sources || [],
            });
            return;
          }

          if (data.text) {
            onChunk(data.text);
          }
        } catch {
          // Skip malformed JSON events
        }
      }
    }
  } catch (error) {
    console.error("Stream error:", error);
    onError("Connection failed. Please try again.", "CONNECTION_ERROR");
  }
};

export { streamQuestion };