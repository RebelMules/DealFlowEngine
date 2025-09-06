import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import type { DealRow, Score, SourceDoc } from '@shared/schema';

interface DealWithScore extends DealRow {
  score?: Score;
  sourceDoc?: SourceDoc;
}

class ExportService {
  private exportsDir = path.join(process.cwd(), 'exports');

  constructor() {
    this.ensureExportsDir();
  }

  private async ensureExportsDir(): Promise<void> {
    try {
      await fs.access(this.exportsDir);
    } catch {
      await fs.mkdir(this.exportsDir, { recursive: true });
    }
  }

  async generatePickListCSV(
    deals: DealWithScore[],
    adWeekId: string
  ): Promise<{ path: string; hash: string }> {
    const sortedDeals = deals
      .filter(d => d.score && d.score.total >= 40) // Only include scorable deals
      .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));

    const csvLines = [
      'Item Code,Product Name,Cost,Ad Price,Pricing Strategy,Department,Score,Interpretation,Source File'
    ];

    for (const deal of sortedDeals) {
      const score = deal.score!;
      const pricingStrategy = this.getPricingStrategy(deal);
      const interpretation = this.getScoreInterpretation(score.total);
      const sourceFile = deal.sourceDoc?.filename || 'Unknown';

      csvLines.push([
        `"${deal.itemCode}"`,
        `"${deal.description}"`,
        deal.cost?.toFixed(2) || '0.00',
        deal.adSrp?.toFixed(2) || '0.00',
        `"${pricingStrategy}"`,
        `"${deal.dept}"`,
        score.total.toFixed(1),
        `"${interpretation}"`,
        `"${sourceFile}"`
      ].join(','));
    }

    const csvContent = csvLines.join('\n');
    const fileName = `pick-list-${adWeekId}-${Date.now()}.csv`;
    const filePath = path.join(this.exportsDir, fileName);
    
    await fs.writeFile(filePath, csvContent, 'utf-8');
    
    const hash = createHash('sha256').update(csvContent).digest('hex');
    
    return { path: filePath, hash };
  }

  async generateBuyerReportTXT(
    deals: DealWithScore[],
    adWeekId: string
  ): Promise<{ path: string; hash: string }> {
    const sortedDeals = deals
      .filter(d => d.score && d.score.total >= 40)
      .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));

    const deptGroups = this.groupByDepartment(sortedDeals);
    
    const lines = [
      '='.repeat(60),
      `BUYER REPORT - WEEK ${adWeekId.toUpperCase()}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Total Deals Analyzed: ${deals.length}`,
      `Recommended Deals: ${sortedDeals.length}`,
      '='.repeat(60),
      ''
    ];

    // Department summaries
    for (const [dept, deptDeals] of Object.entries(deptGroups)) {
      lines.push(`## ${dept.toUpperCase()} DEPARTMENT (${deptDeals.length} deals)`);
      lines.push('-'.repeat(40));
      
      // Hero items (score >= 85)
      const heroes = deptDeals.filter(d => d.score!.total >= 85);
      if (heroes.length > 0) {
        lines.push('🏆 MUST INCLUDE:');
        heroes.forEach(deal => {
          lines.push(`  • ${deal.description} - $${deal.adSrp?.toFixed(2)} (Score: ${deal.score!.total.toFixed(1)})`);
        });
        lines.push('');
      }
      
      // Stock alerts
      const lowMarginDeals = deptDeals.filter(d => {
        const marginPct = this.getMarginPercent(d);
        return marginPct < this.getMarginFloor(dept);
      });
      
      if (lowMarginDeals.length > 0) {
        lines.push('⚠️  MARGIN ALERTS:');
        lowMarginDeals.forEach(deal => {
          const marginPct = this.getMarginPercent(deal);
          lines.push(`  • ${deal.description} - Margin: ${marginPct.toFixed(1)}% (Below ${this.getMarginFloor(dept) * 100}% floor)`);
        });
        lines.push('');
      }
      
      lines.push('');
    }

    // Action items
    lines.push('## ACTION ITEMS');
    lines.push('-'.repeat(20));
    lines.push('□ Review hero items for ad placement priority');
    lines.push('□ Confirm vendor funding on recommended deals');
    lines.push('□ Validate competitive pricing assumptions');
    lines.push('□ Check inventory levels for high-velocity items');
    lines.push('');

    const txtContent = lines.join('\n');
    const fileName = `buyer-report-${adWeekId}-${Date.now()}.txt`;
    const filePath = path.join(this.exportsDir, fileName);
    
    await fs.writeFile(filePath, txtContent, 'utf-8');
    
    const hash = createHash('sha256').update(txtContent).digest('hex');
    
    return { path: filePath, hash };
  }

  async generateDesignerJSON(
    deals: DealWithScore[],
    adWeekId: string
  ): Promise<{ path: string; hash: string }> {
    const sortedDeals = deals
      .filter(d => d.score && d.score.total >= 40)
      .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));

    const designerData = {
      weekId: adWeekId,
      generatedAt: new Date().toISOString(),
      totalDeals: deals.length,
      exportedDeals: sortedDeals.length,
      deals: sortedDeals.map((deal, index) => ({
        rank: index + 1,
        itemCode: deal.itemCode,
        description: deal.description,
        department: deal.dept,
        cost: deal.cost,
        adPrice: deal.adSrp,
        priceCopy: this.getPriceCopy(deal),
        pricingPattern: this.getPricingStrategy(deal),
        heroFlag: deal.score!.total >= 85,
        score: deal.score!.total,
        scoreInterpretation: this.getScoreInterpretation(deal.score!.total),
        marginPercent: this.getMarginPercent(deal),
        expectedVelocity: deal.mvmt || 1.0,
        vendorFunding: deal.vendorFundingPct || 0,
        sourceFile: deal.sourceDoc?.filename || 'Unknown',
        notes: deal.score!.reasons.join(' '),
        tags: this.generateTags(deal),
      })),
      departmentSummary: this.getDepartmentSummary(sortedDeals),
    };

    const jsonContent = JSON.stringify(designerData, null, 2);
    const fileName = `designer-${adWeekId}-${Date.now()}.json`;
    const filePath = path.join(this.exportsDir, fileName);
    
    await fs.writeFile(filePath, jsonContent, 'utf-8');
    
    const hash = createHash('sha256').update(jsonContent).digest('hex');
    
    return { path: filePath, hash };
  }

  private getPricingStrategy(deal: DealRow): string {
    if (!deal.adSrp) return 'Regular Price';
    
    // Check for common multi-buy patterns based on cost bands
    const price = deal.adSrp;
    
    if (price <= 2.00) return '3 for $5';
    if (price <= 3.50) return '2 for $5';
    if (price <= 5.00) return '2 for $8';
    if (price >= 10.00) return 'Unit Price';
    
    return 'Unit Price';
  }

  private getPriceCopy(deal: DealRow): string {
    if (!deal.adSrp) return '';
    
    const strategy = this.getPricingStrategy(deal);
    if (strategy.includes('for $')) {
      return strategy;
    }
    
    return `$${deal.adSrp.toFixed(2)}`;
  }

  private getScoreInterpretation(score: number): string {
    if (score >= 85) return 'MUST INCLUDE';
    if (score >= 70) return 'STRONGLY RECOMMENDED';
    if (score >= 55) return 'RECOMMENDED';
    if (score >= 40) return 'CONSIDER';
    return 'SKIP';
  }

  private getMarginPercent(deal: DealRow): number {
    if (!deal.cost || !deal.adSrp) return 0;
    return ((deal.adSrp - deal.cost) / deal.adSrp) * 100;
  }

  private getMarginFloor(dept: string): number {
    const floors: Record<string, number> = {
      'Meat': 0.18,
      'Grocery': 0.22,
      'Produce': 0.25,
      'Bakery': 0.30,
    };
    return floors[dept] || 0.15;
  }

  private generateTags(deal: DealWithScore): string[] {
    const tags: string[] = [];
    
    if (deal.score!.total >= 85) tags.push('hero');
    if (deal.mvmt && deal.mvmt >= 3.0) tags.push('high-velocity');
    if (deal.vendorFundingPct && deal.vendorFundingPct >= 0.15) tags.push('well-funded');
    
    const marginPct = this.getMarginPercent(deal);
    if (marginPct >= 30) tags.push('high-margin');
    
    const description = deal.description.toLowerCase();
    if (description.includes('organic') || description.includes('natural')) tags.push('premium');
    if (description.includes('sale') || description.includes('special')) tags.push('promotional');
    
    return tags;
  }

  private groupByDepartment(deals: DealWithScore[]): Record<string, DealWithScore[]> {
    return deals.reduce((acc, deal) => {
      const dept = deal.dept || 'Unknown';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(deal);
      return acc;
    }, {} as Record<string, DealWithScore[]>);
  }

  private getDepartmentSummary(deals: DealWithScore[]): Record<string, any> {
    const deptGroups = this.groupByDepartment(deals);
    const summary: Record<string, any> = {};
    
    for (const [dept, deptDeals] of Object.entries(deptGroups)) {
      const heroCount = deptDeals.filter(d => d.score!.total >= 85).length;
      const avgScore = deptDeals.reduce((sum, d) => sum + d.score!.total, 0) / deptDeals.length;
      const avgMargin = deptDeals.reduce((sum, d) => sum + this.getMarginPercent(d), 0) / deptDeals.length;
      
      summary[dept] = {
        totalDeals: deptDeals.length,
        heroDeals: heroCount,
        averageScore: avgScore.toFixed(1),
        averageMargin: avgMargin.toFixed(1),
        targetMix: this.getTargetMix(dept),
      };
    }
    
    return summary;
  }

  private getTargetMix(dept: string): string {
    const targets: Record<string, string> = {
      'Meat': '25-30%',
      'Grocery': '30-35%',
      'Produce': '20-25%',
      'Bakery': '15-20%',
    };
    return targets[dept] || '10-15%';
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting export file:', error);
    }
  }
}

export const exportService = new ExportService();
