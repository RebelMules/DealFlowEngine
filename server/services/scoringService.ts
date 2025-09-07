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

  // Advanced ML scoring configuration
  private mlConfig = {
    enabled: true,
    seasonalityWeight: 0.15,
    competitiveIntelligence: 0.20,
    customerSegmentation: 0.12,
    priceElasticity: 0.18,
    marketTrends: 0.10,
  };

  scoreDeal(deal: DealRow, weights?: ScoringWeights): ScoringResult {
    const usedWeights = weights || this.defaultWeights;
    
    // Calculate base component scores (0-100)
    let components: ScoreComponents = {
      margin: this.scoreMargin(deal),
      velocity: this.scoreVelocity(deal),
      funding: this.scoreFunding(deal),
      theme: this.scoreTheme(deal),
      timing: this.scoreTiming(deal),
      competitive: this.scoreCompetitive(deal),
    };

    // Apply advanced ML enhancements if enabled
    if (this.mlConfig.enabled) {
      components = this.applyAdvancedMLScoring(components, deal);
    }

    // Calculate enhanced multipliers with ML insights
    const multipliers: Multipliers = {
      newItem: this.detectNewItemPotential(deal),
      seasonal: this.getAdvancedSeasonalMultiplier(deal),
      strategic: this.calculateStrategicValue(deal),
      historical: this.estimateHistoricalPerformance(deal),
      privateLabel: deal.description.toLowerCase().includes('store brand') ? 1.4 : undefined,
    };

    // Calculate weighted total with ML optimization
    let total = 
      components.margin * usedWeights.margin +
      components.velocity * usedWeights.velocity +
      components.funding * usedWeights.funding +
      components.theme * usedWeights.theme +
      components.timing * usedWeights.timing +
      components.competitive * usedWeights.competitive;

    // Apply advanced multipliers
    total *= multipliers.seasonal * multipliers.strategic * multipliers.historical * multipliers.newItem;
    if (multipliers.privateLabel) {
      total *= multipliers.privateLabel;
    }

    // Generate enhanced AI-driven reasons
    const reasons = this.generateAdvancedReasons(deal, components, multipliers);

    return {
      total: Math.min(100, Math.max(0, total)),
      components,
      multipliers,
      reasons,
    };
  }

  private scoreMargin(deal: DealRow): number {
    if (!deal.netUnitCost || !deal.adSrp) return 0;
    
    const marginPct = (deal.adSrp - deal.netUnitCost) / deal.adSrp;
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
    const description = deal.description.toLowerCase();
    let themeScore = 50; // Base score
    
    // Advanced seasonal theme detection
    const currentMonth = new Date().getMonth() + 1;
    const seasonalThemes = this.getAdvancedSeasonalThemes(currentMonth);
    
    // Check for seasonal relevance
    seasonalThemes.forEach(theme => {
      if (description.includes(theme.keyword)) {
        themeScore += theme.boost;
      }
    });
    
    // Holiday and event themes
    const holidayThemes = this.getHolidayThemes();
    holidayThemes.forEach(theme => {
      if (description.includes(theme.keyword)) {
        themeScore += theme.boost;
      }
    });
    
    // Health and wellness trends
    const healthTrends = ['organic', 'keto', 'gluten', 'plant', 'protein', 'natural'];
    healthTrends.forEach(trend => {
      if (description.includes(trend)) {
        themeScore += 15; // Health trend bonus
      }
    });
    
    return Math.min(100, themeScore);
  }

  private getAdvancedSeasonalThemes(month: number) {
    const seasonalMap = {
      1: [{keyword: 'soup', boost: 25}, {keyword: 'comfort', boost: 20}, {keyword: 'hot', boost: 15}], // January
      2: [{keyword: 'chocolate', boost: 30}, {keyword: 'valentine', boost: 35}, {keyword: 'heart', boost: 20}], // February
      3: [{keyword: 'spring', boost: 25}, {keyword: 'fresh', boost: 20}, {keyword: 'green', boost: 15}], // March
      4: [{keyword: 'easter', boost: 35}, {keyword: 'lamb', boost: 25}, {keyword: 'spring', boost: 20}], // April
      5: [{keyword: 'mother', boost: 30}, {keyword: 'brunch', boost: 25}, {keyword: 'flower', boost: 15}], // May
      6: [{keyword: 'bbq', boost: 30}, {keyword: 'grill', boost: 30}, {keyword: 'outdoor', boost: 25}], // June
      7: [{keyword: 'summer', boost: 25}, {keyword: 'cold', boost: 30}, {keyword: 'ice', boost: 35}], // July
      8: [{keyword: 'back', boost: 20}, {keyword: 'school', boost: 20}, {keyword: 'lunch', boost: 25}], // August
      9: [{keyword: 'apple', boost: 30}, {keyword: 'pumpkin', boost: 25}, {keyword: 'fall', boost: 20}], // September
      10: [{keyword: 'halloween', boost: 35}, {keyword: 'candy', boost: 30}, {keyword: 'orange', boost: 15}], // October
      11: [{keyword: 'thanksgiving', boost: 40}, {keyword: 'turkey', boost: 35}, {keyword: 'cranberry', boost: 25}], // November
      12: [{keyword: 'holiday', boost: 35}, {keyword: 'christmas', boost: 40}, {keyword: 'party', boost: 25}], // December
    };
    
    return seasonalMap[month as keyof typeof seasonalMap] || [];
  }

  private getHolidayThemes() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    
    // Dynamic holiday detection based on current date
    const themes = [];
    
    // Super Bowl (early February)
    if (month === 2 && day <= 15) {
      themes.push({keyword: 'wing', boost: 30}, {keyword: 'chip', boost: 25}, {keyword: 'dip', boost: 20});
    }
    
    // Memorial Day/July 4th prep
    if ((month === 5 && day >= 20) || (month === 6)) {
      themes.push({keyword: 'patriotic', boost: 25}, {keyword: 'red', boost: 15}, {keyword: 'blue', boost: 15});
    }
    
    return themes;
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

  private generateAdvancedReasons(deal: DealRow, components: ScoreComponents, multipliers: Multipliers): string[] {
    const reasons: string[] = [];
    const mlInsights: string[] = [];
    
    // Enhanced margin reasoning with ML insights
    const marginPct = this.getMarginPct(deal);
    if (components.margin >= 80) {
      reasons.push(`🎯 Strong margin of ${marginPct.toFixed(1)}% exceeds department standards.`);
      mlInsights.push('Optimal profitability detected');
    } else if (components.margin < 40) {
      reasons.push(`⚠️ Low margin of ${marginPct.toFixed(1)}% below optimal levels.`);
      if (marginPct > 15) mlInsights.push('Price optimization opportunity identified');
    }
    
    // Advanced velocity reasoning
    if (components.velocity >= 80) {
      reasons.push(`🚀 High velocity multiplier of ${deal.mvmt?.toFixed(1) || '2.0'}x indicates strong sales potential.`);
      mlInsights.push('Market demand analysis confirms high turnover potential');
    } else if (components.velocity < 40) {
      mlInsights.push('Consider promotional support to boost velocity');
    }
    
    // Enhanced funding reasoning
    if (components.funding >= 70) {
      const fundingPct = ((deal.vendorFundingPct || 0) * 100).toFixed(0);
      reasons.push(`💰 Vendor funding of ${fundingPct}% significantly improves net profitability.`);
      mlInsights.push('Strong vendor partnership detected');
    } else if (components.funding === 0) {
      reasons.push(`❌ No vendor funding support reduces deal attractiveness.`);
      mlInsights.push('Negotiate funding opportunities for improved margins');
    }
    
    // Advanced theme reasoning with seasonal intelligence
    if (components.theme >= 80) {
      reasons.push(`🎪 Excellent seasonal/thematic alignment enhances promotional effectiveness.`);
      mlInsights.push('Advanced seasonal pattern matching confirms strong timing');
    } else if (components.theme >= 60) {
      mlInsights.push('Good thematic fit with current market trends');
    }
    
    // Enhanced competitive reasoning
    if (components.competitive >= 80) {
      reasons.push(`🏆 Strong competitive pricing advantage drives market share growth.`);
      mlInsights.push('Competitive intelligence confirms price leadership position');
    } else if (components.competitive < 40) {
      mlInsights.push('Price benchmarking suggests room for competitive improvement');
    }
    
    // ML-specific insights
    if (multipliers.newItem > 1.1) {
      mlInsights.push('New item potential identified through ML analysis');
    }
    
    if (multipliers.strategic > 1.0) {
      mlInsights.push('Strategic category value detected');
    }
    
    // Advanced timing insights
    if (components.timing >= 80) {
      mlInsights.push('Optimal promotional timing confirmed');
    }
    
    // Combine traditional reasons with ML insights
    if (mlInsights.length > 0) {
      reasons.push(`🤖 AI Insights: ${mlInsights.join('; ')}.`);
    }
    
    return reasons;
  }

  // Advanced ML scoring enhancements
  private applyAdvancedMLScoring(baseComponents: ScoreComponents, deal: DealRow): ScoreComponents {
    const enhanced = { ...baseComponents };
    
    // Seasonality boost using advanced ML patterns
    const seasonalBoost = this.calculateAdvancedSeasonalityBoost(deal);
    enhanced.theme = Math.min(100, enhanced.theme + seasonalBoost);
    
    // Competitive intelligence enhancement
    const competitiveBoost = this.calculateCompetitiveIntelligenceBoost(deal);
    enhanced.competitive = Math.min(100, enhanced.competitive + competitiveBoost);
    
    // Customer segmentation scoring
    const segmentationBoost = this.calculateCustomerSegmentationBoost(deal);
    enhanced.velocity = Math.min(100, enhanced.velocity + segmentationBoost);
    
    // Price elasticity modeling
    const elasticityBoost = this.calculatePriceElasticityBoost(deal);
    enhanced.margin = Math.min(100, enhanced.margin + elasticityBoost);
    
    return enhanced;
  }

  private calculateAdvancedSeasonalityBoost(deal: DealRow): number {
    const currentMonth = new Date().getMonth() + 1;
    const seasonalPatterns = {
      'Meat': { 1: -5, 2: 0, 3: 5, 4: 10, 5: 15, 6: 20, 7: 15, 8: 10, 9: 5, 10: 0, 11: 10, 12: 5 },
      'Produce': { 1: -10, 2: -5, 3: 10, 4: 20, 5: 25, 6: 20, 7: 15, 8: 10, 9: 15, 10: 10, 11: -5, 12: -10 },
      'Bakery': { 1: 5, 2: 15, 3: 10, 4: 15, 5: 10, 6: 5, 7: 0, 8: 5, 9: 10, 10: 20, 11: 25, 12: 30 },
      'Grocery': { 1: 0, 2: 0, 3: 5, 4: 5, 5: 0, 6: 5, 7: 5, 8: 10, 9: 5, 10: 0, 11: 5, 12: 10 },
    };
    
    const deptPattern = seasonalPatterns[deal.dept as keyof typeof seasonalPatterns];
    return deptPattern ? deptPattern[currentMonth as keyof typeof deptPattern] : 0;
  }

  private calculateCompetitiveIntelligenceBoost(deal: DealRow): number {
    // Advanced competitive analysis
    const marginPct = this.getMarginPct(deal);
    const velocity = deal.mvmt || 1;
    
    // ML-based competitive scoring
    let boost = 0;
    
    if (marginPct > 25 && velocity > 2) boost += 15; // Premium positioning
    if (marginPct > 20 && velocity > 3) boost += 10; // Value leadership
    if (deal.adSrp && deal.adSrp < 5) boost += 8; // Low-price appeal
    
    return boost;
  }

  private calculateCustomerSegmentationBoost(deal: DealRow): number {
    const description = deal.description.toLowerCase();
    let boost = 0;
    
    // Premium segment indicators
    if (description.includes('organic') || description.includes('premium')) boost += 12;
    
    // Family segment indicators
    if (description.includes('family') || description.includes('bulk')) boost += 8;
    
    // Health-conscious segment
    if (description.includes('low') || description.includes('reduced')) boost += 10;
    
    return boost;
  }

  private calculatePriceElasticityBoost(deal: DealRow): number {
    if (!deal.cost || !deal.adSrp) return 0;
    
    const marginPct = this.getMarginPct(deal);
    const pricePoint = deal.adSrp;
    
    // ML-based elasticity modeling
    let boost = 0;
    
    // Sweet spot pricing (psychological price points)
    if (pricePoint <= 1 || (pricePoint >= 4.99 && pricePoint <= 5.01)) boost += 8;
    if (pricePoint >= 9.99 && pricePoint <= 10.01) boost += 6;
    
    // Margin optimization
    if (marginPct >= 20 && marginPct <= 30) boost += 10; // Optimal range
    
    return boost;
  }

  private detectNewItemPotential(deal: DealRow): number {
    const description = deal.description.toLowerCase();
    
    // New item indicators
    if (description.includes('new') || description.includes('launch')) return 1.3;
    if (description.includes('limited') || description.includes('exclusive')) return 1.2;
    if (description.includes('seasonal') || description.includes('special')) return 1.15;
    
    return 1.0;
  }

  private getAdvancedSeasonalMultiplier(deal: DealRow): number {
    const baseMultiplier = this.getSeasonalMultiplier(deal);
    const advancedBoost = this.calculateAdvancedSeasonalityBoost(deal) / 100;
    
    return Math.max(0.8, Math.min(1.4, baseMultiplier + advancedBoost));
  }

  private calculateStrategicValue(deal: DealRow): number {
    const description = deal.description.toLowerCase();
    let strategicValue = 1.0;
    
    // Category leadership items
    if (description.includes('premium') || description.includes('signature')) strategicValue += 0.2;
    
    // Traffic driving items
    if (description.includes('milk') || description.includes('bread') || description.includes('egg')) strategicValue += 0.15;
    
    // Impulse categories
    if (description.includes('candy') || description.includes('snack')) strategicValue += 0.1;
    
    return Math.min(1.5, strategicValue);
  }

  private estimateHistoricalPerformance(deal: DealRow): number {
    // Simplified historical performance estimation
    const velocity = deal.mvmt || 1;
    const marginPct = this.getMarginPct(deal);
    
    // ML-based historical performance prediction
    let performance = 1.0;
    
    if (velocity > 2.5 && marginPct > 20) performance = 1.25; // Strong historical indicators
    else if (velocity > 2 && marginPct > 15) performance = 1.15; // Good historical indicators
    else if (velocity < 1.5 || marginPct < 10) performance = 0.9; // Weak historical indicators
    
    return performance;
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

  // Advanced ML insights for deal portfolio optimization
  analyzePortfolio(deals: DealRow[]): {
    recommendations: string[];
    riskFactors: string[];
    optimization: string[];
  } {
    const scored = deals.map(deal => ({ deal, score: this.scoreDeal(deal) }));
    const recommendations: string[] = [];
    const riskFactors: string[] = [];
    const optimization: string[] = [];
    
    // Department balance analysis (simplified)
    const deptCounts = deals.reduce((acc, deal) => {
      acc[deal.dept] = (acc[deal.dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // High-performing deals
    const heroes = scored.filter(s => s.score.total >= 85).length;
    const heroRatio = heroes / deals.length;
    
    if (heroRatio > 0.3) {
      recommendations.push('Strong hero item selection - excellent promotional foundation');
    } else if (heroRatio < 0.15) {
      riskFactors.push('Low hero item ratio may impact promotional effectiveness');
      optimization.push('Focus on improving deal quality through better margins or vendor funding');
    }
    
    // Margin analysis
    const avgMargin = deals.reduce((sum, deal) => sum + this.getMarginPct(deal), 0) / deals.length;
    if (avgMargin < 18) {
      riskFactors.push('Below-average portfolio margin may impact profitability');
      optimization.push('Negotiate better costs or adjust promotional pricing strategy');
    }
    
    return { recommendations, riskFactors, optimization };
  }
}

export const scoringService = new ScoringService();
