const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const {
  createConversation,
  getConversations,
  saveMessage,
  getMessages,
  deleteConversation,
  askQuestion,
} = require('../controllers/chatController')

router.post('/conversations', protect, createConversation)
router.get('/conversations', protect, getConversations)
router.post('/messages', protect, saveMessage)
router.get('/messages/:conversationId', protect, getMessages)
router.delete('/conversations/:id', protect, deleteConversation)
router.post('/ask',protect, askQuestion)

module.exports = router