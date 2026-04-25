import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import ChatMessages from './ChatMessages'

/**
 * Upload Modal
 */
const UploadModal = ({ isOpen, onClose, onUpload }) => {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0])
      onClose()
    }
  }, [onUpload, onClose])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  })

  if (!isOpen) return null

  return (
    <div className="upload-modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        <button className="upload-modal__close" onClick={onClose}>✕</button>
        <h2 className="upload-modal__title">Upload Document</h2>
        <p className="upload-modal__desc">Upload a PDF to start chatting with it</p>

        <div
          {...getRootProps()}
          className={`upload-zone ${isDragActive ? 'upload-zone--active' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="upload-zone__icon">📄</div>
          <p className="upload-zone__title">
            {isDragActive ? 'Drop your PDF here' : 'Drag and drop or click to browse'}
          </p>
          <p className="upload-zone__desc">PDF files only</p>
          <p className="upload-zone__limit">Max 10MB</p>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Welcome Screen (no messages yet)
 */
const WelcomeScreen = ({ document }) => (
  <div className="chat-center">
    <motion.h1
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="chat-welcome__heading"
    >
      What would you like to <em>know?</em>
    </motion.h1>

    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="chat-welcome__subtext"
    >
      {document
        ? `Chatting with: ${document.originalName}`
        : 'Click + to upload a PDF and start asking questions'
      }
    </motion.p>
  </div>
)

/**
 * Chat Area — shows messages or welcome screen
 */
const ChatArea = ({
  document,
  messages,
  isTyping,
  showUpload,
  onCloseUpload,
  onUpload,
}) => {
  const hasMessages = messages && messages.length > 0

  return (
    <>
      {hasMessages ? (
        <ChatMessages messages={messages} isTyping={isTyping} />
      ) : (
        <WelcomeScreen document={document} />
      )}

      <UploadModal
        isOpen={showUpload}
        onClose={onCloseUpload}
        onUpload={onUpload}
      />
    </>
  )
}

export default ChatArea