const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const upload = require('../config/multer')
const {
  uploadDocument,
  getDocuments,
  deleteDocument,
  reindexDocument,
} = require('../controllers/documentController')

router.post('/upload', protect, upload.single('pdf'), uploadDocument)
router.get('/', protect, getDocuments)
router.delete('/:id', protect, deleteDocument)

// Temporary route for re-indexing existing documents
// Remove after all documents are indexed
router.post('/reindex/:id', protect, reindexDocument)

module.exports = router