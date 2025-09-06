import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { parsingService } from "./services/parsingService";
import { scoringService } from "./services/scoringService";
import { exportService } from "./services/exportService";
import { aiService } from "./services/aiService";
import { 
  insertAdWeekSchema, 
  insertSourceDocSchema, 
  insertDealRowSchema,
  insertScoreSchema,
  insertExportHistorySchema,
  type ScoringWeights 
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      aiEnabled: aiService.isEnabled(),
      database: "connected",
    });
  });

  // Get all ad weeks
  app.get("/api/weeks", async (req, res) => {
    try {
      const weeks = await storage.getAdWeeks();
      res.json(weeks);
    } catch (error) {
      console.error("Error fetching weeks:", error);
      res.status(500).json({ message: "Failed to fetch weeks" });
    }
  });

  // Get specific week
  app.get("/api/weeks/:id", async (req, res) => {
    try {
      const week = await storage.getAdWeek(req.params.id);
      if (!week) {
        return res.status(404).json({ message: "Week not found" });
      }
      res.json(week);
    } catch (error) {
      console.error("Error fetching week:", error);
      res.status(500).json({ message: "Failed to fetch week" });
    }
  });

  // Create new ad week
  app.post("/api/weeks", async (req, res) => {
    try {
      const weekData = insertAdWeekSchema.parse(req.body);
      const week = await storage.createAdWeek(weekData);
      res.json(week);
    } catch (error) {
      console.error("Error creating week:", error);
      res.status(500).json({ message: "Failed to create week" });
    }
  });

  // Update week status
  app.patch("/api/weeks/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateAdWeekStatus(req.params.id, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating week status:", error);
      res.status(500).json({ message: "Failed to update week status" });
    }
  });

  // Delete ad week and all associated data
  app.delete("/api/weeks/:id", async (req, res) => {
    try {
      const weekId = req.params.id;
      
      // Check if week exists
      const week = await storage.getAdWeek(weekId);
      if (!week) {
        return res.status(404).json({ message: "Week not found" });
      }
      
      // Delete the week and all associated data
      await storage.deleteAdWeek(weekId);
      
      res.json({ success: true, message: "Week and all associated data deleted successfully" });
    } catch (error) {
      console.error("Error deleting week:", error);
      res.status(500).json({ message: "Failed to delete week" });
    }
  });

  // Get source documents for a week
  app.get("/api/weeks/:id/documents", async (req, res) => {
    try {
      const docs = await storage.getSourceDocsByWeek(req.params.id);
      res.json(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Upload files to a week
  app.post("/api/weeks/:id/upload", upload.array('files', 10), async (req, res) => {
    try {
      const adWeekId = req.params.id;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const results = [];
      
      for (const file of files) {
        try {
          // Generate file hash
          const hash = await parsingService.generateFileHash(file.path);
          
          // Parse the file first to get the kind and metadata
          const parseResult = await parsingService.parseFile(
            file.path, 
            file.originalname, 
            file.mimetype
          );

          // Create source document record with parsing metadata
          const sourceDoc = await storage.createSourceDoc({
            adWeekId,
            kind: parseResult.detectedType || 'other',
            filename: file.originalname,
            mimetype: file.mimetype,
            byteSize: file.size,
            storagePath: file.path,
            hash,
            meta: {
              parsedRows: parseResult.parsedRows,
              totalRows: parseResult.totalRows,
              errors: parseResult.errors,
              detectedType: parseResult.detectedType,
              status: parseResult.errors.length > 0 ? 'parsed_with_errors' : 'parsed',
            },
          });

          // Create deal rows from parsed data
          const dealRows = parseResult.deals.map(deal => ({
            ...deal,
            adWeekId,
            sourceDocId: sourceDoc.id,
            promoStart: deal.promoStart || null,
            promoEnd: deal.promoEnd || null,
          }));

          if (dealRows.length > 0) {
            await storage.createDealRows(dealRows);
          }

          results.push({
            file: file.originalname,
            documentId: sourceDoc.id,
            parsed: parseResult.parsedRows,
            total: parseResult.totalRows,
            errors: parseResult.errors,
            detectedType: parseResult.detectedType,
          });

        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          results.push({
            file: file.originalname,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Update week status to Parsing or Issues based on results
      const hasErrors = results.some(r => r.error || (r.errors && r.errors.length > 0));
      await storage.updateAdWeekStatus(adWeekId, hasErrors ? 'Issues' : 'Parsing');

      res.json({ results });
    } catch (error) {
      console.error("Error uploading files:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  // Get deals for a week
  app.get("/api/weeks/:id/deals", async (req, res) => {
    try {
      const deals = await storage.getDealRowsByWeek(req.params.id);
      const scores = await storage.getScoresByWeek(req.params.id);
      
      // Merge deals with scores
      const dealsWithScores = deals.map(deal => {
        const score = scores.find(s => s.dealRowId === deal.id);
        return { ...deal, score };
      });

      res.json(dealsWithScores);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  // Re-parse a single document
  app.post("/api/documents/:id/reparse", async (req, res) => {
    try {
      const docId = req.params.id;
      const doc = await storage.getSourceDoc(docId);
      
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete existing deals for this document
      await storage.deleteDealRowsByDocument(docId);
      
      // Re-parse the document
      const parseResult = await parsingService.parseFile(doc.storagePath, doc.filename, doc.mimetype);
      
      // Update document metadata
      await storage.updateSourceDoc(docId, {
        meta: {
          parsedRows: parseResult.parsedRows,
          totalRows: parseResult.totalRows,
          errors: parseResult.errors,
          detectedType: parseResult.detectedType,
          status: parseResult.errors.length > 0 ? 'parsed_with_errors' : 'parsed',
        },
      });
      
      // Create new deal rows
      const dealRows = parseResult.deals.map(deal => ({
        ...deal,
        adWeekId: doc.adWeekId,
        sourceDocId: doc.id,
        promoStart: deal.promoStart || null,
        promoEnd: deal.promoEnd || null,
      }));

      if (dealRows.length > 0) {
        await storage.createDealRows(dealRows);
      }

      res.json({
        file: doc.filename,
        reparsed: parseResult.parsedRows,
        total: parseResult.totalRows,
        errors: parseResult.errors,
      });
      
    } catch (error) {
      console.error("Error re-parsing document:", error);
      res.status(500).json({ message: "Failed to re-parse document" });
    }
  });

  // Download original document
  app.get("/api/documents/:id/download", async (req, res) => {
    try {
      const doc = await storage.getSourceDoc(req.params.id);
      
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.download(doc.storagePath, doc.filename);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Re-parse all documents for a week  
  app.post("/api/weeks/:id/reparse", async (req, res) => {
    try {
      const adWeekId = req.params.id;
      const documents = await storage.getSourceDocsByWeek(adWeekId);
      
      if (documents.length === 0) {
        return res.status(404).json({ message: "No documents found for this week" });
      }

      // Delete existing deals for this week
      await storage.deleteDealRowsByWeek(adWeekId);
      
      const results = [];
      
      for (const doc of documents) {
        try {
          // Re-parse the document
          const parseResult = await parsingService.parseFile(doc.storagePath, doc.filename, doc.mimetype);
          
          // Create new deal rows
          const dealRows = parseResult.deals.map(deal => ({
            ...deal,
            adWeekId,
            sourceDocId: doc.id,
            promoStart: deal.promoStart || null,
            promoEnd: deal.promoEnd || null,
          }));

          if (dealRows.length > 0) {
            await storage.createDealRows(dealRows);
          }

          results.push({
            file: doc.filename,
            reparsed: parseResult.parsedRows,
            total: parseResult.totalRows,
            errors: parseResult.errors,
          });
          
        } catch (error) {
          console.error(`Error re-parsing ${doc.filename}:`, error);
          results.push({
            file: doc.filename,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      res.json({ results });
    } catch (error) {
      console.error("Error re-parsing documents:", error);
      res.status(500).json({ message: "Failed to re-parse documents" });
    }
  });

  // Debug endpoint to check parsed data
  app.get("/api/weeks/:id/debug", async (req, res) => {
    try {
      const deals = await storage.getDealRowsByWeek(req.params.id);
      
      if (deals.length > 0) {
        const summary = {
          totalDeals: deals.length,
          missingCost: deals.filter(d => !d.cost).length,
          missingAdSrp: deals.filter(d => !d.adSrp).length,
          missingSrp: deals.filter(d => !d.srp).length,
          sampleDeal: {
            itemCode: deals[0].itemCode,
            description: deals[0].description,
            cost: deals[0].cost,
            srp: deals[0].srp,
            adSrp: deals[0].adSrp,
            dept: deals[0].dept,
          },
          costValues: deals.slice(0, 5).map(d => ({ itemCode: d.itemCode, cost: d.cost })),
          adSrpValues: deals.slice(0, 5).map(d => ({ itemCode: d.itemCode, adSrp: d.adSrp })),
        };
        res.json(summary);
      } else {
        res.json({ message: "No deals found" });
      }
    } catch (error) {
      console.error("Error in debug endpoint:", error);
      res.status(500).json({ message: "Failed to get debug info" });
    }
  });

  // Score all deals for a week
  app.post("/api/weeks/:id/score", async (req, res) => {
    try {
      const adWeekId = req.params.id;
      const weights: ScoringWeights = req.body.weights || undefined;
      
      // Get all deals for this week
      const deals = await storage.getDealRowsByWeek(adWeekId);
      
      if (deals.length === 0) {
        return res.status(400).json({ message: "No deals found to score" });
      }

      // Run quality gate validation
      const qualityGate = scoringService.validateQualityGate(deals);
      if (!qualityGate.passed) {
        return res.status(400).json({ 
          message: "Quality gate failed", 
          issues: qualityGate.issues 
        });
      }

      // Score each deal
      const scores = deals.map(deal => {
        const scoring = scoringService.scoreDeal(deal, weights);
        return {
          adWeekId,
          dealRowId: deal.id,
          itemCode: deal.itemCode,
          total: scoring.total,
          components: scoring.components,
          multipliers: scoring.multipliers,
          reasons: scoring.reasons,
        };
      });

      // Save scores
      await storage.createScores(scores);

      // Update week status
      await storage.updateAdWeekStatus(adWeekId, 'Scored');

      res.json({ 
        scored: scores.length,
        averageScore: scores.reduce((sum, s) => sum + s.total, 0) / scores.length,
      });

    } catch (error) {
      console.error("Error scoring deals:", error);
      res.status(500).json({ message: "Failed to score deals" });
    }
  });

  // Generate exports for a week
  app.post("/api/weeks/:id/export", async (req, res) => {
    try {
      const adWeekId = req.params.id;
      const { types } = req.body; // ['csv', 'txt', 'json']
      
      // Get deals with scores and source docs
      const deals = await storage.getDealRowsByWeek(adWeekId);
      const scores = await storage.getScoresByWeek(adWeekId);
      const sourceDocs = await storage.getSourceDocsByWeek(adWeekId);
      
      // Create lookup maps
      const scoresMap = new Map(scores.map(s => [s.dealRowId, s]));
      const sourceDocsMap = new Map(sourceDocs.map(d => [d.id, d]));
      
      // Merge data
      const dealsWithScores = deals.map(deal => ({
        ...deal,
        score: scoresMap.get(deal.id),
        sourceDoc: sourceDocsMap.get(deal.sourceDocId),
      }));

      const exports = [];
      const createdBy = 'system'; // TODO: Get from authentication

      // Generate requested export types
      if (!types || types.includes('csv')) {
        const csvResult = await exportService.generatePickListCSV(dealsWithScores, adWeekId);
        const csvExport = await storage.createExportHistory({
          adWeekId,
          createdBy,
          artifactType: 'csv',
          artifactHash: csvResult.hash,
          artifactPath: csvResult.path,
        });
        exports.push({ type: 'csv', id: csvExport.id, path: csvResult.path });
      }

      if (!types || types.includes('txt')) {
        const txtResult = await exportService.generateBuyerReportTXT(dealsWithScores, adWeekId);
        const txtExport = await storage.createExportHistory({
          adWeekId,
          createdBy,
          artifactType: 'txt',
          artifactHash: txtResult.hash,
          artifactPath: txtResult.path,
        });
        exports.push({ type: 'txt', id: txtExport.id, path: txtResult.path });
      }

      if (!types || types.includes('json')) {
        const jsonResult = await exportService.generateDesignerJSON(dealsWithScores, adWeekId);
        const jsonExport = await storage.createExportHistory({
          adWeekId,
          createdBy,
          artifactType: 'json',
          artifactHash: jsonResult.hash,
          artifactPath: jsonResult.path,
        });
        exports.push({ type: 'json', id: jsonExport.id, path: jsonResult.path });
      }

      // Update week status
      await storage.updateAdWeekStatus(adWeekId, 'Exported');

      res.json({ exports });

    } catch (error) {
      console.error("Error generating exports:", error);
      res.status(500).json({ message: "Failed to generate exports" });
    }
  });

  // Download export file
  app.get("/api/exports/:id/download", async (req, res) => {
    try {
      // TODO: Get export record and stream file
      res.status(501).json({ message: "Download endpoint not implemented yet" });
    } catch (error) {
      console.error("Error downloading export:", error);
      res.status(500).json({ message: "Failed to download export" });
    }
  });

  // Get export history for a week
  app.get("/api/weeks/:id/exports", async (req, res) => {
    try {
      const exports = await storage.getExportHistory(req.params.id);
      res.json(exports);
    } catch (error) {
      console.error("Error fetching export history:", error);
      res.status(500).json({ message: "Failed to fetch export history" });
    }
  });

  // AI endpoints (feature-flagged)
  app.post("/api/ai/explain", async (req, res) => {
    try {
      if (!aiService.isEnabled()) {
        return res.status(400).json({ message: "AI service is not enabled" });
      }

      const { reason, dealData } = req.body;
      const refinedReason = await aiService.refineExplanation(reason, dealData);
      
      res.json({ refinedReason });
    } catch (error) {
      console.error("AI explanation error:", error);
      res.status(500).json({ message: "AI explanation failed" });
    }
  });

  app.post("/api/ai/extract", async (req, res) => {
    try {
      if (!aiService.isEnabled()) {
        return res.status(400).json({ message: "AI service is not enabled" });
      }

      const { text, type } = req.body; // type: 'pdf' | 'pptx'
      
      let result;
      if (type === 'pptx') {
        const deals = await aiService.extractDealsFromPDF(text); // Using same method for both PDF and PPTX
        result = { items: deals, themes: [] };
      } else {
        const deals = await aiService.extractDealsFromPDF(text);
        result = { items: deals, themes: [] };
      }
      
      res.json(result);
    } catch (error) {
      console.error("AI extraction error:", error);
      res.status(500).json({ message: "AI extraction failed" });
    }
  });

  // AI budget status
  app.get("/api/ai/budget", async (req, res) => {
    try {
      const budget = aiService.getBudgetStatus();
      res.json(budget);
    } catch (error) {
      console.error("Error fetching AI budget:", error);
      res.status(500).json({ message: "Failed to fetch AI budget" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
