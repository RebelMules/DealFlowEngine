import XLSX from 'xlsx';
import * as csv from 'csv-parse';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import path from 'path';
import fs from 'fs/promises';
import type { InsertDealRow } from '@shared/schema';
import { aiService } from './aiService';
import { parseOfficeAsync } from 'officeparser';

interface ParsedDeal {
  itemCode: string;
  description: string;
  dept: string;
  upc?: string;
  cost?: number;
  netUnitCost?: number;
  srp?: number;
  adSrp?: number;
  vendorFundingPct?: number;
  mvmt?: number;
  adScan?: number;
  tprScan?: number;
  edlcScan?: number;
  competitorPrice?: number;
  pack?: string;
  size?: string;
  promoStart?: Date;
  promoEnd?: Date;
  sourceRef?: { page?: number; yOffset?: number };
}

interface ParsingResult {
  deals: ParsedDeal[];
  totalRows: number;
  parsedRows: number;
  errors: string[];
  detectedType: string;
}

class ParsingService {
  private hasLoggedColumns = false;
  private hasLoggedPriceData = false;
  
  async parseFile(filePath: string, filename: string, mimeType: string): Promise<ParsingResult> {
    try {
      if (mimeType.includes('spreadsheet') || filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        return await this.parseExcel(filePath, filename);
      } else if (mimeType.includes('csv') || filename.endsWith('.csv')) {
        return await this.parseCSV(filePath);
      } else if (mimeType.includes('pdf')) {
        return await this.parsePDF(filePath);
      } else if (mimeType.includes('presentation') || filename.endsWith('.pptx')) {
        return await this.parsePPTX(filePath);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: [`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`],
        detectedType: 'unknown',
      };
    }
  }

  private async parseExcel(filePath: string, filename: string): Promise<ParsingResult> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Detect file type based on headers and filename
    const detectedType = this.detectExcelType(jsonData as any[][], filename);
    
    switch (detectedType) {
      case 'ad-planner':
        return this.parseAdPlanner(jsonData as any[][]);
      case 'meat-planner':
        return this.parseMeatPlanner(jsonData as any[][]);
      case 'grocery-planner':
        return this.parseGroceryPlanner(jsonData as any[][]);
      case 'produce-planner':
        return this.parseProducePlanner(jsonData as any[][]);
      case 'rolling-stock':
        return this.parseRollingStock(jsonData as any[][]);
      case 'deli-bakery-planner':
        return this.parseDeliBakeryPlanner(jsonData as any[][]);
      default:
        return await this.parseGenericExcel(jsonData as any[][], detectedType);
    }
  }

  private detectExcelType(data: any[][], filename: string): string {
    const lowerFilename = filename.toLowerCase();
    
    // Find header row by looking for item identifier keywords
    let headerRow: string[] = [];
    let headerRowIndex = -1;
    
    // Item identifier keywords that indicate a true header row
    const itemIdentifiers = ['ORDER #', 'ITEM #', 'ITEM NO', 'AWG ITEM', 'AWG', 'ITEM CODE', 'SKU', 'PRODUCT CODE'];
    
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i] && data[i].length > 2) {
        const rowHeaders = data[i].map(h => String(h || '').trim().toUpperCase());
        
        // Check if this row contains any item identifier keywords
        const hasItemIdentifier = itemIdentifiers.some(identifier => 
          rowHeaders.some(header => header.includes(identifier))
        );
        
        if (hasItemIdentifier) {
          headerRow = rowHeaders;
          headerRowIndex = i;
          break;
        }
      }
    }
    
    // Fallback to first non-empty row if no item identifier found
    if (headerRow.length === 0) {
      for (let i = 0; i < Math.min(5, data.length); i++) {
        if (data[i] && data[i].length > 3) {
          headerRow = data[i].map(h => String(h || '').trim().toUpperCase());
          break;
        }
      }
    }
    
    // Ad Planner detection
    if (headerRow.includes('ORDER #') && headerRow.includes('ITEM DESC') && 
        headerRow.includes('AD SRP') && headerRow.includes('UCOST')) {
      return 'ad-planner';
    }
    
    // Department-specific planners
    if (lowerFilename.includes('meat') && headerRow.includes('ITEM NO')) {
      return 'meat-planner';
    }
    
    if (lowerFilename.includes('grocery') && headerRow.includes('ITEM DESC')) {
      return 'grocery-planner';
    }
    
    if (lowerFilename.includes('produce') && headerRow.includes('ITEM #')) {
      return 'produce-planner';
    }
    
    // Deli and Bakery detection
    if ((lowerFilename.includes('deli') || lowerFilename.includes('bakery')) && 
        (headerRow.includes('ITEM NO') || headerRow.includes('ITEM #') || headerRow.includes('ORDER #') ||
         headerRow.includes('AWG ITEM') || headerRow.includes('AWG') || headerRow.includes('DELI'))) {
      return 'deli-bakery-planner';
    }
    
    // Rolling stock
    if (headerRow.includes('ITEM CD') && headerRow.includes('NET COST')) {
      return 'rolling-stock';
    }
    
    return 'unknown';
  }

  // Helper function to intelligently find header row
  private findHeaderRow(data: any[][], itemIdentifiers: string[]): number {
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i] && data[i].length > 2) {
        const rowHeaders = data[i].map(h => String(h || '').trim().toUpperCase());
        
        // Check if this row contains any item identifier keywords
        const hasItemIdentifier = itemIdentifiers.some(identifier => 
          rowHeaders.some(header => header.includes(identifier))
        );
        
        if (hasItemIdentifier) {
          return i;
        }
      }
    }
    return -1; // Not found
  }

  private parseAdPlanner(data: any[][]): ParsingResult {
    const deals: ParsedDeal[] = [];
    const errors: string[] = [];
    let headerRowIndex = -1;
    let headerMap: Record<string, number> = {};
    
    // Find header row using intelligent detection
    headerRowIndex = this.findHeaderRow(data, ['ORDER #', 'ITEM #', 'ITEM NO', 'AWG ITEM']);
    
    if (headerRowIndex === -1) {
      errors.push('Could not find header row with ORDER # column');
      return { deals, totalRows: data.length, parsedRows: 0, errors, detectedType: 'ad-planner' };
    }
    
    // Build header map
    const headers = data[headerRowIndex];
    headers.forEach((header, index) => {
      const cleanHeader = String(header || '').trim().toUpperCase();
      headerMap[cleanHeader] = index;
    });
    
    // Required columns
    const requiredCols = ['ORDER #', 'ITEM DESC', 'DEPT'];
    const missingCols = requiredCols.filter(col => !(col in headerMap));
    if (missingCols.length > 0) {
      errors.push(`Missing required columns: ${missingCols.join(', ')}`);
      return { deals, totalRows: data.length, parsedRows: 0, errors, detectedType: 'ad-planner' };
    }
    
    // Parse data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const orderNum = String(row[headerMap['ORDER #']] || '').trim();
      const itemDesc = String(row[headerMap['ITEM DESC']] || '').trim();
      
      // Skip if no order number or description (likely totals/headers)
      if (!orderNum || !itemDesc || itemDesc.toLowerCase().includes('total')) continue;
      
      try {
        // Handle both standard and Alliance/Hernando column variations
        const costValue = this.parseNumber(row[headerMap['COST']]);
        const ucostValue = this.parseNumber(row[headerMap['UCOST']]);
        const netUnitCostValue = this.parseNumber(row[headerMap['NET UNIT COST']]);
        
        const deal: ParsedDeal = {
          itemCode: orderNum,
          description: itemDesc,
          dept: this.normalizeDept(String(row[headerMap['DEPT']] || '')),
          upc: this.cleanUPC(String(row[headerMap['UPC']] || '')),
          cost: costValue || ucostValue,  // Use COST if available, otherwise UCOST
          netUnitCost: netUnitCostValue || ucostValue || costValue,  // Prefer NET UNIT COST, then UCOST, then COST
          srp: this.parseNumber(row[headerMap['REGSRP']]),
          adSrp: this.parseNumber(row[headerMap['AD SRP']] || row[headerMap['AD_SRP']]),
          vendorFundingPct: this.parsePercentage(row[headerMap['AMAP']]),
          mvmt: this.parseNumber(row[headerMap['MVMT']]),
          adScan: this.parseNumber(row[headerMap['ADSCAN']]),
          tprScan: this.parseNumber(row[headerMap['TPRSCAN']]),
          edlcScan: this.parseNumber(row[headerMap['EDLC SCAN']] || row[headerMap['ESCAN']]),
          pack: String(row[headerMap['PK']] || '').trim() || undefined,
          size: String(row[headerMap['SZ']] || '').trim() || undefined,
        };
        
        // Parse TPR dates if present
        const tprDates = String(row[headerMap['TPR DATES']] || '');
        if (tprDates) {
          const dateMatch = tprDates.match(/(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\/\d{2}\/\d{4})/);
          if (dateMatch) {
            deal.promoStart = new Date(dateMatch[1]);
            deal.promoEnd = new Date(dateMatch[2]);
          }
        }
        
        deals.push(deal);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      deals,
      totalRows: data.length - headerRowIndex - 1,
      parsedRows: deals.length,
      errors,
      detectedType: 'ad-planner',
    };
  }

  private parseMeatPlanner(data: any[][]): ParsingResult {
    // Similar structure to ad planner but with different column names
    const deals: ParsedDeal[] = [];
    const errors: string[] = [];
    
    // Find header and parse - simplified for brevity
    // Implementation would be similar to parseAdPlanner with different column mappings
    
    return {
      deals,
      totalRows: data.length,
      parsedRows: deals.length,
      errors,
      detectedType: 'meat-planner',
    };
  }

  private parseGroceryPlanner(data: any[][]): ParsingResult {
    // Implementation for grocery planner format
    return {
      deals: [],
      totalRows: data.length,
      parsedRows: 0,
      errors: ['Grocery planner parsing not yet implemented'],
      detectedType: 'grocery-planner',
    };
  }

  private parseProducePlanner(data: any[][]): ParsingResult {
    const deals: ParsedDeal[] = [];
    const errors: string[] = [];
    let headerRowIndex = -1;
    let headerMap: Record<string, number> = {};
    
    // Find header row using intelligent detection for produce files
    headerRowIndex = this.findHeaderRow(data, ['ITEM #', 'ITEM NO', 'ORDER #', 'PRODUCT #', 'PLU', 'SKU']);
    
    if (headerRowIndex === -1) {
      errors.push('Could not find header row with item identifier (ITEM #, PLU, etc.)');
      return { deals, totalRows: data.length, parsedRows: 0, errors, detectedType: 'produce-planner' };
    }
    
    // Build header map
    const headers = data[headerRowIndex];
    headers.forEach((header, index) => {
      const cleanHeader = String(header || '').trim().toUpperCase();
      headerMap[cleanHeader] = index;
    });
    
    // Required columns for produce
    const requiredCols = [];
    const itemCodeCol = headerMap['ITEM #'] || headerMap['ITEM NO'] || headerMap['PLU'] || headerMap['PRODUCT #'] || headerMap['ORDER #'];
    const descCol = headerMap['DESCRIPTION'] || headerMap['ITEM DESC'] || headerMap['PRODUCT NAME'] || headerMap['NAME'];
    
    if (!itemCodeCol && !descCol) {
      errors.push('Missing required columns: Item identifier and Description');
      return { deals, totalRows: data.length, parsedRows: 0, errors, detectedType: 'produce-planner' };
    }
    
    // Parse data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Get item code from various possible columns
      const itemCode = String(
        row[headerMap['ITEM #']] || 
        row[headerMap['ITEM NO']] || 
        row[headerMap['PLU']] || 
        row[headerMap['PRODUCT #']] ||
        row[headerMap['ORDER #']] || ''
      ).trim();
      
      // Get description
      const description = String(
        row[headerMap['DESCRIPTION']] || 
        row[headerMap['ITEM DESC']] || 
        row[headerMap['PRODUCT NAME']] ||
        row[headerMap['NAME']] || ''
      ).trim();
      
      // Skip if no item code or description
      if (!itemCode || !description || description.toLowerCase().includes('total')) continue;
      
      try {
        const deal: ParsedDeal = {
          itemCode,
          description,
          dept: 'Produce', // Default for produce planners
          upc: this.cleanUPC(String(row[headerMap['UPC']] || row[headerMap['PLU']] || '')),
          cost: this.parseNumber(
            row[headerMap['COST']] || 
            row[headerMap['UCOST']] || 
            row[headerMap['UNIT COST']] ||
            row[headerMap['NET COST']]
          ),
          netUnitCost: this.parseNumber(row[headerMap['NET UNIT COST']] || row[headerMap['NET COST']]),
          srp: this.parseNumber(
            row[headerMap['SRP']] || 
            row[headerMap['REGSRP']] || 
            row[headerMap['REGULAR PRICE']] ||
            row[headerMap['RETAIL']]
          ),
          adSrp: this.parseNumber(
            row[headerMap['AD SRP']] || 
            row[headerMap['AD PRICE']] || 
            row[headerMap['SALE PRICE']] ||
            row[headerMap['PROMO PRICE']]
          ),
          vendorFundingPct: this.parsePercentage(
            row[headerMap['AMAP']] || 
            row[headerMap['FUNDING']] ||
            row[headerMap['VENDOR FUNDING']]
          ),
          mvmt: this.parseNumber(
            row[headerMap['MVMT']] || 
            row[headerMap['MOVEMENT']] ||
            row[headerMap['VELOCITY']]
          ),
          adScan: this.parseNumber(row[headerMap['ADSCAN']] || row[headerMap['AD SCAN']]),
          tprScan: this.parseNumber(row[headerMap['TPRSCAN']] || row[headerMap['TPR SCAN']]),
          edlcScan: this.parseNumber(row[headerMap['EDLC SCAN']] || row[headerMap['EDLCSCAN']]),
          pack: String(row[headerMap['PACK']] || row[headerMap['PK']] || '').trim() || undefined,
          size: String(row[headerMap['SIZE']] || row[headerMap['SZ']] || '').trim() || undefined,
        };
        
        // Parse promo dates if present
        const promoDates = String(row[headerMap['PROMO DATES']] || row[headerMap['TPR DATES']] || '');
        if (promoDates) {
          const dateMatch = promoDates.match(/(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\/\d{2}\/\d{4})/);
          if (dateMatch) {
            deal.promoStart = new Date(dateMatch[1]);
            deal.promoEnd = new Date(dateMatch[2]);
          }
        }
        
        deals.push(deal);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      deals,
      totalRows: data.length - headerRowIndex - 1,
      parsedRows: deals.length,
      errors: deals.length === 0 ? ['No valid produce items found. Check file format.'] : errors,
      detectedType: 'produce-planner',
    };
  }

  private parseRollingStock(data: any[][]): ParsingResult {
    // Implementation for rolling stock format
    return {
      deals: [],
      totalRows: data.length,
      parsedRows: 0,
      errors: ['Rolling stock parsing not yet implemented'],
      detectedType: 'rolling-stock',
    };
  }

  private parseDeliBakeryPlanner(data: any[][]): ParsingResult {
    const deals: ParsedDeal[] = [];
    const errors: string[] = [];
    let headerRowIndex = -1;
    let headerMap: Record<string, number> = {};
    
    // Find header row using intelligent detection
    headerRowIndex = this.findHeaderRow(data, ['AWG ITEM', 'AWG', 'ITEM NO', 'ITEM #', 'ORDER #', 'ITEM']);
    
    if (headerRowIndex === -1) {
      errors.push('Could not find header row in deli/bakery file');
      return { deals, totalRows: data.length, parsedRows: 0, errors, detectedType: 'deli-bakery-planner' };
    }
    
    // Build header map
    const headers = data[headerRowIndex];
    headers.forEach((header, index) => {
      const cleanHeader = String(header || '').trim().toUpperCase();
      headerMap[cleanHeader] = index;
    });
    
    // Parse data rows - be flexible with column names for deli/bakery
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Look for item code in various possible columns
      const itemCode = String(
        row[headerMap['ITEM NO']] || 
        row[headerMap['ITEM #']] || 
        row[headerMap['ORDER #']] || 
        row[headerMap['ITEM']] ||
        row[headerMap['ITEM CODE']] ||
        row[headerMap['AWG ITEM']] ||
        row[headerMap['AWG']] || ''
      ).trim();
      
      // Look for description
      const description = String(
        row[headerMap['ITEM DESC']] || 
        row[headerMap['DESCRIPTION']] || 
        row[headerMap['DESC']] ||
        row[headerMap['ITEM DESCRIPTION']] ||
        row[headerMap['DELI']] ||
        row[headerMap['PACK/']] || ''
      ).trim();
      
      // Skip empty rows or totals
      if (!itemCode || !description || description.toLowerCase().includes('total')) continue;
      
      try {
        const deal: ParsedDeal = {
          itemCode,
          description,
          dept: 'Deli/Bakery', // Default department for these files
          upc: this.cleanUPC(String(row[headerMap['UPC']] || '')),
          cost: this.parseNumber(
            row[headerMap['COST']] || 
            row[headerMap['UCOST']] || 
            row[headerMap['NET COST']] ||
            row[headerMap['UNIT COST']] ||
            row[headerMap['COST/']] ||
            row[headerMap['EST.']]
          ),
          srp: this.parseNumber(
            row[headerMap['SRP']] || 
            row[headerMap['REGSRP']] || 
            row[headerMap['REG SRP']] ||
            row[headerMap['RETAIL']]
          ),
          adSrp: this.parseNumber(
            row[headerMap['AD SRP']] || 
            row[headerMap['ADSRP']] || 
            row[headerMap['AD_SRP']] ||
            row[headerMap['SALE']]
          ),
          mvmt: this.parseNumber(
            row[headerMap['MVMT']] || 
            row[headerMap['MOVEMENT']] || 
            row[headerMap['UNITS']]
          ),
          vendorFundingPct: this.parsePercentage(
            row[headerMap['FUNDING']] || 
            row[headerMap['VENDOR FUNDING']] ||
            row[headerMap['AMAP']]
          ),
        };
        
        deals.push(deal);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      deals,
      totalRows: data.length - headerRowIndex - 1,
      parsedRows: deals.length,
      errors: deals.length === 0 ? ['No valid deli/bakery items found. Check file format.'] : errors,
      detectedType: 'deli-bakery-planner',
    };
  }

  private async parseGenericExcel(data: any[][], detectedType: string): Promise<ParsingResult> {
    // First try standard parsing with generic mapper
    const deals: ParsedDeal[] = [];
    const errors: string[] = [];
    let headerRowIndex = -1;
    
    // Find header row using intelligent detection
    headerRowIndex = this.findHeaderRow(data, ['ORDER #', 'ITEM #', 'ITEM NO', 'AWG ITEM', 'AWG', 'ITEM CODE', 'SKU', 'ITEM', 'DESCRIPTION', 'COST']);
    
    if (headerRowIndex !== -1) {
      // Try standard parsing
      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        try {
          const rowObj: any = {};
          data[headerRowIndex].forEach((header, idx) => {
            if (header) rowObj[String(header).trim()] = row[idx];
          });
          
          const deal = this.mapGenericRowToDeal(rowObj);
          deals.push(deal);
        } catch (error) {
          // Row couldn't be parsed, continue
        }
      }
    }
    
    // If standard parsing failed or got few results, notify about AI availability
    if (deals.length < 5) {
      if (aiService.canProcessDocument()) {
        errors.push('Limited results from standard parsing. AI assistance is available for PDF and PowerPoint files.');
      } else {
        errors.push('Limited results from standard parsing. Enable AI by adding ANTHROPIC_API_KEY to improve parsing.');
      }
    }
    
    return {
      deals,
      totalRows: data.length - (headerRowIndex + 1),
      parsedRows: deals.length,
      errors: deals.length === 0 ? [`Unable to parse Excel format. ${aiService.isEnabled() ? 'Consider manual column mapping.' : 'Enable AI in Settings for advanced parsing.'}`] : errors,
      detectedType: detectedType || 'unknown',
    };
  }

  private async parseCSV(filePath: string): Promise<ParsingResult> {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const records: any[] = [];
    
    return new Promise((resolve) => {
      csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
      }, (err, data) => {
        if (err) {
          resolve({
            deals: [],
            totalRows: 0,
            parsedRows: 0,
            errors: [`CSV parsing error: ${err.message}`],
            detectedType: 'csv',
          });
          return;
        }
        
        // Convert CSV data to deals format
        const deals = data.map((row: any, index: number) => {
          try {
            return this.mapGenericRowToDeal(row);
          } catch (error) {
            return null;
          }
        }).filter(Boolean) as ParsedDeal[];
        
        resolve({
          deals,
          totalRows: data.length,
          parsedRows: deals.length,
          errors: [],
          detectedType: 'csv',
        });
      });
    });
  }

  private async parsePDF(filePath: string): Promise<ParsingResult> {
    // AI is automatically enabled when API keys are present
    if (!aiService.canProcessDocument()) {
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: ['PDF parsing requires AI service with valid API key. Please add ANTHROPIC_API_KEY or OPENAI_API_KEY to environment variables.'],
        detectedType: 'pdf',
      };
    }

    try {
      // Step 1: Extract text from PDF using pdf2json
      const PDFParser = (await import('pdf2json')).default;
      const pdfParser = new PDFParser();
      
      const extractedText = await new Promise<string>((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          // Extract text from the PDF data
          let text = '';
          if (pdfData && pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R) {
                    for (const r of textItem.R) {
                      if (r.T) {
                        text += decodeURIComponent(r.T) + ' ';
                      }
                    }
                  }
                }
                text += '\n';
              }
            }
          }
          resolve(text);
        });
        
        pdfParser.loadPDF(filePath);
      });
      
      console.log(`Extracted ${extractedText.length} characters from PDF`);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text could be extracted from the PDF');
      }
      
      // Step 2: Parse extracted text with AI
      const aiResult = await aiService.parseExtractedText(extractedText, path.basename(filePath), 'pdf');
      
      // Map AI results to our deal format
      const deals: ParsedDeal[] = aiResult.deals.map((deal: any) => ({
        itemCode: deal.itemCode || '',
        description: deal.description || '',
        dept: this.normalizeDept(deal.dept || ''),
        upc: this.cleanUPC(deal.upc || ''),
        cost: this.parseNumber(deal.cost),
        netUnitCost: this.parseNumber(deal.netUnitCost) || this.parseNumber(deal.cost),
        srp: this.parseNumber(deal.srp),
        adSrp: this.parseNumber(deal.adSrp),
        vendorFundingPct: this.parsePercentage(deal.vendorFundingPct) || this.parsePercentage(deal.funding),
        mvmt: this.parseNumber(deal.mvmt),
        competitorPrice: this.parseNumber(deal.competitorPrice),
        pack: deal.pack,
        size: deal.size,
        promoStart: deal.promoStart ? new Date(deal.promoStart) : undefined,
        promoEnd: deal.promoEnd ? new Date(deal.promoEnd) : undefined,
      }));
      
      return {
        deals,
        totalRows: aiResult.totalExtracted || deals.length,
        parsedRows: deals.length,
        errors: [],
        detectedType: 'pdf',
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: [`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        detectedType: 'pdf',
      };
    }
  }

  private async parsePPTX(filePath: string): Promise<ParsingResult> {
    // AI is automatically enabled when API keys are present
    if (!aiService.canProcessDocument()) {
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: ['PowerPoint parsing requires AI service with valid API key. Please add ANTHROPIC_API_KEY or OPENAI_API_KEY to environment variables.'],
        detectedType: 'pptx',
      };
    }

    try {
      // Step 1: Extract text from PowerPoint
      const extractedText = await parseOfficeAsync(filePath);
      
      console.log(`Extracted ${extractedText.length} characters from PowerPoint`);
      
      // Step 2: Parse extracted text with AI
      const aiResult = await aiService.parseExtractedText(extractedText, path.basename(filePath), 'pptx');
      
      // Map AI results to our deal format
      const deals: ParsedDeal[] = aiResult.deals.map((deal: any) => ({
        itemCode: deal.itemCode || '',
        description: deal.description || '',
        dept: this.normalizeDept(deal.dept || ''),
        upc: this.cleanUPC(deal.upc || ''),
        cost: this.parseNumber(deal.cost),
        netUnitCost: this.parseNumber(deal.netUnitCost) || this.parseNumber(deal.cost),
        srp: this.parseNumber(deal.srp),
        adSrp: this.parseNumber(deal.adSrp),
        vendorFundingPct: this.parsePercentage(deal.vendorFundingPct) || this.parsePercentage(deal.funding),
        mvmt: this.parseNumber(deal.mvmt),
        competitorPrice: this.parseNumber(deal.competitorPrice),
        pack: deal.pack,
        size: deal.size,
        promoStart: deal.promoStart ? new Date(deal.promoStart) : undefined,
        promoEnd: deal.promoEnd ? new Date(deal.promoEnd) : undefined,
      }));
      
      return {
        deals,
        totalRows: aiResult.totalExtracted || deals.length,
        parsedRows: deals.length,
        errors: [],
        detectedType: 'pptx',
      };
    } catch (error) {
      console.error('PowerPoint parsing error:', error);
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: [`PowerPoint extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        detectedType: 'pptx',
      };
    }
  }

  private mapGenericRowToDeal(row: any): ParsedDeal {
    // Log the first row to see what columns we have
    if (!this.hasLoggedColumns) {
      console.log('CSV columns found:', Object.keys(row));
      this.hasLoggedColumns = true;
    }
    
    // Generic mapping - tries common column name variations (case-insensitive)
    const findColumn = (variations: string[]): any => {
      // First try exact matches (case-insensitive)
      for (const key of Object.keys(row)) {
        const keyUpper = key.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Remove spaces/special chars
        for (const variation of variations) {
          const varUpper = variation.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (keyUpper === varUpper) {
            return row[key];
          }
        }
      }
      // Then try partial matches
      for (const key of Object.keys(row)) {
        const keyUpper = key.toUpperCase();
        for (const variation of variations) {
          if (keyUpper.includes(variation.toUpperCase())) {
            return row[key];
          }
        }
      }
      return undefined;
    };
    
    const itemCode = findColumn(['ITEM CODE', 'CODE', 'ITEM NO', 'ORDER #', 'ITEM', 'SKU', 'PRODUCT CODE', 'AWG ITEM', 'AWG']) || '';
    const description = findColumn(['DESCRIPTION', 'ITEM DESC', 'PRODUCT DESCRIPTION', 'NAME', 'PRODUCT NAME', 'DELI', 'PACK/', 'PACK']) || '';
    const dept = findColumn(['DEPARTMENT', 'DEPT', 'RETAIL DEPT', 'CATEGORY']) || '';
    
    if (!itemCode || !description) {
      throw new Error('Missing required fields');
    }
    
    // More aggressive search for cost and price fields - expanded variations
    const costRaw = findColumn([
      'COST', 'NET COST', 'UCOST', 'UNIT COST', 'CASE COST', 'WHOLESALE',
      'NETCOST', 'NET_COST', 'UNITCOST', 'UNIT_COST', 'CASECOST', 'CASE_COST',
      'WHOLESALECOST', 'WHOLESALE_COST', 'BASECOST', 'BASE_COST', 'BASE COST',
      'ITEMCOST', 'ITEM_COST', 'ITEM COST', 'PRODUCTCOST', 'PRODUCT_COST', 'PRODUCT COST',
      'COST/', 'EST.', 'EST', 'ESTIMATE', 'ESTIMATED COST'
    ]);
    
    const srpRaw = findColumn([
      'SRP', 'REGSRP', 'REGULAR PRICE', 'RETAIL', 'RETAIL PRICE', 'REG PRICE',
      'REGULARPRICE', 'REGULAR_PRICE', 'RETAILPRICE', 'RETAIL_PRICE', 'REGPRICE', 'REG_PRICE',
      'MSRP', 'LIST PRICE', 'LISTPRICE', 'LIST_PRICE', 'NORMAL PRICE', 'NORMALPRICE'
    ]);
    
    const adSrpRaw = findColumn([
      'AD_SRP', 'AD SRP', 'AD PRICE', 'SALE PRICE', 'PROMO PRICE', 'SPECIAL', 'AD',
      'ADPRICE', 'AD_PRICE', 'ADSRP', 'SALEPRICE', 'SALE_PRICE',
      'PROMOPRICE', 'PROMO_PRICE', 'SPECIALPRICE', 'SPECIAL_PRICE', 'SPECIAL PRICE',
      'PROMOTIONAL', 'PROMOTIONAL PRICE', 'PROMOTIONALPRICE', 'PROMOTIONAL_PRICE',
      'DISCOUNT PRICE', 'DISCOUNTPRICE', 'DISCOUNT_PRICE', 'OFFER PRICE', 'OFFERPRICE', 'OFFER_PRICE'
    ]);
    
    // Debug logging for first few rows
    if (!this.hasLoggedPriceData && (costRaw || srpRaw || adSrpRaw)) {
      console.log('Price data found - Cost:', costRaw, 'SRP:', srpRaw, 'Ad Price:', adSrpRaw);
      this.hasLoggedPriceData = true;
    }
    
    const cost = this.parseNumber(costRaw);
    const srp = this.parseNumber(srpRaw);
    const adSrp = this.parseNumber(adSrpRaw);
    
    // Extract net unit cost and scan fields
    const netUnitCost = this.parseNumber(findColumn([
      'NET UNIT COST', 'NETUNITCOST', 'NET_UNIT_COST', 'NUC', 
      'NET COST PER UNIT', 'UNIT NET COST', 'NETCOST/UNIT'
    ]));
    
    const adScan = this.parseNumber(findColumn([
      'ADSCAN', 'AD SCAN', 'AD_SCAN', 'SCAN AD', 'AD UNITS'
    ]));
    
    const tprScan = this.parseNumber(findColumn([
      'TPRSCAN', 'TPR SCAN', 'TPR_SCAN', 'SCAN TPR', 'TPR UNITS'
    ]));
    
    const edlcScan = this.parseNumber(findColumn([
      'EDLC SCAN', 'EDLCSCAN', 'EDLC_SCAN', 'SCAN EDLC', 'EDLC UNITS', 'EDLC'
    ]));
    
    return {
      itemCode: String(itemCode).trim(),
      description: String(description).trim(),
      dept: this.normalizeDept(String(dept)),
      cost: cost,
      netUnitCost: netUnitCost,
      srp: srp,
      adSrp: adSrp,
      adScan: adScan,
      tprScan: tprScan,
      edlcScan: edlcScan,
      upc: this.cleanUPC(String(findColumn(['UPC', 'BARCODE', 'EAN']) || '')),
      pack: String(findColumn(['PACK', 'PK', 'PACKAGE', 'CASE']) || '').trim() || undefined,
      size: String(findColumn(['SIZE', 'SZ', 'WEIGHT', 'WT']) || '').trim() || undefined,
      mvmt: this.parseNumber(findColumn(['MVMT', 'MOVEMENT', 'VELOCITY', 'UNITS'])),
      vendorFundingPct: this.parsePercentage(findColumn(['FUNDING', 'VENDOR FUNDING', 'REBATE', 'ALLOWANCE', 'AMAP'])),
    };
  }

  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    
    const numStr = String(value).replace(/[$,]/g, '');
    const num = parseFloat(numStr);
    return isNaN(num) ? undefined : num;
  }

  private parsePercentage(value: any): number | undefined {
    const num = this.parseNumber(value);
    if (num === undefined) return undefined;
    
    // If value is > 1, assume it's already a percentage (e.g., 15 = 15%)
    return num > 1 ? num / 100 : num;
  }

  private cleanUPC(upc: string): string | undefined {
    if (!upc) return undefined;
    
    // Remove all non-digits
    const digits = upc.replace(/\D/g, '');
    
    // Return if it's a reasonable UPC length (10-14 digits)
    return digits.length >= 10 && digits.length <= 14 ? digits : undefined;
  }

  private normalizeDept(dept: string): string {
    const normalized = dept.trim();
    if (!normalized) return 'Unknown';
    
    // Normalize common department names
    const deptMap: Record<string, string> = {
      'GM': 'Grocery',
      'GROC': 'Grocery',
      'GROCERY': 'Grocery',
      'MEAT': 'Meat',
      'PROD': 'Produce',
      'PRODUCE': 'Produce',
      'DELI': 'Bakery',
      'BAKERY': 'Bakery',
      'DAIRY': 'Dairy',
      'FROZEN': 'Frozen',
    };
    
    const upperDept = normalized.toUpperCase();
    return deptMap[upperDept] || this.toTitleCase(normalized);
  }

  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  generateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      
      stream.on('data', (data: any) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

export const parsingService = new ParsingService();
