import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Eye, 
  ExternalLink, 
  Lock,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { cn } from "@/lib/utils";

// Helper functions for formatting and calculations
const fmt = (n?: number | null, d = 2) =>
  n == null ? '-' : Number.isFinite(n) ? n.toFixed(d) : '-';

const gpDollars = (adSrp?: number | null, netUnitCost?: number | null) =>
  adSrp != null && netUnitCost != null ? adSrp - netUnitCost : null;

const gpPct = (adSrp?: number | null, netUnitCost?: number | null) => {
  if (adSrp == null || netUnitCost == null || adSrp === 0) return null;
  return (adSrp - netUnitCost) / adSrp;
};

// Calculate required SRP based on department target margins
const getRequiredSRP = (netUnitCost?: number | null, dept?: string | null, targetMargin?: number) => {
  if (!netUnitCost) return null;
  
  const marginFloors: Record<string, number> = {
    Meat: 0.18,
    Grocery: 0.22,
    Produce: 0.25,
    Bakery: 0.30,
    Deli: 0.28,
    'Deli/Bakery': 0.29,
  };
  
  const margin = targetMargin || marginFloors[dept || ''] || 0.30;
  return netUnitCost / (1 - margin);
};

// Calculate effective deal pricing for BOGO
const getEffectiveSRP = (deal: Deal) => {
  const isBOGO = deal.description?.toLowerCase().includes('bogo') || 
                 deal.description?.toLowerCase().includes('buy one get one');
  
  if (isBOGO && deal.srp) {
    return deal.srp / 2;
  }
  
  return deal.adSrp;
};

// Check if item is weight-based
const isWeightBased = (deal: Deal) => {
  const desc = deal.description?.toLowerCase() || '';
  const size = deal.size?.toLowerCase() || '';
  return desc.includes('/lb') || desc.includes('per lb') || 
         size.includes('lb') || size.includes('oz') || size.includes('kg');
};

type SortKey = 'itemCode' | 'adSrp' | 'netUnitCost' | 'gp$' | 'gp%' | 'reqSrp' | 'scan' | 'score';

interface Deal {
  id: string;
  itemCode: string;
  description: string;
  dept: string;
  upc?: string | null;
  cost?: number | null;
  netUnitCost?: number | null;
  srp?: number | null;
  adSrp?: number | null;
  vendorFundingPct?: number | null;
  mvmt?: number | null;
  adScan?: number | null;
  tprScan?: number | null;
  edlcScan?: number | null;
  competitorPrice?: number | null;
  pack?: string | null;
  size?: string | null;
  promoStart?: Date | null;
  promoEnd?: Date | null;
  score?: {
    total: number;
    components: {
      margin: number;
      velocity: number;
      funding: number;
      theme: number;
      timing: number;
      competitive: number;
    };
  };
}

interface DealsTableProps {
  deals: Deal[];
  onSelectDeal: (dealId: string) => void;
  selectedDealId: string | null;
}

// Scoring weights for transparency
const SCORING_WEIGHTS = {
  margin: 0.25,
  velocity: 0.25,
  funding: 0.20,
  theme: 0.15,
  timing: 0.10,
  competitive: 0.05,
};

export function DealsTable({ deals, onSelectDeal, selectedDealId }: DealsTableProps) {
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterText, setFilterText] = useState('');
  const [minGp, setMinGp] = useState<string>('');
  const [minGpPct, setMinGpPct] = useState<string>('');

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDeals(new Set(deals.map(d => d.id)));
    } else {
      setSelectedDeals(new Set());
    }
  };

  const handleSelectDeal = (dealId: string, checked: boolean) => {
    const newSelected = new Set(selectedDeals);
    if (checked) {
      newSelected.add(dealId);
    } else {
      newSelected.delete(dealId);
    }
    setSelectedDeals(newSelected);
  };

  const onSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortBy !== key) return <ArrowUpDown size={14} className="opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const cmpNum = (a?: number | null, b?: number | null) => {
    const A = a == null ? Number.NEGATIVE_INFINITY : a;
    const B = b == null ? Number.NEGATIVE_INFINITY : b;
    return A - B;
  };

  const getTotalScan = (deal: Deal) => {
    return (deal.adScan || 0) + (deal.tprScan || 0) + (deal.edlcScan || 0);
  };

  const sortedDeals = useMemo(() => {
    const base = [...deals];
    base.sort((a, b) => {
      let res = 0;
      if (sortBy === 'itemCode') res = String(a.itemCode).localeCompare(String(b.itemCode));
      if (sortBy === 'adSrp')    res = cmpNum(a.adSrp, b.adSrp);
      if (sortBy === 'netUnitCost') res = cmpNum(a.netUnitCost, b.netUnitCost);
      if (sortBy === 'gp$')      res = cmpNum(gpDollars(a.adSrp, a.netUnitCost), gpDollars(b.adSrp, b.netUnitCost));
      if (sortBy === 'gp%')      res = cmpNum(gpPct(a.adSrp, a.netUnitCost), gpPct(b.adSrp, b.netUnitCost));
      if (sortBy === 'reqSrp')   res = cmpNum(getRequiredSRP(a.netUnitCost, a.dept), getRequiredSRP(b.netUnitCost, b.dept));
      if (sortBy === 'scan')     res = cmpNum(getTotalScan(a), getTotalScan(b));
      if (sortBy === 'score')    res = cmpNum(a.score?.total, b.score?.total);
      return sortDir === 'asc' ? res : -res;
    });
    return base;
  }, [deals, sortBy, sortDir]);

  const filteredDeals = useMemo(() => {
    return sortedDeals.filter(d => {
      const textOk =
        !filterText ||
        String(d.itemCode).toLowerCase().includes(filterText.toLowerCase()) ||
        String(d.description ?? '').toLowerCase().includes(filterText.toLowerCase());
      const gpVal = gpDollars(d.adSrp, d.netUnitCost) ?? Number.NEGATIVE_INFINITY;
      const gpPctVal = (gpPct(d.adSrp, d.netUnitCost) ?? -1) * 100;
      const minGpOk = !minGp || gpVal >= Number(minGp);
      const minGpPctOk = !minGpPct || gpPctVal >= Number(minGpPct);
      return textOk && minGpOk && minGpPctOk;
    });
  }, [sortedDeals, filterText, minGp, minGpPct]);

  const getDeptChipClass = (dept: string) => {
    switch (dept.toLowerCase()) {
      case 'grocery': return 'dept-chip-grocery';
      case 'meat': return 'dept-chip-meat';
      case 'produce': return 'dept-chip-produce';
      case 'bakery': return 'dept-chip-bakery';
      case 'deli': return 'dept-chip-deli';
      case 'deli/bakery': return 'dept-chip-deli';
      default: return 'dept-chip-default';
    }
  };

  const getDeptEmoji = (dept: string) => {
    switch (dept.toLowerCase()) {
      case 'grocery': return '🛒';
      case 'meat': return '🥩';
      case 'produce': return '🥬';
      case 'bakery': return '🥖';
      case 'deli': return '🥪';
      case 'deli/bakery': return '🥪';
      default: return '📦';
    }
  };

  const getScoreInterpretation = (score: number) => {
    if (score >= 85) return { label: 'MUST INCLUDE', class: 'score-interpretation-must' };
    if (score >= 70) return { label: 'RECOMMENDED', class: 'score-interpretation-recommended' };
    if (score >= 55) return { label: 'CONSIDER', class: 'score-interpretation-consider' };
    return { label: 'SKIP', class: 'score-interpretation-skip' };
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-primary font-bold';
    if (score >= 70) return 'text-chart-3 font-bold';
    if (score >= 55) return 'text-chart-2 font-bold';
    return 'text-muted-foreground font-bold';
  };

  return (
    <TooltipProvider>
      <div className="bg-card rounded-lg border border-border overflow-hidden h-full flex flex-col">
        {/* Scrollable table container with fixed height */}
        <div className="flex-1 relative overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
          <table className="w-full table-fixed">
            {/* Column widths definition */}
            <colgroup>
              <col className="w-12" /> {/* Checkbox */}
              <col className="w-28" /> {/* Item Code */}
              <col className="w-64" /> {/* Description */}
              <col className="w-20" /> {/* Dept */}
              <col className="w-24" /> {/* Net Unit Cost */}
              <col className="w-24" /> {/* Ad SRP */}
              <col className="w-24" /> {/* GP$ */}
              <col className="w-24" /> {/* GP% */}
              <col className="w-28" /> {/* Req SRP */}
              <col className="w-24" /> {/* Scan */}
              <col className="w-32" /> {/* Score */}
              <col className="w-48" /> {/* Components */}
              <col className="w-32" /> {/* Actions */}
            </colgroup>
            
            <thead className="bg-muted sticky top-0 z-20 border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                  <Checkbox
                    checked={selectedDeals.size === deals.length && deals.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="select-all-checkbox"
                  />
                </th>
                <th onClick={() => onSort('itemCode')} className="text-left py-3 px-4 font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1">
                    Item Code
                    {getSortIcon('itemCode')}
                  </span>
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Description</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Dept</th>
                <th onClick={() => onSort('netUnitCost')} className="text-left py-3 px-4 font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1">
                    Net Unit Cost
                    {getSortIcon('netUnitCost')}
                  </span>
                </th>
                <th onClick={() => onSort('adSrp')} className="text-left py-3 px-4 font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1">
                    Ad SRP
                    {getSortIcon('adSrp')}
                  </span>
                </th>
                <th onClick={() => onSort('gp$')} className="text-left py-3 px-4 font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1">
                    GP$
                    {getSortIcon('gp$')}
                  </span>
                </th>
                <th onClick={() => onSort('gp%')} className="text-left py-3 px-4 font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1">
                    GP%
                    {getSortIcon('gp%')}
                  </span>
                </th>
                <th onClick={() => onSort('reqSrp')} className="text-left py-3 px-4 font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1">
                          Req SRP
                          <Info size={12} className="opacity-50" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Required SRP to hit department target margin
                      </TooltipContent>
                    </Tooltip>
                    {getSortIcon('reqSrp')}
                  </span>
                </th>
                <th onClick={() => onSort('scan')} className="text-left py-3 px-4 font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1">
                    Scan
                    {getSortIcon('scan')}
                  </span>
                </th>
                <th onClick={() => onSort('score')} className="text-left py-3 px-4 font-medium text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1">
                    Score
                    {getSortIcon('score')}
                  </span>
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Components</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
              </tr>

              {/* Filter row */}
              <tr className="bg-muted/70">
                <td className="py-2 px-4"></td>
                <td className="py-2 px-4" colSpan={2}>
                  <input
                    className="w-full text-xs px-2 py-1 rounded border border-border bg-card"
                    placeholder="Filter item/description…"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    data-testid="filter-text-input"
                  />
                </td>
                <td className="py-2 px-4"></td>
                <td className="py-2 px-4"></td>
                <td className="py-2 px-4"></td>
                <td className="py-2 px-4">
                  <input
                    className="w-20 text-xs px-2 py-1 rounded border border-border bg-card text-right"
                    placeholder="Min GP$"
                    value={minGp}
                    onChange={(e) => setMinGp(e.target.value)}
                    data-testid="filter-min-gp-input"
                  />
                </td>
                <td className="py-2 px-4">
                  <input
                    className="w-20 text-xs px-2 py-1 rounded border border-border bg-card text-right"
                    placeholder="Min %"
                    value={minGpPct}
                    onChange={(e) => setMinGpPct(e.target.value)}
                    data-testid="filter-min-gp-pct-input"
                  />
                </td>
                <td className="py-2 px-4"></td>
                <td className="py-2 px-4"></td>
                <td className="py-2 px-4"></td>
                <td className="py-2 px-4"></td>
                <td className="py-2 px-4"></td>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-border">
              {filteredDeals.map((deal) => {
              const interpretation = deal.score ? getScoreInterpretation(deal.score.total) : null;
              const gp$ = gpDollars(deal.adSrp, deal.netUnitCost);
              const gp = gpPct(deal.adSrp, deal.netUnitCost);
              const reqSrp = getRequiredSRP(deal.netUnitCost, deal.dept);
              const totalScan = getTotalScan(deal);
              const effectiveSrp = getEffectiveSRP(deal);
              const isBOGO = deal.description?.toLowerCase().includes('bogo') || 
                            deal.description?.toLowerCase().includes('buy one get one');
              const hasMultiUPC = deal.upc && deal.upc.includes(',');
              const isWeight = isWeightBased(deal);
              
              return (
                <tr 
                  key={deal.id} 
                  className={cn(
                    "hover:bg-accent/50 transition-colors cursor-pointer",
                    selectedDealId === deal.id && "bg-accent/50"
                  )}
                  onClick={() => onSelectDeal(deal.id)}
                  data-testid={`deal-row-${deal.id}`}
                >
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedDeals.has(deal.id)}
                      onCheckedChange={(checked) => handleSelectDeal(deal.id, checked as boolean)}
                      data-testid={`select-deal-${deal.id}`}
                    />
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-card-foreground">
                    {deal.itemCode}
                  </td>
                  <td className="py-3 px-4 text-sm text-card-foreground">
                    <div className="space-y-1">
                      <div className="truncate" title={deal.description}>
                        {deal.description}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {isBOGO && (
                          <Badge variant="secondary" className="text-xs">
                            BOGO
                          </Badge>
                        )}
                        {hasMultiUPC && (
                          <Badge variant="secondary" className="text-xs">
                            Multi-UPC
                          </Badge>
                        )}
                        {isWeight && (
                          <Badge variant="secondary" className="text-xs">
                            Weight
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={cn("score-chip px-2 py-1 inline-flex", getDeptChipClass(deal.dept))}>
                      {getDeptEmoji(deal.dept)}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-card-foreground">
                    {deal.netUnitCost ? `$${fmt(deal.netUnitCost)}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-card-foreground">
                    {deal.adSrp ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            ${fmt(deal.adSrp)}
                            {isBOGO && effectiveSrp && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (eff: ${fmt(effectiveSrp)})
                              </span>
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isBOGO ? (
                            <div>
                              <div>Ad SRP: ${fmt(deal.adSrp)}</div>
                              <div>Effective (BOGO): ${fmt(effectiveSrp)}</div>
                            </div>
                          ) : (
                            <div>Ad SRP: ${fmt(deal.adSrp)}</div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ) : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-card-foreground">
                    {gp$ != null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "cursor-help",
                            gp$ < 0 && "text-destructive"
                          )}>
                            ${fmt(gp$)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          ${fmt(deal.adSrp)} - ${fmt(deal.netUnitCost)} = ${fmt(gp$)}
                        </TooltipContent>
                      </Tooltip>
                    ) : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-card-foreground">
                    {gp != null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "cursor-help",
                            gp < 0 && "text-destructive",
                            gp >= 0.30 && "text-green-600 dark:text-green-400 font-medium"
                          )}>
                            {(gp * 100).toFixed(1)}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          (${fmt(gp$)} / ${fmt(deal.adSrp)}) = {(gp * 100).toFixed(1)}%
                        </TooltipContent>
                      </Tooltip>
                    ) : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-card-foreground">
                    {reqSrp != null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            ${fmt(reqSrp)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          SRP needed for {deal.dept} target margin
                        </TooltipContent>
                      </Tooltip>
                    ) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {totalScan > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="cursor-help">
                            Scan: {totalScan.toFixed(0)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            {deal.adScan && deal.adScan > 0 && (
                              <div>Ad Scan: {deal.adScan.toFixed(0)}</div>
                            )}
                            {deal.tprScan && deal.tprScan > 0 && (
                              <div>TPR Scan: {deal.tprScan.toFixed(0)}</div>
                            )}
                            {deal.edlcScan && deal.edlcScan > 0 && (
                              <div>EDLC Scan: {deal.edlcScan.toFixed(0)}</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {deal.score ? (
                      <div className="flex items-center gap-2">
                        <span className={cn("text-lg", getScoreColor(deal.score.total))}>
                          {deal.score.total.toFixed(1)}
                        </span>
                        <Badge className={cn("score-chip text-xs", interpretation?.class)}>
                          {interpretation?.label}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not scored</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {deal.score ? (
                      <div className="flex flex-wrap gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="score-chip score-chip-margin text-xs cursor-help">
                              M: {deal.score.components.margin.toFixed(0)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Margin ({(SCORING_WEIGHTS.margin * 100).toFixed(0)}% weight): {deal.score.components.margin.toFixed(1)}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="score-chip score-chip-velocity text-xs cursor-help">
                              V: {deal.score.components.velocity.toFixed(0)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Velocity ({(SCORING_WEIGHTS.velocity * 100).toFixed(0)}% weight): {deal.score.components.velocity.toFixed(1)}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="score-chip score-chip-funding text-xs cursor-help">
                              F: {deal.score.components.funding.toFixed(0)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Funding ({(SCORING_WEIGHTS.funding * 100).toFixed(0)}% weight): {deal.score.components.funding.toFixed(1)}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="score-chip score-chip-theme text-xs cursor-help">
                              T: {deal.score.components.theme.toFixed(0)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Theme ({(SCORING_WEIGHTS.theme * 100).toFixed(0)}% weight): {deal.score.components.theme.toFixed(1)}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="score-chip score-chip-timing text-xs cursor-help">
                              Ti: {deal.score.components.timing.toFixed(0)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Timing ({(SCORING_WEIGHTS.timing * 100).toFixed(0)}% weight): {deal.score.components.timing.toFixed(1)}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="score-chip score-chip-competitive text-xs cursor-help">
                              C: {deal.score.components.competitive.toFixed(0)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Competitive ({(SCORING_WEIGHTS.competitive * 100).toFixed(0)}% weight): {deal.score.components.competitive.toFixed(1)}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onSelectDeal(deal.id)}
                        title="View Details"
                        data-testid={`view-deal-${deal.id}`}
                      >
                        <Eye size={16} className="text-muted-foreground hover:text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Open Original"
                        data-testid={`open-original-${deal.id}`}
                      >
                        <ExternalLink size={16} className="text-muted-foreground hover:text-primary" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Lock Item"
                        data-testid={`lock-deal-${deal.id}`}
                      >
                        <Lock size={16} className="text-muted-foreground hover:text-primary" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-background">
          <div className="text-sm text-muted-foreground">
            Showing: {filteredDeals.length} of {deals.length} deals
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedDeals.size > 0 && `${selectedDeals.size} selected`}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}