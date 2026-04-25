import { motion } from 'framer-motion'

/**
 * Format date to relative time
 */
const timeAgo = (date) => {
  if (!date) return ''
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago'
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago'
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago'
  return new Date(date).toLocaleDateString()
}

const HistoryView = ({ chatHistories, documents, onSelectHistory }) => {

  // Build history list from chatHistories
  const historyItems = Object.entries(chatHistories)
    .map(([docId, messages]) => {
      if (!messages || messages.length === 0) return null

      const doc = documents.find(d => (d._id || d.id) === docId)
      if (!doc) return null

      const lastMessage = messages[messages.length - 1]
      const firstQuestion = messages.find(m => m.role === 'user')

      return {
        docId,
        docName: doc.originalName || doc.fileName || 'Untitled',
        lastQuestion: firstQuestion?.content || 'No question',
        messageCount: messages.length,
        lastTime: lastMessage?.timestamp,
        doc,
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime))

  if (historyItems.length === 0) {
    return (
      <div className="chat-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center' }}
        >
          <p style={{ fontSize: '32px', marginBottom: '16px' }}>🕐</p>
          <h2 className="chat-welcome__heading">No history yet</h2>
          <p className="chat-welcome__subtext">
            Your conversations will appear here.
            Upload a PDF and start chatting.
          </p>
        </motion.div>
      </div>
    )
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

        {historyItems.map((item, index) => (
          <motion.button
            key={item.docId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="history-item"
            onClick={() => onSelectHistory(item.doc)}
          >
            <div className="history-item__icon">📄</div>
            <div className="history-item__info">
              <p className="history-item__doc">{item.docName}</p>
              <p className="history-item__question">{item.lastQuestion}</p>
            </div>
            <div className="history-item__meta">
              <span className="history-item__count">
                {item.messageCount} msgs
              </span>
              <span className="history-item__time">
                {timeAgo(item.lastTime)}
              </span>
            </div>
          </motion.button>
        ))}

      </div>
    </div>
  )
}

export default HistoryView