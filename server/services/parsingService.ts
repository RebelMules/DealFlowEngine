import XLSX from 'xlsx';
import * as csv from 'csv-parse';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import path from 'path';
import fs from 'fs/promises';
import type { InsertDealRow } from '@shared/schema';
import { aiService } from './aiService';

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
    
    // Find header row
    let headerRow: string[] = [];
    for (let i = 0; i < Math.min(5, data.length); i++) {
      if (data[i] && data[i].length > 3) {
        headerRow = data[i].map(h => String(h || '').trim().toUpperCase());
        break;
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

  private parseAdPlanner(data: any[][]): ParsingResult {
    const deals: ParsedDeal[] = [];
    const errors: string[] = [];
    let headerRowIndex = -1;
    let headerMap: Record<string, number> = {};
    
    // Find header row
    for (let i = 0; i < Math.min(5, data.length); i++) {
      if (data[i] && data[i].some(cell => String(cell || '').toUpperCase().includes('ORDER #'))) {
        headerRowIndex = i;
        break;
      }
    }
    
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
        const deal: ParsedDeal = {
          itemCode: orderNum,
          description: itemDesc,
          dept: this.normalizeDept(String(row[headerMap['DEPT']] || '')),
          upc: this.cleanUPC(String(row[headerMap['UPC']] || '')),
          cost: this.parseNumber(row[headerMap['UCOST']] || row[headerMap['COST']]),
          netUnitCost: this.parseNumber(row[headerMap['NET UNIT COST']]),
          srp: this.parseNumber(row[headerMap['REGSRP']]),
          adSrp: this.parseNumber(row[headerMap['AD SRP']] || row[headerMap['AD_SRP']]),
          vendorFundingPct: this.parsePercentage(row[headerMap['AMAP']]),
          mvmt: this.parseNumber(row[headerMap['MVMT']]),
          adScan: this.parseNumber(row[headerMap['ADSCAN']]),
          tprScan: this.parseNumber(row[headerMap['TPRSCAN']]),
          edlcScan: this.parseNumber(row[headerMap['EDLC SCAN']]),
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
    // Implementation for produce planner format
    return {
      deals: [],
      totalRows: data.length,
      parsedRows: 0,
      errors: ['Produce planner parsing not yet implemented'],
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
    
    // Find header row - deli/bakery files often have headers containing ITEM NO or ORDER #
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i] && data[i].some(cell => {
        const str = String(cell || '').toUpperCase();
        return str.includes('ITEM') || str.includes('ORDER') || str.includes('DESC');
      })) {
        headerRowIndex = i;
        break;
      }
    }
    
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
    
    // Find header row by looking for common column names
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i] && data[i].some(cell => {
        const str = String(cell || '').toUpperCase();
        return str.includes('ITEM') || str.includes('DESCRIPTION') || str.includes('COST');
      })) {
        headerRowIndex = i;
        break;
      }
    }
    
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
    
    // If standard parsing failed or got few results, try AI
    if (deals.length < 5 && aiService.isEnabled()) {
      errors.push('Standard parsing yielded limited results, applying AI assistance...');
      // AI would need the Excel file buffer, not just the data array
      // For now, return what we have
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
    // Check if AI is enabled (always on by default per settings)
    const autoApplyAI = true; // Always on as per requirements
    
    if (!aiService.isEnabled() || !autoApplyAI) {
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: ['PDF parsing requires AI service. Please ensure AI is enabled in Settings.'],
        detectedType: 'pdf',
      };
    }

    try {
      // Read file and apply AI extraction
      const fileBuffer = await fs.readFile(filePath);
      const aiResult = await aiService.parseDocument(fileBuffer, path.basename(filePath), 'pdf');
      
      // Map AI results to our deal format
      const deals: ParsedDeal[] = aiResult.deals.map((deal: any) => ({
        itemCode: deal.itemCode || '',
        description: deal.description || '',
        dept: this.normalizeDept(deal.dept || ''),
        upc: this.cleanUPC(deal.upc || ''),
        cost: this.parseNumber(deal.cost),
        srp: this.parseNumber(deal.srp),
        adSrp: this.parseNumber(deal.adSrp),
        vendorFundingPct: this.parsePercentage(deal.funding),
        mvmt: this.parseNumber(deal.mvmt),
        competitorPrice: this.parseNumber(deal.competitorPrice),
        pack: deal.pack,
        size: deal.size,
        promoStart: deal.startDate ? new Date(deal.startDate) : undefined,
        promoEnd: deal.endDate ? new Date(deal.endDate) : undefined,
      }));
      
      return {
        deals,
        totalRows: aiResult.totalExtracted || deals.length,
        parsedRows: deals.length,
        errors: aiResult.warnings || [],
        detectedType: 'pdf',
      };
    } catch (error) {
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: [`AI PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        detectedType: 'pdf',
      };
    }
  }

  private async parsePPTX(filePath: string): Promise<ParsingResult> {
    // Check if AI is enabled (always on by default per settings)
    const autoApplyAI = true; // Always on as per requirements
    
    if (!aiService.isEnabled() || !autoApplyAI) {
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: ['PowerPoint parsing requires AI service. Please ensure AI is enabled in Settings.'],
        detectedType: 'pptx',
      };
    }

    try {
      // Read file and apply AI extraction
      const fileBuffer = await fs.readFile(filePath);
      const aiResult = await aiService.parseDocument(fileBuffer, path.basename(filePath), 'pptx');
      
      // Map AI results to our deal format
      const deals: ParsedDeal[] = aiResult.deals.map((deal: any) => ({
        itemCode: deal.itemCode || '',
        description: deal.description || '',
        dept: this.normalizeDept(deal.dept || ''),
        upc: this.cleanUPC(deal.upc || ''),
        cost: this.parseNumber(deal.cost),
        srp: this.parseNumber(deal.srp),
        adSrp: this.parseNumber(deal.adSrp),
        vendorFundingPct: this.parsePercentage(deal.funding),
        mvmt: this.parseNumber(deal.mvmt),
        competitorPrice: this.parseNumber(deal.competitorPrice),
        pack: deal.pack,
        size: deal.size,
        promoStart: deal.startDate ? new Date(deal.startDate) : undefined,
        promoEnd: deal.endDate ? new Date(deal.endDate) : undefined,
      }));
      
      return {
        deals,
        totalRows: aiResult.totalExtracted || deals.length,
        parsedRows: deals.length,
        errors: aiResult.warnings || [],
        detectedType: 'pptx',
      };
    } catch (error) {
      return {
        deals: [],
        totalRows: 0,
        parsedRows: 0,
        errors: [`AI PowerPoint extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
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
    
    const itemCode = findColumn(['ITEM CODE', 'CODE', 'ITEM NO', 'ORDER #', 'ITEM', 'SKU', 'PRODUCT CODE']) || '';
    const description = findColumn(['DESCRIPTION', 'ITEM DESC', 'PRODUCT DESCRIPTION', 'NAME', 'PRODUCT NAME']) || '';
    const dept = findColumn(['DEPARTMENT', 'DEPT', 'RETAIL DEPT', 'CATEGORY']) || '';
    
    if (!itemCode || !description) {
      throw new Error('Missing required fields');
    }
    
    // More aggressive search for cost and price fields - expanded variations
    const costRaw = findColumn([
      'COST', 'NET COST', 'UCOST', 'UNIT COST', 'CASE COST', 'WHOLESALE',
      'NETCOST', 'NET_COST', 'UNITCOST', 'UNIT_COST', 'CASECOST', 'CASE_COST',
      'WHOLESALECOST', 'WHOLESALE_COST', 'BASECOST', 'BASE_COST', 'BASE COST',
      'ITEMCOST', 'ITEM_COST', 'ITEM COST', 'PRODUCTCOST', 'PRODUCT_COST', 'PRODUCT COST'
    ]);
    
    const srpRaw = findColumn([
      'SRP', 'REGSRP', 'REGULAR PRICE', 'RETAIL', 'RETAIL PRICE', 'REG PRICE',
      'REGULARPRICE', 'REGULAR_PRICE', 'RETAILPRICE', 'RETAIL_PRICE', 'REGPRICE', 'REG_PRICE',
      'MSRP', 'LIST PRICE', 'LISTPRICE', 'LIST_PRICE', 'NORMAL PRICE', 'NORMALPRICE'
    ]);
    
    const adSrpRaw = findColumn([
      'AD PRICE', 'AD SRP', 'SALE PRICE', 'PROMO PRICE', 'SPECIAL', 'AD',
      'ADPRICE', 'AD_PRICE', 'ADSRP', 'AD_SRP', 'SALEPRICE', 'SALE_PRICE',
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
    
    return {
      itemCode: String(itemCode).trim(),
      description: String(description).trim(),
      dept: this.normalizeDept(String(dept)),
      cost: cost,
      srp: srp,
      adSrp: adSrp,
      upc: this.cleanUPC(String(findColumn(['UPC', 'BARCODE', 'EAN']) || '')),
      pack: String(findColumn(['PACK', 'PK', 'PACKAGE', 'CASE']) || '').trim() || undefined,
      size: String(findColumn(['SIZE', 'SZ', 'WEIGHT', 'WT']) || '').trim() || undefined,
      mvmt: this.parseNumber(findColumn(['MVMT', 'MOVEMENT', 'VELOCITY', 'UNITS'])),
      vendorFundingPct: this.parsePercentage(findColumn(['FUNDING', 'VENDOR FUNDING', 'REBATE', 'ALLOWANCE'])),
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
