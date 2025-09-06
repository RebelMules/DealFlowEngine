import * as XLSX from 'xlsx';
import * as csv from 'csv-parse';
import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import type { InsertDealRow } from '@shared/schema';

interface ParsedDeal {
  itemCode: string;
  description: string;
  dept: string;
  upc?: string;
  cost?: number;
  srp?: number;
  adSrp?: number;
  vendorFundingPct?: number;
  mvmt?: number;
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
        errors: [`Failed to parse file: ${error.message}`],
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
      default:
        return this.parseGenericExcel(jsonData as any[][], detectedType);
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
          srp: this.parseNumber(row[headerMap['REGSRP']]),
          adSrp: this.parseNumber(row[headerMap['AD SRP']]),
          vendorFundingPct: this.parsePercentage(row[headerMap['AMAP']]),
          mvmt: this.parseNumber(row[headerMap['MVMT']]),
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
        errors.push(`Row ${i + 1}: ${error.message}`);
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

  private parseGenericExcel(data: any[][], detectedType: string): ParsingResult {
    // Fallback generic parser
    return {
      deals: [],
      totalRows: data.length,
      parsedRows: 0,
      errors: [`Unknown Excel format: ${detectedType}`],
      detectedType,
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
    // TODO: Implement PDF parsing with AI extraction
    return {
      deals: [],
      totalRows: 0,
      parsedRows: 0,
      errors: ['PDF parsing requires AI service to be enabled'],
      detectedType: 'pdf',
    };
  }

  private async parsePPTX(filePath: string): Promise<ParsingResult> {
    // TODO: Implement PPTX parsing with AI extraction
    return {
      deals: [],
      totalRows: 0,
      parsedRows: 0,
      errors: ['PPTX parsing requires AI service to be enabled'],
      detectedType: 'pptx',
    };
  }

  private mapGenericRowToDeal(row: any): ParsedDeal {
    // Generic mapping - tries common column name variations
    const itemCode = row['Item Code'] || row['CODE'] || row['ITEM NO'] || row['ORDER #'] || '';
    const description = row['Description'] || row['ITEM DESC'] || row['PRODUCT DESCRIPTION'] || '';
    const dept = row['Department'] || row['DEPT'] || row['RETAIL DEPT'] || '';
    
    if (!itemCode || !description) {
      throw new Error('Missing required fields');
    }
    
    return {
      itemCode: String(itemCode).trim(),
      description: String(description).trim(),
      dept: this.normalizeDept(String(dept)),
      cost: this.parseNumber(row['Cost'] || row['NET COST'] || row['UCOST']),
      srp: this.parseNumber(row['SRP'] || row['REGSRP']),
      adSrp: this.parseNumber(row['Ad Price'] || row['AD SRP']),
      upc: this.cleanUPC(String(row['UPC'] || '')),
      pack: String(row['Pack'] || row['PK'] || '').trim() || undefined,
      size: String(row['Size'] || row['SZ'] || '').trim() || undefined,
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
      const stream = require('fs').createReadStream(filePath);
      
      stream.on('data', (data: any) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

export const parsingService = new ParsingService();
