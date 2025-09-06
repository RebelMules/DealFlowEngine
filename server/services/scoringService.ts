import type { DealRow, ScoreComponents, Multipliers, ScoringWeights } from "@shared/schema";

interface ScoringResult {
  total: number;
  components: ScoreComponents;
  multipliers: Multipliers;
  reasons: string[];
}

class ScoringService {
  private defaultWeights: ScoringWeights = {
    margin: 0.25,
    velocity: 0.25,
    funding: 0.20,
    theme: 0.15,
    timing: 0.10,
    competitive: 0.05,
  };

  private marginFloors: Record<string, number> = {
    Meat: 0.18,
    Grocery: 0.22,
    Produce: 0.25,
    Bakery: 0.30,
  };

  scoreDeal(deal: DealRow, weights?: ScoringWeights): ScoringResult {
    const usedWeights = weights || this.defaultWeights;
    
    // Calculate component scores (0-100)
    const components: ScoreComponents = {
      margin: this.scoreMargin(deal),
      velocity: this.scoreVelocity(deal),
      funding: this.scoreFunding(deal),
      theme: this.scoreTheme(deal),
      timing: this.scoreTiming(deal),
      competitive: this.scoreCompetitive(deal),
    };

    // Calculate multipliers
    const multipliers: Multipliers = {
      newItem: 1.0, // TODO: Implement new item detection
      seasonal: this.getSeasonalMultiplier(deal),
      strategic: 1.0, // TODO: Implement strategic item detection
      historical: 1.0, // TODO: Implement historical performance
      privateLabel: deal.description.toLowerCase().includes('store brand') ? 1.4 : undefined,
    };

    // Calculate weighted total
    let total = 
      components.margin * usedWeights.margin +
      components.velocity * usedWeights.velocity +
      components.funding * usedWeights.funding +
      components.theme * usedWeights.theme +
      components.timing * usedWeights.timing +
      components.competitive * usedWeights.competitive;

    // Apply multipliers
    total *= multipliers.seasonal * multipliers.strategic * multipliers.historical * multipliers.newItem;
    if (multipliers.privateLabel) {
      total *= multipliers.privateLabel;
    }

    // Generate reasons
    const reasons = this.generateReasons(deal, components, multipliers);

    return {
      total: Math.min(100, Math.max(0, total)),
      components,
      multipliers,
      reasons,
    };
  }

  private scoreMargin(deal: DealRow): number {
    if (!deal.cost || !deal.adSrp) return 0;
    
    const marginPct = (deal.adSrp - deal.cost) / deal.adSrp;
    const floorPct = this.marginFloors[deal.dept] || 0.15;
    
    // Below floor gets 0, at floor gets 50, 30%+ gets 100
    if (marginPct < floorPct) return 0;
    if (marginPct >= 0.30) return 100;
    
    // Linear interpolation between floor and 30%
    return 50 + (marginPct - floorPct) / (0.30 - floorPct) * 50;
  }

  private scoreVelocity(deal: DealRow): number {
    const mvmt = deal.mvmt || 1.0;
    
    if (mvmt >= 4.0) return 100;
    if (mvmt >= 3.0) return 85;
    if (mvmt >= 2.5) return 70;
    if (mvmt >= 2.0) return 55;
    if (mvmt >= 1.5) return 40;
    return 20;
  }

  private scoreFunding(deal: DealRow): number {
    const fundingPct = deal.vendorFundingPct || 0;
    
    if (fundingPct >= 0.20) return 100;
    if (fundingPct >= 0.15) return 85;
    if (fundingPct >= 0.10) return 70;
    if (fundingPct >= 0.05) return 40;
    return fundingPct > 0 ? 20 : 0;
  }

  private scoreTheme(deal: DealRow): number {
    // TODO: Implement theme scoring based on seasonal keywords, current promotions
    // For now, return moderate score
    const description = deal.description.toLowerCase();
    let themeScore = 50;
    
    // Summer themes
    if (this.isSummerSeason()) {
      if (description.includes('bbq') || description.includes('grill') || 
          description.includes('soda') || description.includes('ice')) {
        themeScore += 40;
      }
    }
    
    return Math.min(100, themeScore);
  }

  private scoreTiming(deal: DealRow): number {
    if (!deal.promoStart) return 60; // Default if no timing info
    
    const now = new Date();
    const promoStart = new Date(deal.promoStart);
    const daysDiff = Math.abs((promoStart.getTime() - now.getTime()) / (1000 * 3600 * 24));
    
    if (daysDiff <= 3) return 100;
    if (daysDiff <= 7) return 80;
    if (daysDiff <= 14) return 60;
    return 40;
  }

  private scoreCompetitive(deal: DealRow): number {
    if (!deal.competitorPrice || !deal.adSrp) return 50; // Default if no competitor data
    
    const priceDiff = (deal.competitorPrice - deal.adSrp) / deal.competitorPrice;
    
    if (priceDiff >= 0.15) return 100; // 15%+ cheaper
    if (priceDiff >= 0.10) return 80;
    if (priceDiff >= 0.05) return 60;
    return 20;
  }

  private getSeasonalMultiplier(deal: DealRow): number {
    const description = deal.description.toLowerCase();
    
    if (this.isSummerSeason()) {
      if (description.includes('ice cream') || description.includes('soda') ||
          description.includes('chips') || description.includes('beer')) {
        return 1.2;
      }
    }
    
    return 1.0;
  }

  private isSummerSeason(): boolean {
    const month = new Date().getMonth() + 1; // 1-12
    return month >= 6 && month <= 8;
  }

  private generateReasons(deal: DealRow, components: ScoreComponents, multipliers: Multipliers): string[] {
    const reasons: string[] = [];
    
    // Margin reasoning
    if (components.margin >= 80) {
      reasons.push(`Strong margin of ${this.getMarginPct(deal).toFixed(1)}% exceeds department standards.`);
    } else if (components.margin < 40) {
      reasons.push(`Low margin of ${this.getMarginPct(deal).toFixed(1)}% below optimal levels.`);
    }
    
    // Velocity reasoning
    if (components.velocity >= 80) {
      reasons.push(`High velocity multiplier of ${deal.mvmt?.toFixed(1) || '2.0'}x indicates strong sales potential.`);
    }
    
    // Funding reasoning
    if (components.funding >= 70) {
      reasons.push(`Vendor funding of ${((deal.vendorFundingPct || 0) * 100).toFixed(0)}% improves profitability.`);
    } else if (components.funding === 0) {
      reasons.push(`No vendor funding support reduces deal attractiveness.`);
    }
    
    // Theme reasoning
    if (components.theme >= 80) {
      reasons.push(`Strong seasonal alignment enhances promotional effectiveness.`);
    }
    
    // Competitive reasoning
    if (components.competitive >= 80) {
      reasons.push(`Competitive pricing advantage drives market share.`);
    }
    
    return reasons;
  }

  private getMarginPct(deal: DealRow): number {
    if (!deal.cost || !deal.adSrp) return 0;
    return ((deal.adSrp - deal.cost) / deal.adSrp) * 100;
  }

  validateQualityGate(deals: DealRow[]): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    const totalDeals = deals.length;
    
    if (totalDeals === 0) {
      return { passed: false, issues: ['No deals found to score'] };
    }
    
    // Check for missing cost or ad SRP
    const missingCost = deals.filter(d => !d.cost).length;
    const missingAdSrp = deals.filter(d => !d.adSrp).length;
    
    const missingCostPct = missingCost / totalDeals;
    const missingAdSrpPct = missingAdSrp / totalDeals;
    
    if (missingCostPct > 0.05) {
      issues.push(`${missingCost} deals missing cost data (${(missingCostPct * 100).toFixed(1)}%)`);
    }
    
    if (missingAdSrpPct > 0.05) {
      issues.push(`${missingAdSrp} deals missing ad price data (${(missingAdSrpPct * 100).toFixed(1)}%)`);
    }
    
    // Check for unresolved descriptions
    const unresolvedDesc = deals.filter(d => !d.description || d.description.length < 5).length;
    const unresolvedDescPct = unresolvedDesc / totalDeals;
    
    if (unresolvedDescPct > 0.01) {
      issues.push(`${unresolvedDesc} deals with unresolved descriptions`);
    }
    
    return {
      passed: issues.length === 0,
      issues,
    };
  }

  getScoreInterpretation(score: number): string {
    if (score >= 85) return 'MUST INCLUDE';
    if (score >= 70) return 'STRONGLY RECOMMENDED';
    if (score >= 55) return 'RECOMMENDED';
    if (score >= 40) return 'CONSIDER';
    return 'SKIP';
  }
}

export const scoringService = new ScoringService();
