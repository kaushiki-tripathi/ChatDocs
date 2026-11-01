const Document = require("../models/Document");
const parsePDF = require("pdf-parse");
const fs = require("fs");
const {
  indexDocument,
  deleteDocumentVectors,
} = require("../services/ragService");

const uploadDocument = async (req, res) => {
  let document;

  try {
    // 1. Validate uploaded file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF file",
      });
    }

    const normalizedName = req.file.originalname.trim().toLowerCase();

    // 2. Check duplicate document
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

    // 3. Create document with processing status
    document = await Document.create({
      userId: req.user._id,
      fileName: req.file.filename,
      originalName: normalizedName,
      fileSize: req.file.size,
      status: "processing",
    });

    // 4. Read PDF
    const dataBuffer = fs.readFileSync(req.file.path);

    // Store actual page-by-page text
    const extractedPages = [];

    // 5. Custom PDF page extraction
    const pdfData = await parsePDF(dataBuffer, {
      pagerender: async (pageData) => {
        const textContent = await pageData.getTextContent();

        let pageText = "";
        let lastY = null;

        for (const item of textContent.items) {
          if (!item.str || !item.str.trim()) continue;

          const currentY = item.transform ? item.transform[5] : null;

          // Preserve line breaks based on actual PDF positions
          if (
            lastY !== null &&
            currentY !== null &&
            Math.abs(lastY - currentY) > 2
          ) {
            pageText += "\n";
          } else if (pageText && !pageText.endsWith("\n")) {
            pageText += " ";
          }

          pageText += item.str;

          if (item.hasEOL) {
            pageText += "\n";
          }

          lastY = currentY;
        }

        const cleanedPageText = pageText
          .replace(/\r/g, "\n")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        // Page numbers are assigned in PDF extraction order
        extractedPages.push({
          pageNumber: extractedPages.length + 1,
          text: cleanedPageText,
        });

        return cleanedPageText;
      },
    });

    // 6. Validate extraction
    const pagesWithText = extractedPages.filter(
      (page) => page.text.trim().length > 0,
    );

    const combinedText = extractedPages.map((page) => page.text).join("\n\n");

    if (!combinedText || combinedText.trim().length < 50) {
      throw new Error("This PDF does not contain enough extractable text.");
    }

    console.log("\n📄 PDF extraction completed");
    console.log(`   Actual PDF pages: ${pdfData.numpages}`);
    console.log(`   Extracted pages: ${extractedPages.length}`);
    console.log(`   Pages containing text: ${pagesWithText.length}`);

    // 7. Save actual page content in MongoDB
    document.pageCount = pdfData.numpages;
    document.extractedText = combinedText;
    document.pages = extractedPages;
    document.status = "processing";

    await document.save();

    // 8. Respond to frontend
    res.status(201).json({
      success: true,
      message: "PDF uploaded. Preparing document for chat...",
      document: {
        id: document._id,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        pageCount: pdfData.numpages,
        status: "processing",
      },
    });

    console.log(`\n🚀 Starting RAG indexing: ${normalizedName}`);

    // 9. Start indexing in background
    // Keep the existing indexDocument arguments for now.
    indexDocument(document._id.toString(), document.pages)
      .then(async (result) => {
        if (!result || !result.success) {
          throw new Error("RAG indexing did not complete successfully.");
        }

        await Document.findByIdAndUpdate(document._id, {
          status: "ready",
        });

        console.log(`✅ RAG indexing complete: ${normalizedName}`);
      })
      .catch(async (error) => {
        console.error(
          `❌ RAG indexing failed: ${normalizedName}`,
          error.message,
        );

        await Document.findByIdAndUpdate(document._id, {
          status: "failed",
        });
      });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);

    if (document?._id) {
      await Document.findByIdAndUpdate(document._id, {
        status: "failed",
      }).catch((updateError) => {
        console.error("Failed to update document status:", updateError);
      });
    }

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Error processing document",
        error: error.message,
      });
    }
  }
};

const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      userId: req.user._id,
    })
      .select("-extractedText -pages")
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

    deleteDocumentVectors(req.params.id.toString()).catch((error) => {
      console.error("Failed to delete vectors:", error.message);
    });

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
    // 1. Find document and verify ownership
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

    // 2. Check if text was extracted
    if (
      !document.extractedText ||
      document.extractedText.trim().length < 50 ||
      !Array.isArray(document.pages) ||
      document.pages.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Document has no extractable text. Please re-upload.",
      });
    }

    console.log(`\n🔄 Re-indexing: ${document.originalName}`);

    // 3. Mark document as processing
    await Document.findByIdAndUpdate(document._id, {
      status: "processing",
    });

    // 4. Re-index document
    const result = await indexDocument(document._id.toString(), document.pages);

    if (!result || !result.success) {
      throw new Error("Re-indexing did not complete successfully.");
    }

    // 5. Mark document as ready after successful indexing
    await Document.findByIdAndUpdate(document._id, {
      status: "ready",
    });

    console.log(`✅ Re-indexing complete: ${document.originalName}`);

    return res.status(200).json({
      success: true,
      message: "Document re-indexed successfully",
      document: {
        id: document._id,
        originalName: document.originalName,
        pageCount: document.pageCount,
        status: "ready",
      },
    });
  } catch (error) {
    console.error("❌ Re-index failed:", error.message);

    // 6. Mark document as failed if indexing fails
    if (req.params.id) {
      await Document.findByIdAndUpdate(req.params.id, {
        status: "failed",
      }).catch((updateError) => {
        console.error("Failed to update document status:", updateError);
      });
    }

    return res.status(500).json({
      success: false,
      message: "Re-indexing failed",
      error: error.message,
    });
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  deleteDocument,
  reindexDocument,
};
