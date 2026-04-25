import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * Format timestamp to readable time
 */
const formatTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Single message bubble
 */
const MessageBubble = ({ message, index }) => {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`chat-msg ${isUser ? 'chat-msg--user' : 'chat-msg--ai'}`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="chat-msg__avatar">
          <img src="/logo.png" alt="AI" className="chat-msg__avatar-img" />
        </div>
      )}

      <div className="chat-msg__body">
        {/* Name + Time */}
        <div className="chat-msg__header">
          <span className="chat-msg__name">
            {isUser ? 'You' : 'ChatDocs'}
          </span>
          <span className="chat-msg__time">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Message Content */}
        <div className="chat-msg__content">
          <p className="chat-msg__text">{message.content}</p>
        </div>

        {/* Page References (AI only) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="chat-msg__sources">
            {message.sources.map((source, i) => (
              <span key={i} className="chat-msg__source-tag">
                {source}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/**
 * Typing indicator
 */
const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="chat-msg chat-msg--ai"
  >
    <div className="chat-msg__avatar">
      <img src="/logo.png" alt="AI" className="chat-msg__avatar-img" />
    </div>
    <div className="chat-msg__body">
      <div className="chat-msg__header">
        <span className="chat-msg__name">ChatDocs</span>
      </div>
      <div className="chat-typing">
        <div className="chat-typing__dot" />
        <div className="chat-typing__dot" />
        <div className="chat-typing__dot" />
      </div>
    </div>
  </motion.div>
)

/**
 * Chat Messages List
 */
const ChatMessages = ({ messages, isTyping }) => {
  const bottomRef = useRef(null)

  // Auto scroll to bottom when new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="chat-messages">
      <div className="chat-messages__list">
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} message={msg} index={i} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default ChatMessages