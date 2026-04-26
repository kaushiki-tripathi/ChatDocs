import { motion } from "framer-motion";
import toast from "react-hot-toast";
import API from "../../lib/api";
import { timeAgo } from "../../lib/utils";

const HistoryView = ({ conversations, onSelectHistory, onDeleteConversation }) => {

  const handleDelete = async (e, conversationId) => {
    e.stopPropagation();

    toast.custom(
      (t) => (
        <div style={{
          background: "#1a1a1a",
          border: "1px solid rgba(248, 113, 113, 0.3)",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          minWidth: "280px",
          fontFamily: "Outfit, sans-serif",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <div>
            <p style={{ color: "#f4f4f5", fontSize: "14px", fontWeight: 500, margin: 0 }}>
              Delete conversation?
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", margin: "4px 0 0" }}>
              This cannot be undone.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#a1a1aa",
                borderRadius: "8px",
                padding: "6px 14px",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                const deleteToast = toast.loading("Deleting...");
                try {
                  const response = await API.delete(`/chat/conversations/${conversationId}`);
                  if (response.data.success) {
                    onDeleteConversation(conversationId);
                    toast.success("Conversation deleted", {
                      id: deleteToast,
                      duration: 3000,
                    });
                  }
                } catch (error) {
                  console.error("Delete failed:", error);
                  toast.error("Failed to delete conversation", {
                    id: deleteToast,
                    duration: 4000,
                  });
                }
              }}
              style={{
                background: "rgba(248, 113, 113, 0.15)",
                border: "1px solid rgba(248, 113, 113, 0.4)",
                color: "#f87171",
                borderRadius: "8px",
                padding: "6px 14px",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: "delete-conv-confirm" } // ← prevents stacking on rapid clicks
    );
  };

  if (!conversations || conversations.length === 0) {
    return (
      <div className="chat-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center" }}
        >
          <p style={{ fontSize: "32px", marginBottom: "16px" }}>🕐</p>
          <h2 className="chat-welcome__heading">No history yet</h2>
          <p className="chat-welcome__subtext">
            Your conversations will appear here. Upload a PDF and start chatting.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="history-view">
      <div className="history-view__list">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="history-view__title"
        >
          Conversation History
        </motion.h2>

        {conversations.map((conv, index) => (
          <motion.div
            key={conv._id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="history-item"
          >
            <button
              className="history-item__select"
              onClick={() => onSelectHistory(conv)}
            >
              <div className="history-item__icon">📄</div>
              <div className="history-item__info">
                <p className="history-item__doc">
                  {conv.documentId?.originalName || "Untitled Document"}
                </p>
                <p className="history-item__question">
                  {conv.title || "New Chat"}
                </p>
              </div>
              <div className="history-item__meta">
                <span className="history-item__time">
                  {timeAgo(conv.updatedAt)}
                </span>
              </div>
            </button>

            <button
              className="history-item__delete"
              onClick={(e) => handleDelete(e, conv._id)}
              aria-label="Delete conversation"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;