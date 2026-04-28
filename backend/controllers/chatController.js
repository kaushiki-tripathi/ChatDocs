const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const Document = require('../models/Document')
const {queryDocument} = require('../services/ragService')

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

// Main AI endpoint

const askQuestion = async (req, res) => {
  const { conversationId, question } = req.body

  try {

    // STEP 1: Validate inputs
    if (!conversationId || !question) {
      return res.status(400).json({
        success: false,
        message: 'conversationId and question are required'
      })
    }

    // STEP 2: Find conversation and verify ownership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user._id
    }).populate('documentId')

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      })
    }

    // STEP 3: Get document details
    const document = conversation.documentId

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      })
    }

    const documentId = document._id.toString()
    const documentName = document.originalName || document.fileName

    // STEP 4: Get recent chat history for context awareness
    const recentMessages = await Message.find({
      conversationId
    })
    .sort({ createdAt: -1 })
    .limit(6)

    // Reverse to get chronological order
    const chatHistory = recentMessages.reverse()

    // STEP 5: Save user message to database
    await Message.create({
      conversationId,
      role: 'user',
      content: question,
      sources: []
    })

    // Update conversation title if first message
    const messageCount = await Message.countDocuments({ conversationId })
    if (messageCount === 1) {
      await Conversation.findByIdAndUpdate(conversationId, {
        title: question.slice(0, 60)
      })
    }

    // STEP 6: Stream answer via RAG pipeline
    // ragService handles everything:
    // clean question → search ChromaDB → stream Groq answer
    // It also saves the AI response after streaming completes
    const ragResult = await queryDocument(
      res,
      documentId,
      documentName,
      question,
      chatHistory
    )

    // STEP 7: Save AI response to MongoDB after streaming
    if (ragResult && ragResult.fullResponse) {
      await Message.create({
        conversationId,
        role: 'assistant',
        content: ragResult.fullResponse,
        sources: ragResult.sourcePages || [],
      })

      console.log('✅ AI response saved to MongoDB')
    }
    
    // Update conversation timestamp
    await Conversation.findByIdAndUpdate(conversationId, {
      updatedAt: new Date()
    })

  } catch (error) {
    console.error('❌ askQuestion error:', error)

    // Only send error if headers not already sent
    // (streaming might have already started)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error processing question',
        error: error.message
      })
    }
  }
}

module.exports = {
  createConversation,
  getConversations,
  saveMessage,
  getMessages,
  deleteConversation,
  askQuestion,
}