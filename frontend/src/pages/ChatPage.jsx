import { useState, useEffect } from "react";
import Sidebar from "../components/chat/Sidebar";
import ChatArea from "../components/chat/ChatArea";
import ChatInput from "../components/chat/ChatInput";
import API from "../lib/api";
import "../styles/chat.css";
import HistoryView from "../components/chat/HistoryView";

/**
 * Generate dummy AI response
 * This will be replaced with real RAG response later
 */
const getDummyResponse = (question, docName) => {
  return {
    content: `Based on "${docName}", here is what I found regarding your question: "${question}"\n\nThis is a placeholder response. The actual AI-powered answer will appear here once the RAG pipeline is connected. The response will be generated from the content of your uploaded document, ensuring accurate and relevant answers.`,
    sources: ["Page 1", "Page 3", "Page 7"],
  };
};

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
  const [chatHistories, setChatHistories] = useState({});

  // Fetch documents on load
  useEffect(() => {
    fetchDocuments();
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

  // When currentDoc changes, load its chat history
  useEffect(() => {
    if (currentDoc) {
      const docId = currentDoc._id || currentDoc.id;
      const history = chatHistories[docId] || [];
      setMessages(history);
    } else {
      setMessages([]);
    }
  }, [currentDoc]);

  const handleUpload = async (file) => {
    setUploading(true);
    setShowUpload(false);
    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const response = await API.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setCurrentDoc(response.data.document);
        setMessages([]);
        fetchDocuments();
      }
    } catch (error) {
      console.error("Upload failed:", error);
      const message =
        error.response?.data?.message || "Upload failed. Please try again.";
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (question) => {
    if (!currentDoc) {
      alert("Please upload a document first");
      return;
    }

    // Add user message
    const userMsg = {
      id: Date.now(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Show typing
    setIsTyping(true);

    // Simulate AI response (will be replaced with real RAG later)
    setTimeout(() => {
      const docName = currentDoc.originalName || currentDoc.fileName;
      const response = getDummyResponse(question, docName);

      const aiMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.content,
        sources: response.sources,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      setIsTyping(false);

      // Save to chat history
      const docId = currentDoc._id || currentDoc.id;
      setChatHistories((prev) => ({
        ...prev,
        [docId]: finalMessages,
      }));
    }, 1500);
  };

  const handleDocumentDelete = (docId) => {
    setDocuments((prev) => prev.filter((doc) => (doc._id || doc.id) !== docId));

    if (currentDoc && (currentDoc._id === docId || currentDoc.id === docId)) {
      setCurrentDoc(null);
      setMessages([]);
    }

    // Remove chat history for deleted doc
    setChatHistories((prev) => {
      const updated = { ...prev };
      delete updated[docId];
      return updated;
    });
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
            chatHistories={chatHistories}
            documents={documents}
            onSelectHistory={(doc) => {
              setCurrentDoc(doc);
              setActiveTab("chat");
            }}
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
