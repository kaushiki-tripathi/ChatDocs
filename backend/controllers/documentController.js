const Document = require("../models/Document");
const parsePDF = require("pdf-parse");
const fs = require("fs");
const {indexDocument, deleteDocumentVectors} = require('../services/ragService')

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF file",
      });
    }

    const normalizedName = req.file.originalname.trim().toLowerCase();

    const existingDoc = await Document.findOne({
      userId: req.user._id,
      originalName: normalizedName,
    });

    if (existingDoc) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "This document is already uploaded",
      });
    }

    const document = await Document.create({
      userId: req.user._id,
      fileName: req.file.filename,
      originalName: normalizedName, 
      fileSize: req.file.size,
      status: "processing",
    });

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await parsePDF(dataBuffer);

    await Document.findByIdAndUpdate(document._id, {
      pageCount: pdfData.numpages,
      extractedText: pdfData.text,
      status: "ready",
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded and processed successfully",
      document: {
        id: document._id,
        originalName: req.file.originalname, // show original in UI
        fileSize: req.file.size,
        pageCount: pdfData.numpages,
        status: "ready",
      },
    });console.log('\n Starting RAG indexing in background...')
    indexDocument(
      document._id.toString(),
      pdfData.text,
      pdfData.numpages
    ).then(() => {
      console.log(`RAG indexing complete for: ${normalizedName}`)
    }).catch((error) => {
      console.error(` RAG indexing failed for: ${normalizedName}`, error.message)
    })

  } catch (error) {
    console.error("UPLOAD ERROR:", error); // ← add this line
    return res.status(500).json({
      success: false,
      message: "Error processing document",
      error: error.message,
    });

  }
};

const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      userId: req.user._id,
    })
      .select("-extractedText")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching documents",
      error: error.message,
    });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const filePath = `uploads/${document.fileName}`;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Document.findByIdAndDelete(req.params.id);

    deleteDocumentVectors(req.params.id.toString())
      .catch(error => {
        console.error('Failed to delete vectors:', error.message)
      })

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting document",
      error: error.message,
    });
  }
};


const reindexDocument = async (req, res) => {
  try {
    // Find document and verify ownership
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      })
    }

    // Check if text was extracted
    if (!document.extractedText || document.extractedText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Document has no extractable text. Please re-upload.',
      })
    }

    console.log(`\n🔄 Re-indexing: ${document.originalName}`)

    // Re-index document
    await indexDocument(
      document._id.toString(),
      document.extractedText,
      document.pageCount
    )

    res.status(200).json({
      success: true,
      message: `Document re-indexed successfully`,
      document: {
        id: document._id,
        originalName: document.originalName,
        pageCount: document.pageCount,
      },
    })

  } catch (error) {
    console.error('❌ Re-index failed:', error.message)
    res.status(500).json({
      success: false,
      message: 'Re-indexing failed',
      error: error.message,
    })
  }
}


module.exports = {
  uploadDocument,
  getDocuments,
  deleteDocument,
  reindexDocument,
};