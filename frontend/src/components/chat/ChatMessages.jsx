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

const StreamingCursor = () => (
  <span
    style={{
      display: 'inline-block',
      width: '2px',
      height: '14px',
      background: '#a78bfa',
      marginLeft: '2px',
      verticalAlign: 'text-bottom',
      borderRadius: '1px',
      animation: 'blink 1s step-end infinite',
    }}
  />
)

/**
 * Single message bubble
 */
const MessageBubble = ({ message, index }) => {
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming

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
          {!isStreaming && (
            <span className="chat-msg__time">
              {formatTime(message.timestamp)}
            </span>
          )}
          {isStreaming && (
            <span
              style={{
                fontSize: '10px',
                color: '#a78bfa',
                fontWeight: 400,
                letterSpacing: '0.05em',
              }}
            >
              typing...
            </span>
          )}
        </div>

        {/* Message Content */}
        <div className="chat-msg__content">
          <p className="chat-msg__text">
            {message.content}
            {isStreaming && <StreamingCursor />}
          </p>
        </div>

        {/* Page References (AI only, shown after streaming done) */}
        {!isUser && !isStreaming && message.sources && message.sources.length > 0 && (
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
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
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