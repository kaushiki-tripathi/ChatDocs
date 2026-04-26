const mongoose = require('mongoose')

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  title: {
    type: String,
    default: 'New Chat'
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Conversation', conversationSchema)