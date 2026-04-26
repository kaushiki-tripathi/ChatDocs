const Conversation = require('../models/Conversation')
const Message = require('../models/Message')

/**
 * Create new conversation
 */
const createConversation = async (req, res) => {
  try {
    const { documentId } = req.body

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: 'Document ID is required'
      })
    }

    const conversation = await Conversation.create({
      userId: req.user._id,
      documentId,
      title: 'New Chat'
    })

    res.status(201).json({
      success: true,
      conversation
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating conversation',
      error: error.message
    })
  }
}

/**
 * Get all conversations for current user
 */
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      userId: req.user._id
    })
    .populate('documentId', 'originalName fileName')
    .sort({ updatedAt: -1 })

    res.status(200).json({
      success: true,
      conversations
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    })
  }
}

/**
 * Save a message to conversation
 */
const saveMessage = async (req, res) => {
  try {
    const { conversationId, role, content, sources } = req.body

    if (!conversationId || !role || !content) {
      return res.status(400).json({
        success: false,
        message: 'conversationId, role, and content are required'
      })
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user._id
    })

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      })
    }

    const message = await Message.create({
      conversationId,
      role,
      content,
      sources: sources || []
    })

    // Update conversation title with first user question
    if (role === 'user') {
      const messageCount = await Message.countDocuments({ conversationId })
      if (messageCount === 1) {
        await Conversation.findByIdAndUpdate(conversationId, {
          title: content.slice(0, 60)
        })
      }
    }

    // Update conversation timestamp
    await Conversation.findByIdAndUpdate(conversationId, {
      updatedAt: new Date()
    })

    res.status(201).json({
      success: true,
      message
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error saving message',
      error: error.message
    })
  }
}

/**
 * Get all messages for a conversation
 */
const getMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      userId: req.user._id
    })

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      })
    }

    const messages = await Message.find({
      conversationId: req.params.conversationId
    }).sort({ createdAt: 1 })

    res.status(200).json({
      success: true,
      messages
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    })
  }
}

/**
 * Delete a conversation and its messages
 */
const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id
    })

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      })
    }

    await Message.deleteMany({ conversationId: req.params.id })
    await Conversation.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully'
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting conversation',
      error: error.message
    })
  }
}

module.exports = {
  createConversation,
  getConversations,
  saveMessage,
  getMessages,
  deleteConversation
}