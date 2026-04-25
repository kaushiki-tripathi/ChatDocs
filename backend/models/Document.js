const mongoose = require('mongoose')

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  pageCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['processing', 'ready', 'failed'],
    default: 'processing'
  },
  extractedText: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

// Compound unique index — prevents duplicate PDFs per user at the DB level.
// Even if two uploads race past the findOne() check, only one will be inserted.
documentSchema.index({ userId: 1, originalName: 1 }, { unique: true })

// Normalize originalName before every save (belt-and-suspenders with the controller)
documentSchema.pre('save', function (next) {
  if (this.originalName) {
    this.originalName = this.originalName.trim().toLowerCase()
  }
  next()
})

module.exports = mongoose.model('Document', documentSchema)