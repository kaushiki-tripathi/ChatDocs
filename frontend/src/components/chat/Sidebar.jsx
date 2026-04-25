import { useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";



/**
 * Format file size from bytes to readable string
 */
const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

/**
 * Format date to relative time
 */
const timeAgo = (date) => {
  if (!date) return "";
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
  return new Date(date).toLocaleDateString();
};

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
    logout();
    navigate("/");
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
    [setCurrentDoc, onTabChange, onClose],
  );

  const handleDeleteDoc = useCallback(async (doc) => {
  const docName = doc.originalName || doc.fileName || 'this document'
  const confirmed = window.confirm(`Delete "${docName}"?\n\nThis cannot be undone.`)

  if (!confirmed) return

  try {
    const { default: API } = await import('../../lib/api')
    const docId = doc._id || doc.id

    const response = await API.delete(`/documents/${docId}`)

    if (response.data.success) {
      // Remove from parent state
      onDocumentDelete(docId)
    }
  } catch (error) {
    console.error('Delete failed:', error)
    alert('Failed to delete document. Please try again.')
  }
}, [onDocumentDelete])

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "?");

  // Filter ready documents only
  const readyDocs = documents.filter((doc) => doc.status === "ready");

  return (
    <>
      {/* Overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? "sidebar-overlay--visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`sidebar ${isOpen ? "sidebar--open" : ""}`}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Background */}
        <div className="sidebar__bg">
          <img
            src="/chat-bg.jpg"
            alt=""
            className="sidebar__bg-image"
            loading="lazy"
          />
          <div className="sidebar__bg-overlay" />
        </div>

        <div className="sidebar__content">
          {/* ── Header ── */}
          <div className="sidebar__header">
            <div className="sidebar__logo">
              <img
                src="/logo.png"
                alt="ChatDocs"
                className="sidebar__logo-img"
                loading="lazy"
              />
              <span className="sidebar__logo-name">ChatDocs</span>
            </div>
            <button
              className="sidebar__close"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* ── New Chat ── */}
          <button
            className="sidebar__btn sidebar__btn--new"
            onClick={handleNewChat}
          >
            <span className="sidebar__btn-icon">+</span>
            New Chat
          </button>

          {/* ── My Documents Section ── */}
          
          <div className="sidebar__divider" />
          

          {/* ── Menu Items ── */}
            <div className="sidebar__section">
            <p className="sidebar__section-title">
             Documents
              {readyDocs.length > 0 && (
                <span className="sidebar__section-count">
                  {readyDocs.length}
                </span>
              )}
            </p>
          </div>

          {/* Document List */}
          <div className="sidebar__doc-list">
            {loadingDocs ? (
              /* Loading skeleton */
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="sidebar__doc-skeleton">
                    <div className="sidebar__doc-skeleton-icon" />
                    <div className="sidebar__doc-skeleton-text">
                      <div className="sidebar__doc-skeleton-line sidebar__doc-skeleton-line--long" />
                      <div className="sidebar__doc-skeleton-line sidebar__doc-skeleton-line--short" />
                    </div>
                  </div>
                ))}
              </>
            ) : readyDocs.length === 0 ? (
              /* Empty state */
              <div className="sidebar__doc-empty">
                <p className="sidebar__doc-empty-text">No documents yet</p>
                <p className="sidebar__doc-empty-hint">
                  Click + to upload a PDF
                </p>
              </div>
            ) : (
              /* Document items */
              readyDocs.map((doc) => {
                const isActive =
                  currentDoc?._id === doc._id || currentDoc?.id === doc.id;
                return (
                  <div
                    key={doc._id || doc.id}
                    className={`sidebar__doc-item ${isActive ? "sidebar__doc-item--active" : ""}`}
                  >
                    {/* Click to select */}
                    <button
                      className="sidebar__doc-select"
                      onClick={() => handleSelectDoc(doc)}
                    >
                      <span className="sidebar__doc-icon">📄</span>
                      <div className="sidebar__doc-info">
                        <p className="sidebar__doc-name">
                          {doc.originalName || doc.fileName || "Untitled"}
                        </p>
                        <p className="sidebar__doc-meta">
                          {doc.pageCount ? `${doc.pageCount} pages` : ""}
                          {doc.pageCount && doc.fileSize ? " · " : ""}
                          {doc.fileSize ? formatSize(doc.fileSize) : ""}
                          {(doc.pageCount || doc.fileSize) && doc.createdAt
                            ? " · "
                            : ""}
                          {doc.createdAt ? timeAgo(doc.createdAt) : ""}
                        </p>
                      </div>
                    </button>

                    {/* Delete button */}
                    <button
                      className="sidebar__doc-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDoc(doc);
                      }}
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

          {/* ── History Section ── */}
          <button
            className={`sidebar__btn ${activeTab === "history" ? "sidebar__btn--active" : ""}`}
            onClick={() => {
              onTabChange("history");
              onClose();
            }}
          >
            
            <div className="sidebar__history-info">
              <span className="sidebar__history-title">History</span>
              <span className="sidebar__history-hint">View all your chats</span>
            </div>
          </button>

          {/* ── Footer ── */}
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
