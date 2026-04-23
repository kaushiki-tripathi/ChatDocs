const Document = require('../models/Document')
const pdfParse = require('pdf-parse')
const fs = require('fs')

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a PDF file'
      })
    }

    const document = await Document.create({
      userId: req.user._id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      status: 'processing'
    })

    const dataBuffer = fs.readFileSync(req.file.path)
    const pdfData = await pdfParse(dataBuffer)

    await Document.findByIdAndUpdate(document._id, {
      pageCount: pdfData.numpages,
      extractedText: pdfData.text,
      status: 'ready'
    })

    res.status(201).json({
      success: true,
      message: 'Document uploaded and processed successfully',
      document: {
        id: document._id,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        pageCount: pdfData.numpages,
        status: 'ready'
      }
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing document',
      error: error.message
    })
  }
}

const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      userId: req.user._id
    }).select('-extractedText').sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: documents.length,
      documents
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching documents',
      error: error.message
    })
  }
}

const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    })

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      })
    }

    const filePath = `uploads/${document.fileName}`
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    await Document.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting document',
      error: error.message
    })
  }
}

module.exports = {
  uploadDocument,
  getDocuments,
  deleteDocument
}