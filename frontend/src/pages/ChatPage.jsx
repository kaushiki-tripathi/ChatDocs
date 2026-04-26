import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Sidebar from "../components/chat/Sidebar";
import ChatArea from "../components/chat/ChatArea";
import ChatInput from "../components/chat/ChatInput";
import HistoryView from "../components/chat/HistoryView";
import API from "../lib/api";
import "../styles/chat.css";

/**
 * Dummy AI response (replaced with real RAG later)
 */
const getDummyResponse = (question, docName) => ({
  content: `Based on "${docName}", here is what I found regarding: "${question}"\n\nThis is a placeholder response. The actual AI-powered answer will appear here once the RAG pipeline is connected.`,
  sources: ["Page 1", "Page 3", "Page 7"],
});

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

  // When currentDoc changes, check for existing conversation
  useEffect(() => {
    if (currentDoc) {
      const docId = currentDoc._id || currentDoc.id;
      const existing = conversations.find(
        (c) => (c.documentId?._id || c.documentId) === docId,
      );
      if (existing) {
        setCurrentConversation(existing);
        loadConversationMessages(existing._id);
      } else {
        setCurrentConversation(null);
        setMessages([]);
      }
    } else {
      setCurrentConversation(null);
      setMessages([]);
    }
  }, [currentDoc]);

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
        setCurrentDoc(doc);
        setMessages([]);
        setCurrentConversation(null);
        fetchDocuments();

        toast.success(
          `${doc.originalName} uploaded · ${doc.pageCount} pages ready`,
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
      toast.error(message, { id: uploadToast });
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

    // Create conversation if none exists
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
        console.error("Failed to send message:", error);
        toast.error("Failed to send message. Try again.");
        return;
      }
    }

    // Add user message to UI
    const userMsg = {
      id: Date.now(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Save user message to backend
    try {
      await API.post("/chat/messages", {
        conversationId: convId,
        role: "user",
        content: question,
      });
    } catch (error) {
      console.error("Failed to save user message:", error);
    }

    // Show typing
    setIsTyping(true);

    // Dummy AI response (will be replaced with RAG)
    setTimeout(async () => {
      const docName = currentDoc.originalName || currentDoc.fileName;
      const response = getDummyResponse(question, docName);

      const aiMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.content,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages([...updatedMessages, aiMsg]);
      setIsTyping(false);

      // Save AI message to backend
      try {
        await API.post("/chat/messages", {
          conversationId: convId,
          role: "assistant",
          content: response.content,
          sources: response.sources,
        });
        // Refresh conversations for history
        fetchConversations();
      } catch (error) {
        console.error("Failed to save AI message:", error);
      }
    }, 1500);
  };

  const handleDocumentDelete = (docId) => {
    setDocuments((prev) => prev.filter((doc) => (doc._id || doc.id) !== docId));

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
          disabled={!currentDoc}
        />
      </main>
    </div>
  );
};

export default ChatPage;
