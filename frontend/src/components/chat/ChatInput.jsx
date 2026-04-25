import { useState } from 'react'

const ChatInput = ({ onSend, onUploadClick, disabled }) => {
  const [message, setMessage] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  return (
    <div className="chat-bottom">
      <div className="chat-bottom__inner">
        <form onSubmit={handleSubmit} className="chat-input-wrap">

          {/* + Upload Button */}
          <button
            type="button"
            className="chat-input-upload"
            onClick={onUploadClick}
          >
            +
          </button>

          {/* Input */}
          <input
            type="text"
            className="chat-input"
            placeholder={disabled ? 'Upload a PDF to start chatting...' : 'Ask anything about your document...'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={disabled}
          />

          {/* Send */}
          <button
            type="submit"
            className="chat-input-send"
            disabled={disabled || !message.trim()}
          >
            ↑
          </button>

        </form>
        <p className="chat-bottom__note">
          Answers are based strictly on your uploaded document
        </p>
      </div>
    </div>
  )
}

export default ChatInput