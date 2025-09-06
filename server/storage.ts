import { 
  type AdWeek, 
  type InsertAdWeek,
  type SourceDoc,
  type InsertSourceDoc,
  type DealRow,
  type InsertDealRow,
  type Score,
  type InsertScore,
  type ExportHistory,
  type InsertExportHistory,
  adWeeks,
  sourceDocs,
  dealRows,
  scores,
  exportHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  // AdWeek operations
  getAdWeeks(): Promise<AdWeek[]>;
  getAdWeek(id: string): Promise<AdWeek | undefined>;
  createAdWeek(adWeek: InsertAdWeek): Promise<AdWeek>;
  updateAdWeekStatus(id: string, status: string): Promise<void>;
  deleteAdWeek(id: string): Promise<void>;
  
  // SourceDoc operations
  getSourceDocsByWeek(adWeekId: string): Promise<SourceDoc[]>;
  getSourceDoc(id: string): Promise<SourceDoc | undefined>;
  createSourceDoc(sourceDoc: InsertSourceDoc): Promise<SourceDoc>;
  updateSourceDoc(id: string, updates: Partial<InsertSourceDoc>): Promise<void>;
  
  // DealRow operations
  getDealRowsByWeek(adWeekId: string): Promise<DealRow[]>;
  getDealRow(id: string): Promise<DealRow | undefined>;
  createDealRow(dealRow: InsertDealRow): Promise<DealRow>;
  createDealRows(dealRows: InsertDealRow[]): Promise<DealRow[]>;
  deleteDealRowsByWeek(adWeekId: string): Promise<void>;
  deleteDealRowsByDocument(sourceDocId: string): Promise<void>;
  
  // Score operations
  getScoresByWeek(adWeekId: string): Promise<Score[]>;
  getScoreByDealRow(dealRowId: string): Promise<Score | undefined>;
  createScore(score: InsertScore): Promise<Score>;
  createScores(scores: InsertScore[]): Promise<Score[]>;
  
  // Export operations
  getExportHistory(adWeekId: string): Promise<ExportHistory[]>;
  createExportHistory(exportHist: InsertExportHistory): Promise<ExportHistory>;
}

export class DatabaseStorage implements IStorage {
  async getAdWeeks(): Promise<AdWeek[]> {
    return await db.select().from(adWeeks).orderBy(desc(adWeeks.year), desc(adWeeks.week));
  }

  async getAdWeek(id: string): Promise<AdWeek | undefined> {
    const [adWeek] = await db.select().from(adWeeks).where(eq(adWeeks.id, id));
    return adWeek || undefined;
  }

  async createAdWeek(insertAdWeek: InsertAdWeek): Promise<AdWeek> {
    const [adWeek] = await db
      .insert(adWeeks)
      .values(insertAdWeek)
      .returning();
    return adWeek;
  }

  async updateAdWeekStatus(id: string, status: string): Promise<void> {
    await db
      .update(adWeeks)
      .set({ status })
      .where(eq(adWeeks.id, id));
  }

  async getSourceDocsByWeek(adWeekId: string): Promise<SourceDoc[]> {
    return await db
      .select()
      .from(sourceDocs)
      .where(eq(sourceDocs.adWeekId, adWeekId))
      .orderBy(asc(sourceDocs.createdAt));
  }

  async getSourceDoc(id: string): Promise<SourceDoc | undefined> {
    const [sourceDoc] = await db.select().from(sourceDocs).where(eq(sourceDocs.id, id));
    return sourceDoc || undefined;
  }

  async createSourceDoc(insertSourceDoc: InsertSourceDoc): Promise<SourceDoc> {
    const [sourceDoc] = await db
      .insert(sourceDocs)
      .values(insertSourceDoc)
      .returning();
    return sourceDoc;
  }

  async updateSourceDoc(id: string, updates: Partial<InsertSourceDoc>): Promise<void> {
    await db
      .update(sourceDocs)
      .set(updates)
      .where(eq(sourceDocs.id, id));
  }

  async getDealRowsByWeek(adWeekId: string): Promise<DealRow[]> {
    return await db
      .select()
      .from(dealRows)
      .where(eq(dealRows.adWeekId, adWeekId))
      .orderBy(asc(dealRows.itemCode));
  }

  async getDealRow(id: string): Promise<DealRow | undefined> {
    const [dealRow] = await db.select().from(dealRows).where(eq(dealRows.id, id));
    return dealRow || undefined;
  }

  async createDealRow(insertDealRow: InsertDealRow): Promise<DealRow> {
    const [dealRow] = await db
      .insert(dealRows)
      .values(insertDealRow)
      .returning();
    return dealRow;
  }

  async createDealRows(insertDealRows: InsertDealRow[]): Promise<DealRow[]> {
    const createdRows = await db
      .insert(dealRows)
      .values(insertDealRows)
      .returning();
    return createdRows;
  }

  async deleteDealRowsByWeek(adWeekId: string): Promise<void> {
    await db
      .delete(dealRows)
      .where(eq(dealRows.adWeekId, adWeekId));
  }

  async deleteDealRowsByDocument(sourceDocId: string): Promise<void> {
    await db
      .delete(dealRows)
      .where(eq(dealRows.sourceDocId, sourceDocId));
  }

  async getScoresByWeek(adWeekId: string): Promise<Score[]> {
    return await db
      .select()
      .from(scores)
      .where(eq(scores.adWeekId, adWeekId))
      .orderBy(desc(scores.total));
  }

  async getScoreByDealRow(dealRowId: string): Promise<Score | undefined> {
    const [score] = await db.select().from(scores).where(eq(scores.dealRowId, dealRowId));
    return score || undefined;
  }

  async createScore(insertScore: InsertScore): Promise<Score> {
    const [score] = await db
      .insert(scores)
      .values(insertScore)
      .returning();
    return score;
  }

  async createScores(insertScores: InsertScore[]): Promise<Score[]> {
    const createdScores = await db
      .insert(scores)
      .values(insertScores)
      .returning();
    return createdScores;
  }

  async getExportHistory(adWeekId: string): Promise<ExportHistory[]> {
    return await db
      .select()
      .from(exportHistory)
      .where(eq(exportHistory.adWeekId, adWeekId))
      .orderBy(desc(exportHistory.createdAt));
  }

  async createExportHistory(insertExportHistory: InsertExportHistory): Promise<ExportHistory> {
    const [exportHist] = await db
      .insert(exportHistory)
      .values(insertExportHistory)
      .returning();
    return exportHist;
  }

  async deleteAdWeek(id: string): Promise<void> {
    // Delete in order: scores, dealRows, sourceDocs, exportHistory, then adWeek
    // This ensures referential integrity is maintained
    
    // Delete all scores for this week
    await db.delete(scores).where(eq(scores.adWeekId, id));
    
    // Delete all deal rows for this week
    await db.delete(dealRows).where(eq(dealRows.adWeekId, id));
    
    // Delete all source documents for this week
    await db.delete(sourceDocs).where(eq(sourceDocs.adWeekId, id));
    
    // Delete all export history for this week
    await db.delete(exportHistory).where(eq(exportHistory.adWeekId, id));
    
    // Finally delete the week itself
    await db.delete(adWeeks).where(eq(adWeeks.id, id));
  }
}

export const storage = new DatabaseStorage();
