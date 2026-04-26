const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const {
  createConversation,
  getConversations,
  saveMessage,
  getMessages,
  deleteConversation
} = require('../controllers/chatController')

router.post('/conversations', protect, createConversation)
router.get('/conversations', protect, getConversations)
router.post('/messages', protect, saveMessage)
router.get('/messages/:conversationId', protect, getMessages)
router.delete('/conversations/:id', protect, deleteConversation)

module.exports = router