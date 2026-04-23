const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const upload = require('../config/multer')
const {
  uploadDocument,
  getDocuments,
  deleteDocument
} = require('../controllers/documentController')

router.post('/upload', protect, upload.single('pdf'), uploadDocument)
router.get('/', protect, getDocuments)
router.delete('/:id', protect, deleteDocument)

module.exports = router