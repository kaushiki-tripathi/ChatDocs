
const mongoose = require('mongoose');

// Stores the actual extracted content of each PDF page
const pageSchema = new mongoose.Schema(
  {
    pageNumber: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    pageCount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
    },

    // Existing full extracted text (kept for compatibility)
    extractedText: {
      type: String,
      default: '',
    },

    // NEW: Actual page-by-page extracted content
    pages: {
      type: [pageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate PDFs per user
documentSchema.index(
  { userId: 1, originalName: 1 },
  { unique: true }
);

// Normalize originalName before saving
documentSchema.pre('save', function () {
  if (this.originalName) {
    this.originalName = this.originalName.trim().toLowerCase();
  }
});

module.exports = mongoose.model('Document', documentSchema);
