const Document = require("../models/Document");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const mongoose = require("mongoose");

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF file",
      });
    }

    // ✅ Normalize filename properly
    const normalizedName = req.file.originalname.trim().toLowerCase();

    // ✅ FIXED: Cast userId to ObjectId to guarantee type-safe query
    const userObjectId = new mongoose.Types.ObjectId(req.user._id);

    // ✅ FIXED: Exact match check with proper ObjectId type
    const existingDoc = await Document.findOne({
      userId: userObjectId,
      originalName: normalizedName,
    });

    if (existingDoc) {
      // Clean up the temp file before returning
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(409).json({
        success: false,
        message: "This document is already uploaded",
      });
    }

    const document = await Document.create({
      userId: userObjectId,
      fileName: req.file.filename,
      originalName: normalizedName, // ✅ store normalized
      fileSize: req.file.size,
      status: "processing",
    });

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

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
    });
  } catch (error) {
    // ✅ FIXED: Catch MongoDB duplicate key error (race condition safety net)
    if (error.code === 11000) {
      // Clean up the temp file on duplicate
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(409).json({
        success: false,
        message: "This document is already uploaded",
      });
    }

    res.status(500).json({
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

module.exports = {
  uploadDocument,
  getDocuments,
  deleteDocument,
};