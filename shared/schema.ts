import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  integer, 
  real, 
  timestamp, 
  json, 
  boolean,
  uuid
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Ad Weeks table
export const adWeeks = pgTable("ad_weeks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  week: integer("week").notNull(), // ISO week number
  label: varchar("label", { length: 50 }).notNull(), // e.g., "2025-W26"
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("Inbox"), // Inbox | Parsing | Issues | Scored | Exported
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Source Documents table
export const sourceDocs = pgTable("source_docs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adWeekId: uuid("ad_week_id").notNull().references(() => adWeeks.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 50 }).notNull(), // base-planner | dept-planner | group-buy-pdf | sales-plan-pptx | rolling-stock | other
  vendor: varchar("vendor", { length: 100 }),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimetype: varchar("mimetype", { length: 100 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  hash: varchar("hash", { length: 64 }).notNull(),
  pageCount: integer("page_count"),
  meta: json("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Deal Rows table (canonical deal data)
export const dealRows = pgTable("deal_rows", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adWeekId: uuid("ad_week_id").notNull().references(() => adWeeks.id, { onDelete: "cascade" }),
  sourceDocId: uuid("source_doc_id").notNull().references(() => sourceDocs.id, { onDelete: "cascade" }),
  itemCode: varchar("item_code", { length: 50 }).notNull(),
  description: text("description").notNull(),
  dept: varchar("dept", { length: 50 }).notNull(),
  upc: varchar("upc", { length: 20 }),
  cost: real("cost"),
  srp: real("srp"), // regular selling price
  adSrp: real("ad_srp"), // advertised selling price
  vendorFundingPct: real("vendor_funding_pct"),
  mvmt: real("mvmt"), // movement multiplier
  competitorPrice: real("competitor_price"),
  pack: varchar("pack", { length: 20 }),
  size: varchar("size", { length: 50 }),
  promoStart: timestamp("promo_start"),
  promoEnd: timestamp("promo_end"),
  sourceRef: json("source_ref"), // {page?: number, yOffset?: number}
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scores table
export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adWeekId: uuid("ad_week_id").notNull().references(() => adWeeks.id, { onDelete: "cascade" }),
  dealRowId: uuid("deal_row_id").notNull().references(() => dealRows.id, { onDelete: "cascade" }),
  itemCode: varchar("item_code", { length: 50 }).notNull(),
  total: real("total").notNull(),
  components: json("components").notNull(), // ScoreComponents
  multipliers: json("multipliers").notNull(), // Multipliers
  reasons: json("reasons").notNull(), // string[]
  refinedReason: text("refined_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Calls table (for tracking AI usage)
export const aiCalls = pgTable("ai_calls", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adWeekId: uuid("ad_week_id").references(() => adWeeks.id),
  sourceDocId: uuid("source_doc_id").references(() => sourceDocs.id),
  kind: varchar("kind", { length: 20 }).notNull(), // extract | map | explain
  provider: varchar("provider", { length: 20 }).notNull(), // anthropic | openai
  model: varchar("model", { length: 50 }).notNull(),
  promptHash: varchar("prompt_hash", { length: 64 }).notNull(),
  tokensIn: integer("tokens_in").notNull(),
  tokensOut: integer("tokens_out").notNull(),
  costUsd: real("cost_usd").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // ok | error | budget_exceeded
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Proposed Rows table
export const aiProposedRows = pgTable("ai_proposed_rows", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adWeekId: uuid("ad_week_id").notNull().references(() => adWeeks.id, { onDelete: "cascade" }),
  sourceDocId: uuid("source_doc_id").notNull().references(() => sourceDocs.id, { onDelete: "cascade" }),
  payload: json("payload").notNull(),
  confidence: real("confidence"),
  approved: boolean("approved").default(false).notNull(),
  approvedBy: varchar("approved_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Outcomes table (for ML training)
export const outcomes = pgTable("outcomes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adWeekId: uuid("ad_week_id").notNull().references(() => adWeeks.id, { onDelete: "cascade" }),
  itemCode: varchar("item_code", { length: 50 }).notNull(),
  units: integer("units"),
  salesUsd: real("sales_usd"),
  realizedMarginPct: real("realized_margin_pct"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Export History table
export const exportHistory = pgTable("export_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adWeekId: uuid("ad_week_id").notNull().references(() => adWeeks.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  artifactType: varchar("artifact_type", { length: 20 }).notNull(), // csv | txt | json
  artifactHash: varchar("artifact_hash", { length: 64 }).notNull(),
  artifactPath: varchar("artifact_path", { length: 500 }),
  meta: json("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const adWeeksRelations = relations(adWeeks, ({ many }) => ({
  sourceDocs: many(sourceDocs),
  dealRows: many(dealRows),
  scores: many(scores),
  exportHistory: many(exportHistory),
}));

export const sourceDocsRelations = relations(sourceDocs, ({ one, many }) => ({
  adWeek: one(adWeeks, {
    fields: [sourceDocs.adWeekId],
    references: [adWeeks.id],
  }),
  dealRows: many(dealRows),
}));

export const dealRowsRelations = relations(dealRows, ({ one, many }) => ({
  adWeek: one(adWeeks, {
    fields: [dealRows.adWeekId],
    references: [adWeeks.id],
  }),
  sourceDoc: one(sourceDocs, {
    fields: [dealRows.sourceDocId],
    references: [sourceDocs.id],
  }),
  scores: many(scores),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  adWeek: one(adWeeks, {
    fields: [scores.adWeekId],
    references: [adWeeks.id],
  }),
  dealRow: one(dealRows, {
    fields: [scores.dealRowId],
    references: [dealRows.id],
  }),
}));

// Insert schemas
export const insertAdWeekSchema = createInsertSchema(adWeeks).omit({
  id: true,
  createdAt: true,
}).extend({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

export const insertSourceDocSchema = createInsertSchema(sourceDocs).omit({
  id: true,
  createdAt: true,
});

export const insertDealRowSchema = createInsertSchema(dealRows).omit({
  id: true,
  createdAt: true,
});

export const insertScoreSchema = createInsertSchema(scores).omit({
  id: true,
  createdAt: true,
});

export const insertExportHistorySchema = createInsertSchema(exportHistory).omit({
  id: true,
  createdAt: true,
});

// Types
export type AdWeek = typeof adWeeks.$inferSelect;
export type InsertAdWeek = z.infer<typeof insertAdWeekSchema>;

export type SourceDoc = typeof sourceDocs.$inferSelect;
export type InsertSourceDoc = z.infer<typeof insertSourceDocSchema>;

export type DealRow = typeof dealRows.$inferSelect;
export type InsertDealRow = z.infer<typeof insertDealRowSchema>;

export type Score = typeof scores.$inferSelect;
export type InsertScore = z.infer<typeof insertScoreSchema>;

export type AiCall = typeof aiCalls.$inferSelect;
export type Outcome = typeof outcomes.$inferSelect;
export type ExportHistory = typeof exportHistory.$inferSelect;
export type InsertExportHistory = z.infer<typeof insertExportHistorySchema>;

// Scoring interfaces
export interface ScoreComponents {
  margin: number;
  velocity: number;
  funding: number;
  theme: number;
  timing: number;
  competitive: number;
}

export interface Multipliers {
  newItem: number;
  seasonal: number;
  strategic: number;
  historical: number;
  privateLabel?: number;
}

export interface ScoringWeights {
  margin: number;
  velocity: number;
  funding: number;
  theme: number;
  timing: number;
  competitive: number;
}
