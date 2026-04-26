import { useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { formatSize, timeAgo } from "../../lib/utils";

const Sidebar = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  documents,
  currentDoc,
  setCurrentDoc,
  loadingDocs,
  onDocumentDelete,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLogout = useCallback(() => {
    toast.custom(
      (t) => (
        <div style={{
          background: "#1a1a1a",
          border: "1px solid rgb(163, 29, 29)",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          minWidth: "260px",
          fontFamily: "Outfit, sans-serif",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <div>
            <p style={{ color: "#f87171", fontSize: "14px", fontWeight: 500, margin: 0 }}>
              Sign out?
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", margin: "4px 0 0" }}>
              You'll be returned to the login page.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
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
              onClick={() => {
                toast.dismiss(t.id);
                toast("Signed out", {
                  duration: 1500,
                  style: {
                    background:"#ad4141",
                    color: "#ffff",
                    border: "1px solid rgba(251, 191, 36, 0.35)",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontFamily: "Outfit, sans-serif",
                  },
                });
                setTimeout(() => {
                  logout();
                  navigate("/");
                }, 1000);
              }}
              style={{
                background: "#8c2727",
                border: "1px solid rgba(248, 113, 113, 0.4)",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "6px 14px",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: "signout-confirm" }
    );
  }, [logout, navigate]);

  const handleNewChat = useCallback(() => {
    setCurrentDoc(null);
    onTabChange("chat");
    onClose();
  }, [setCurrentDoc, onTabChange, onClose]);

  const handleSelectDoc = useCallback(
    (doc) => {
      setCurrentDoc(doc);
      onTabChange("chat");
      onClose();
    },
    [setCurrentDoc, onTabChange, onClose]
  );

  const handleDeleteDoc = useCallback(
    async (doc) => {
      const docName = doc.originalName || doc.fileName || "this document";

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
                Delete document?
              </p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", margin: "4px 0 0" }}>
                "{docName.length > 40 ? docName.slice(0, 40) + "…" : docName}"
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
                  const deleteToast = toast.loading("Deleting document...");
                  try {
                    const { default: API } = await import("../../lib/api");
                    const docId = doc._id || doc.id;
                    const response = await API.delete(`/documents/${docId}`);
                    if (response.data.success) {
                      onDocumentDelete(docId);
                      toast.success("Document deleted", {
                        id: deleteToast,
                        duration: 3000,
                      });
                    }
                  } catch (error) {
                    console.error("Delete failed:", error);
                    toast.error("Failed to delete document", {
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
        { duration: Infinity, id: "delete-doc-confirm" }
      );
    },
    [onDocumentDelete]
  );

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "?");

  const readyDocs = documents.filter((doc) => doc.status === "ready");

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? "sidebar-overlay--visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${isOpen ? "sidebar--open" : ""}`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="sidebar__bg">
          <img src="/chat-bg.jpg" alt="" className="sidebar__bg-image" loading="lazy" />
          <div className="sidebar__bg-overlay" />
        </div>

        <div className="sidebar__content">
          {/* Header */}
          <div className="sidebar__header">
            <div className="sidebar__logo">
              <img src="/logo.png" alt="ChatDocs" className="sidebar__logo-img" loading="lazy" />
              <span className="sidebar__logo-name">ChatDocs</span>
            </div>
            <button className="sidebar__close" onClick={onClose} aria-label="Close sidebar">
              ✕
            </button>
          </div>

          {/* New Chat */}
          <button className="sidebar__btn sidebar__btn--new" onClick={handleNewChat}>
            <span className="sidebar__btn-icon">+</span>
            New Chat
          </button>

          <div className="sidebar__divider" />

          {/* Documents */}
          <div className="sidebar__section">
            <p className="sidebar__section-title">
              Documents
              {readyDocs.length > 0 && (
                <span className="sidebar__section-count">{readyDocs.length}</span>
              )}
            </p>
          </div>

          <div className="sidebar__doc-list">
            {loadingDocs ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="sidebar__doc-skeleton">
                  <div className="sidebar__doc-skeleton-icon" />
                  <div className="sidebar__doc-skeleton-text">
                    <div className="sidebar__doc-skeleton-line sidebar__doc-skeleton-line--long" />
                    <div className="sidebar__doc-skeleton-line sidebar__doc-skeleton-line--short" />
                  </div>
                </div>
              ))
            ) : readyDocs.length === 0 ? (
              <div className="sidebar__doc-empty">
                <p className="sidebar__doc-empty-text">No documents yet</p>
                <p className="sidebar__doc-empty-hint">Click + to upload a PDF</p>
              </div>
            ) : (
              readyDocs.map((doc) => {
                const isActive =
                  currentDoc?._id === doc._id || currentDoc?.id === doc.id;
                return (
                  <div
                    key={doc._id || doc.id}
                    className={`sidebar__doc-item ${isActive ? "sidebar__doc-item--active" : ""}`}
                  >
                    <button className="sidebar__doc-select" onClick={() => handleSelectDoc(doc)}>
                      <span className="sidebar__doc-icon">📄</span>
                      <div className="sidebar__doc-info">
                        <p className="sidebar__doc-name">
                          {doc.originalName || doc.fileName || "Untitled"}
                        </p>
                        <p className="sidebar__doc-meta">
                          {doc.pageCount ? `${doc.pageCount} pages` : ""}
                          {doc.pageCount && doc.fileSize ? " · " : ""}
                          {doc.fileSize ? formatSize(doc.fileSize) : ""}
                          {(doc.pageCount || doc.fileSize) && doc.createdAt ? " · " : ""}
                          {doc.createdAt ? timeAgo(doc.createdAt) : ""}
                        </p>
                      </div>
                    </button>
                    <button
                      className="sidebar__doc-delete"
                      onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc); }}
                      aria-label={`Delete ${doc.originalName}`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="sidebar__divider" />

          {/* History */}
          <button
            className={`sidebar__btn ${activeTab === "history" ? "sidebar__btn--active" : ""}`}
            onClick={() => { onTabChange("history"); onClose(); }}
          >
            <div className="sidebar__history-info">
              <span className="sidebar__history-title">History</span>
              <span className="sidebar__history-hint">View all your chats</span>
            </div>
          </button>

          {/* Footer */}
          <div className="sidebar__footer">
            <div className="sidebar__user">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user?.name || "User"}
                  className="sidebar__avatar"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              ) : (
                <div className="sidebar__avatar--placeholder">
                  {getInitial(user?.name)}
                </div>
              )}
              <div className="sidebar__user-info">
                <p className="sidebar__user-name">{user?.name || "User"}</p>
                <p className="sidebar__user-email">{user?.email || ""}</p>
              </div>
            </div>

            <button
              className="sidebar__btn sidebar__btn--logout"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <span className="sidebar__btn-icon">↩</span>
              Sign out
            </button>

            <p className="sidebar__version">Built by Kaushiki Tripathi</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;