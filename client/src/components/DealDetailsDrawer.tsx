import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  X, 
  ExternalLink, 
  Brain,
  FileText,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    reasons: string[];
  };
}

interface DealDetailsDrawerProps {
  dealId: string | null;
  deals: Deal[];
  onClose: () => void;
}

const SCORING_WEIGHTS = {
  margin: 0.25,
  velocity: 0.25,
  funding: 0.20,
  theme: 0.15,
  timing: 0.10,
  competitive: 0.05,
};

export function DealDetailsDrawer({ dealId, deals, onClose }: DealDetailsDrawerProps) {
  const deal = dealId ? deals.find(d => d.id === dealId) : null;

  if (!deal) {
    return null;
  }

  const getGpDollars = () => {
    if (!deal.netUnitCost || !deal.adSrp) return null;
    return deal.adSrp - deal.netUnitCost;
  };

  const getMarginPercent = () => {
    if (!deal.netUnitCost || !deal.adSrp || deal.adSrp === 0) return 0;
    return ((deal.adSrp - deal.netUnitCost) / deal.adSrp) * 100;
  };

  const getRequiredSRP = (targetMargin?: number) => {
    if (!deal.netUnitCost) return null;
    const marginFloors: Record<string, number> = {
      Meat: 0.18,
      Grocery: 0.22,
      Produce: 0.25,
      Bakery: 0.30,
      Deli: 0.28,
      'Deli/Bakery': 0.29,
    };
    const margin = targetMargin || marginFloors[deal.dept] || 0.30;
    return deal.netUnitCost / (1 - margin);
  };

  const getTotalScan = () => {
    return (deal.adScan || 0) + (deal.tprScan || 0) + (deal.edlcScan || 0);
  };

  const getEffectiveSRP = () => {
    const isBOGO = deal.description?.toLowerCase().includes('bogo') || 
                   deal.description?.toLowerCase().includes('buy one get one');
    if (isBOGO && deal.srp) {
      return deal.srp / 2;
    }
    return deal.adSrp;
  };

  const isWeightBased = () => {
    const desc = deal.description?.toLowerCase() || '';
    const size = deal.size?.toLowerCase() || '';
    return desc.includes('/lb') || desc.includes('per lb') || 
           size.includes('lb') || size.includes('oz') || size.includes('kg');
  };

  const isBOGO = deal.description?.toLowerCase().includes('bogo') || 
                 deal.description?.toLowerCase().includes('buy one get one');
  const hasMultiUPC = deal.upc && deal.upc.includes(',');
  const isWeight = isWeightBased();
  const gpDollars = getGpDollars();
  const gpPercent = getMarginPercent();
  const reqSrp = getRequiredSRP();
  const effectiveSrp = getEffectiveSRP();

  const scoreComponents = [
    { name: 'Margin', value: deal.score?.components.margin || 0, weight: SCORING_WEIGHTS.margin * 100, color: 'chart-2' },
    { name: 'Velocity', value: deal.score?.components.velocity || 0, weight: SCORING_WEIGHTS.velocity * 100, color: 'chart-3' },
    { name: 'Funding', value: deal.score?.components.funding || 0, weight: SCORING_WEIGHTS.funding * 100, color: 'chart-4' },
    { name: 'Theme', value: deal.score?.components.theme || 0, weight: SCORING_WEIGHTS.theme * 100, color: 'chart-5' },
    { name: 'Timing', value: deal.score?.components.timing || 0, weight: SCORING_WEIGHTS.timing * 100, color: 'chart-1' },
    { name: 'Competitive', value: deal.score?.components.competitive || 0, weight: SCORING_WEIGHTS.competitive * 100, color: 'secondary' },
  ];

  const departmentMixData = [
    { name: 'Meat', current: 18, target: 19, color: 'destructive', progress: 95 },
    { name: 'Grocery', current: 20, target: 19, color: 'chart-1', progress: 105 },
    { name: 'Produce', current: 12, target: 13, color: 'chart-4', progress: 92 },
    { name: 'Bakery', current: 15, target: 13, color: 'chart-3', progress: 115 },
  ];

  return (
    <TooltipProvider>
      <aside className="w-96 h-full bg-card border-l border-border flex flex-col">
        {/* Fixed Header */}
        <div className="shrink-0 p-6 pb-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-card-foreground">Deal Details</h3>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="close-drawer">
              <X size={16} />
            </Button>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 pt-4 space-y-8">
            {/* Deal Overview */}
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <div className="mb-4 pb-4 border-b border-border">
                  <h4 className="font-medium text-card-foreground text-base mb-2">{deal.description}</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-muted-foreground">Item Code: <span className="font-mono">{deal.itemCode}</span></p>
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
                  {deal.upc && (
                    <p className="text-xs text-muted-foreground mt-1">UPC: {deal.upc}</p>
                  )}
                </div>
                
                {/* Pricing Information Grid */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Net Unit Cost</p>
                      <p className="text-sm font-medium text-card-foreground">
                        {deal.netUnitCost ? `$${deal.netUnitCost.toFixed(2)}` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Ad SRP
                        {isBOGO && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info size={10} className="cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Effective BOGO price: ${effectiveSrp?.toFixed(2)}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </p>
                      <p className="text-sm font-medium text-card-foreground">
                        {deal.adSrp ? `$${deal.adSrp.toFixed(2)}` : 'N/A'}
                        {isBOGO && effectiveSrp && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (eff: ${effectiveSrp.toFixed(2)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        GP$
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info size={10} className="cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            ${deal.adSrp?.toFixed(2)} - ${deal.netUnitCost?.toFixed(2)} = ${gpDollars?.toFixed(2)}
                          </TooltipContent>
                        </Tooltip>
                      </p>
                      <p className={cn(
                        "text-sm font-medium",
                        gpDollars && gpDollars < 0 ? "text-destructive" : "text-card-foreground"
                      )}>
                        {gpDollars != null ? `$${gpDollars.toFixed(2)}` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        GP%
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info size={10} className="cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            (${gpDollars?.toFixed(2)} / ${deal.adSrp?.toFixed(2)}) = {gpPercent.toFixed(1)}%
                          </TooltipContent>
                        </Tooltip>
                      </p>
                      <p className={cn(
                        "text-sm font-medium",
                        gpPercent < 0 ? "text-destructive" : 
                        gpPercent >= 30 ? "text-green-600 dark:text-green-400" : "text-chart-2"
                      )}>
                        {gpPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Required SRP
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info size={10} className="cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            SRP needed for {deal.dept} target margin
                          </TooltipContent>
                        </Tooltip>
                      </p>
                      <p className="text-sm font-medium text-card-foreground">
                        {reqSrp ? `$${reqSrp.toFixed(2)}` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expected Movement</p>
                      <p className="text-sm font-medium text-card-foreground">
                        {deal.mvmt ? `${deal.mvmt.toFixed(1)}x` : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {deal.vendorFundingPct && deal.vendorFundingPct > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Vendor Funding</p>
                        <p className="text-sm font-medium text-card-foreground">
                          {(deal.vendorFundingPct * 100).toFixed(1)}%
                        </p>
                      </div>
                      {deal.competitorPrice && (
                        <div>
                          <p className="text-xs text-muted-foreground">Competitor Price</p>
                          <p className="text-sm font-medium text-card-foreground">
                            ${deal.competitorPrice.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Scan Data */}
              <div className="bg-muted rounded-lg p-4">
                <h5 className="text-sm font-medium text-card-foreground mb-3">Scan Performance</h5>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Total Scan</span>
                    <Badge variant="outline" className="text-xs">
                      {getTotalScan().toFixed(0)}
                    </Badge>
                  </div>
                  {deal.adScan && deal.adScan > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Ad Scan</span>
                      <span className="text-xs text-muted-foreground">
                        {deal.adScan.toFixed(0)}
                      </span>
                    </div>
                  )}
                  {deal.tprScan && deal.tprScan > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">TPR Scan</span>
                      <span className="text-xs text-muted-foreground">
                        {deal.tprScan.toFixed(0)}
                      </span>
                    </div>
                  )}
                  {deal.edlcScan && deal.edlcScan > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">EDLC Scan</span>
                      <span className="text-xs text-muted-foreground">
                        {deal.edlcScan.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            {deal.score && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-card-foreground">Score Breakdown</h4>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{deal.score.total.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Total Score</div>
                  </div>
                </div>
                
                <div className="bg-muted rounded-lg p-4 space-y-3">
                  {scoreComponents.map((component) => (
                    <div key={component.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-3 h-3 rounded", `bg-${component.color}`)} />
                          <span className="text-sm text-card-foreground">{component.name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground cursor-help">
                                ({component.weight.toFixed(0)}% weight)
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Contributes {(component.value * component.weight / 100).toFixed(1)} to total score
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-sm font-medium text-card-foreground">
                          {component.value.toFixed(0)}
                        </span>
                      </div>
                      <Progress 
                        value={component.value} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explanation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-card-foreground">AI Explanation</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-8"
                  data-testid="ai-refine-button"
                >
                  <Brain size={12} className="mr-1" />
                  Refine
                </Button>
              </div>
              
              <div className="bg-muted rounded-lg p-4 space-y-4">
                <p className="text-sm text-card-foreground leading-relaxed">
                  {deal.score?.reasons.join(' ') || 'No explanation available for this deal.'}
                </p>
                
                {/* Score-based tags */}
                <div className="flex flex-wrap gap-2">
                  {deal.score && deal.score.components.velocity >= 80 && (
                    <Badge className="score-chip bg-primary/20 text-primary">High Velocity</Badge>
                  )}
                  {gpPercent >= 25 && (
                    <Badge className="score-chip bg-chart-2/20 text-chart-2">Good Margin</Badge>
                  )}
                  {deal.score && deal.score.components.funding >= 70 && (
                    <Badge className="score-chip bg-chart-4/20 text-chart-4">Strong Funding</Badge>
                  )}
                  {deal.score && deal.score.components.theme >= 80 && (
                    <Badge className="score-chip bg-chart-5/20 text-chart-5">Seasonal Theme</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Source Document */}
            <div className="space-y-4">
              <h4 className="text-base font-semibold text-card-foreground">Source Document</h4>
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="text-chart-2" size={20} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-card-foreground">
                      Grocery_Planner_W26.xlsx
                    </div>
                    <div className="text-xs text-muted-foreground">Page 2, Row 45</div>
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  data-testid="open-original-document"
                >
                  <ExternalLink size={16} className="mr-2" />
                  Open Original Document
                </Button>
              </div>
            </div>

            {/* Department Mix */}
            <div className="space-y-4">
              <h4 className="text-base font-semibold text-card-foreground">Department Mix Impact</h4>
              <div className="bg-muted rounded-lg p-4 space-y-4">
                {departmentMixData.map((dept) => (
                  <div key={dept.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-card-foreground font-medium">{dept.name}</span>
                      <span className="text-muted-foreground">
                        {dept.current}/{dept.target} (target)
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div 
                        className={cn("h-2 rounded-full transition-all", `bg-${dept.color}`)}
                        style={{ width: `${Math.min(100, dept.progress)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dept.progress}% of target
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}