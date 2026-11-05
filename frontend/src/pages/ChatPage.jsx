import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Sidebar from "../components/chat/Sidebar";
import ChatArea from "../components/chat/ChatArea";
import ChatInput from "../components/chat/ChatInput";
import HistoryView from "../components/chat/HistoryView";
import API from "../lib/api";
import { streamQuestion } from "../lib/streamApi";
import "../styles/chat.css";

const ChatPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [currentDoc, setCurrentDoc] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);

  // Fetch documents on load
  useEffect(() => {
    fetchDocuments();
    fetchConversations();
  }, []);

  // Automatically check document indexing status every 5 seconds
  
useEffect(() => {
  if (!currentDoc || currentDoc.status !== "processing") {
    return;
  }

  const docId = currentDoc._id || currentDoc.id;

  const interval = setInterval(async () => {
    try {
      const response = await API.get("/documents");

      if (!response.data.success) return;

      const updatedDocs = response.data.documents;
      setDocuments(updatedDocs);

      const updatedDoc = updatedDocs.find(
        (doc) => (doc._id || doc.id) === docId
      );

      if (!updatedDoc) return;

      // Show toast only when the document status changes.
      if (
        currentDoc.status === "processing" &&
        updatedDoc.status === "ready"
      ) {
        toast.success(
          "Your PDF is ready! You can start chatting now.",
          { id: `document-ready-${docId}`, duration: 4000 }
        );
      }

      if (
        currentDoc.status === "processing" &&
        updatedDoc.status === "failed"
      ) {
        toast.error(
          "PDF indexing failed. Please try re-indexing.",
          { id: `document-failed-${docId}`, duration: 4000 }
        );
      }

      // Update state outside the notification logic.
      setCurrentDoc(updatedDoc);

    } catch (error) {
      console.error("Failed to refresh document status:", error);
    }
  }, 5000);

  return () => clearInterval(interval);
}, [currentDoc?._id, currentDoc?.id, currentDoc?.status]);


  const fetchDocuments = async () => {
    try {
      const response = await API.get("/documents");
      if (response.data.success) {
        setDocuments(response.data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await API.get("/chat/conversations");
      if (response.data.success) {
        setConversations(response.data.conversations);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  };

  const loadConversationMessages = async (conversationId) => {
    try {
      const response = await API.get(`/chat/messages/${conversationId}`);
      if (response.data.success) {
        const formatted = response.data.messages.map((msg) => ({
          id: msg._id,
          role: msg.role,
          content: msg.content,
          sources: msg.sources,
          timestamp: msg.createdAt,
        }));
        setMessages(formatted);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  // When currentDoc changes or conversations load, match current conversation
  useEffect(() => {
    if (!currentDoc) {
      setCurrentConversation(null);
      setMessages([]);
      return;
    }

    const docId = currentDoc._id || currentDoc.id;
    const existing = conversations.find(
      (c) => (c.documentId?._id || c.documentId) === docId,
    );

    if (existing) {
      if (currentConversation?._id !== existing._id) {
        setCurrentConversation(existing);
        loadConversationMessages(existing._id);
      }
    } else if (!currentConversation) {
      setMessages([]);
    }
  }, [currentDoc, conversations]);

  const handleUpload = async (file) => {
    setShowUpload(false);
    setUploading(true);

    const uploadToast = toast.loading("Uploading document...");

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const response = await API.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        const doc = response.data.document;
        // Normalize id → _id so sidebar filtering works instantly
        const normalizedDoc = { ...doc, _id: doc._id || doc.id };
        setCurrentDoc(normalizedDoc);
        setMessages([]);
        setCurrentConversation(null);
        // Optimistically add to list so sidebar updates in real time
        setDocuments((prev) => {
          const exists = prev.some(
            (d) => (d._id || d.id) === (normalizedDoc._id || normalizedDoc.id),
          );
          return exists ? prev : [normalizedDoc, ...prev];
        });
        // Also refetch from DB for full consistency
        fetchDocuments();

        toast.success(
          `${doc.originalName} uploaded · Preparing ${doc.pageCount} pages for chat`,
          {
            id: uploadToast,
            duration: 3000,
          },
        );
      }
    } catch (error) {
      console.error("Upload failed:", error);
      const message =
        error.response?.data?.message || "Upload failed. Please try again.";
      toast.error(message, { id: uploadToast, duration: 4000 });
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (question) => {
    if (!currentDoc) {
      toast("Please upload a document first", {
        icon: "⚠️",
        duration: 3000,
        style: {
          background: "#1a1a1a",
          color: "#ffffff",
          border: "1px solid rgba(251, 191, 36, 0.3)",
          borderRadius: "12px",
          fontSize: "14px",
          fontFamily: "Outfit, sans-serif",
        },
      });
      return;
    }

    const docId = currentDoc._id || currentDoc.id;
    let convId = currentConversation?._id;

    // STEP 1: Create conversation if one doesn't exist
    if (!convId) {
      try {
        const convResponse = await API.post("/chat/conversations", {
          documentId: docId,
        });

        if (convResponse.data.success) {
          convId = convResponse.data.conversation._id;
          setCurrentConversation(convResponse.data.conversation);
        }
      } catch (error) {
        console.error("Failed to create conversation:", error);
        toast.error("Failed to send message. Try again.");
        return;
      }
    }

    // STEP 2: Add user message optimistically
    const userMsg = {
      id: Date.now(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);

    // STEP 3: Show typing indicator
    setIsTyping(true);

    const aiMsgId = Date.now() + 1;
    let firstChunk = true;

    const token = localStorage.getItem("token");

    // STEP 4: Start streaming
    streamQuestion(
      convId,
      question,
      token,

      // ON CHUNK: Receive AI response
      (chunk) => {
        if (firstChunk) {
          firstChunk = false;
          setIsTyping(false);

          setMessages((prev) => [
            ...prev,
            {
              id: aiMsgId,
              role: "assistant",
              content: chunk,
              sources: [],
              timestamp: new Date(),
              isStreaming: true,
            },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? { ...msg, content: msg.content + chunk }
                : msg,
            ),
          );
        }
      },

      // ON DONE: Finalize AI response
      async ({ fullResponse, sources }) => {
        setIsTyping(false);

        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === aiMsgId);
          if (exists) {
            return prev.map((msg) =>
              msg.id === aiMsgId
                ? {
                    ...msg,
                    content: fullResponse || msg.content,
                    sources: sources || [],
                    isStreaming: false,
                  }
                : msg,
            );
          }
          return [
            ...prev,
            {
              id: aiMsgId,
              role: "assistant",
              content: fullResponse || "",
              sources: sources || [],
              timestamp: new Date(),
              isStreaming: false,
            },
          ];
        });

        fetchConversations();
      },

      // ON ERROR: Handle backend and streaming errors
      (errorMessage, errorCode) => {
        setIsTyping(false);

        // Document is still being indexed
        if (errorCode === "DOCUMENT_PROCESSING") {
          setMessages((prev) => prev.filter((msg) => msg.id !== userMsg.id));

          toast(
            "Your PDF is still being prepared. Please wait until indexing is complete.",
            {
              icon: "⏳",
              duration: 4000,
              style: {
                background: "#1a1a1a",
                color: "#ffffff",
                border: "1px solid rgba(167, 139, 250, 0.3)",
                borderRadius: "12px",
                fontSize: "14px",
                fontFamily: "Outfit, sans-serif",
              },
            },
          );

          return;
        }

        // Document indexing failed
        if (
          errorCode === "DOCUMENT_INDEXING_FAILED" ||
          errorCode === "DOCUMENT_NOT_READY"
        ) {
          setMessages((prev) => prev.filter((msg) => msg.id !== userMsg.id));

          toast.error(errorMessage, {
            duration: 4000,
          });

          return;
        }

        // Other errors: display inside assistant message
        setMessages((prev) => {
          const alreadyExists = prev.find((msg) => msg.id === aiMsgId);

          if (alreadyExists) {
            return prev.map((msg) =>
              msg.id === aiMsgId
                ? {
                    ...msg,
                    content: errorMessage,
                    isStreaming: false,
                  }
                : msg,
            );
          }

          return [
            ...prev,
            {
              id: aiMsgId,
              role: "assistant",
              content: errorMessage,
              sources: [],
              timestamp: new Date(),
              isStreaming: false,
            },
          ];
        });
      },
    );
  };

  const handleDocumentDelete = (docId) => {
    setDocuments((prev) => prev.filter((doc) => (doc._id || doc.id) !== docId));
    setConversations((prev) =>
      prev.filter(
        (conv) => (conv.documentId?._id || conv.documentId) !== docId,
      ),
    );

    if (currentDoc && (currentDoc._id === docId || currentDoc.id === docId)) {
      setCurrentDoc(null);
      setMessages([]);
      setCurrentConversation(null);
    }
  };

  const handleConversationDelete = (conversationId) => {
    setConversations((prev) =>
      prev.filter((conv) => conv._id !== conversationId),
    );
  };

  const handleSelectHistory = (conversation) => {
    const doc = documents.find(
      (d) =>
        (d._id || d.id) ===
        (conversation.documentId?._id || conversation.documentId),
    );

    if (doc) {
      setCurrentDoc(doc);
      setCurrentConversation(conversation);
      loadConversationMessages(conversation._id);
      setActiveTab("chat");
    } else {
      toast.error("This document is no longer available.");
    }
  };

  const handleNewChat = () => {
    setCurrentDoc(null);
    setCurrentConversation(null);
    setMessages([]);
    setActiveTab("chat");
  };

  return (
    <div className="chat-page">
      {/* Background */}
      <div className="chat-bg">
        <img src="/chat-bg.jpg" alt="" className="chat-bg__image" />
        <div className="chat-bg__overlay" />
      </div>

      {/* Menu Button */}
      <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
        ☰
      </button>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        documents={documents}
        currentDoc={currentDoc}
        setCurrentDoc={setCurrentDoc}
        loadingDocs={loadingDocs}
        onDocumentDelete={handleDocumentDelete}
      />

      {/* Main */}
      <main className="chat-main">
        {uploading ? (
          <div className="chat-center">
            <div
              style={{
                width: 40,
                height: 40,
                border: "2px solid rgba(167,139,250,0.15)",
                borderTopColor: "#a78bfa",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ color: "#c4b5fd", fontSize: "14px" }}>
              Processing your document...
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: "12px",
                marginTop: "6px",
              }}
            >
              Extracting text and preparing AI
            </p>
          </div>
        ) : activeTab === "history" ? (
          <HistoryView
            conversations={conversations}
            onSelectHistory={handleSelectHistory}
            onDeleteConversation={handleConversationDelete}
          />
        ) : (
          <ChatArea
            document={currentDoc}
            messages={messages}
            isTyping={isTyping}
            showUpload={showUpload}
            onCloseUpload={() => setShowUpload(false)}
            onUpload={handleUpload}
          />
        )}

        {/* Bottom Input */}
        <ChatInput
          onSend={handleSend}
          onUploadClick={() => setShowUpload(true)}
          disabled={!currentDoc || isTyping || currentDoc.status !== "ready"}
        />
      </main>
    </div>
  );
};

export default ChatPage;
