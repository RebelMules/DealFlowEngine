import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ExternalLink, 
  Brain,
  FileText,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DealRow, Score, ScoreComponents } from "@shared/schema";

interface DealWithScore extends DealRow {
  score?: Score;
}

interface DealDetailsDrawerProps {
  dealId: string | null;
  deals: DealWithScore[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCORING_WEIGHTS = {
  margin: 0.25,
  velocity: 0.25,
  funding: 0.20,
  theme: 0.15,
  timing: 0.10,
  competitive: 0.05,
};

export function DealDetailsDrawer({ dealId, deals, open, onOpenChange }: DealDetailsDrawerProps) {
  const deal = dealId ? deals.find(d => d.id === dealId) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Deal Details</SheetTitle>
          <SheetDescription className="sr-only">
            View detailed information about the selected deal
          </SheetDescription>
        </SheetHeader>
        
        {deal ? (
          <DealContent deal={deal} />
        ) : (
          <div className="flex items-center justify-center h-96 text-muted-foreground">
            No deal selected
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DealContent({ deal }: { deal: DealWithScore }) {
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

  const components = (deal.score?.components || {}) as ScoreComponents;
  const scoreComponents = [
    { name: 'Margin', value: components.margin || 0, weight: SCORING_WEIGHTS.margin * 100, color: 'chart-2' },
    { name: 'Velocity', value: components.velocity || 0, weight: SCORING_WEIGHTS.velocity * 100, color: 'chart-3' },
    { name: 'Funding', value: components.funding || 0, weight: SCORING_WEIGHTS.funding * 100, color: 'chart-4' },
    { name: 'Theme', value: components.theme || 0, weight: SCORING_WEIGHTS.theme * 100, color: 'chart-5' },
    { name: 'Timing', value: components.timing || 0, weight: SCORING_WEIGHTS.timing * 100, color: 'chart-1' },
    { name: 'Competitive', value: components.competitive || 0, weight: SCORING_WEIGHTS.competitive * 100, color: 'secondary' },
  ];

  const departmentMixData = [
    { name: 'Meat', current: 18, target: 19, color: 'destructive', progress: 95 },
    { name: 'Grocery', current: 20, target: 19, color: 'chart-1', progress: 105 },
    { name: 'Produce', current: 12, target: 13, color: 'chart-4', progress: 92 },
    { name: 'Bakery', current: 15, target: 13, color: 'chart-3', progress: 115 },
  ];

  return (
    <TooltipProvider>
      <ScrollArea className="h-[calc(100vh-120px)] mt-6">
        <div className="space-y-8 pr-4">
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
                            <p className="text-xs">Effective price: ${effectiveSrp?.toFixed(2) || 'N/A'}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </p>
                    <p className="text-sm font-medium text-card-foreground">
                      {deal.adSrp ? `$${deal.adSrp.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Regular SRP</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {deal.srp ? `$${deal.srp.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vendor Funding</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {deal.vendorFundingPct ? `${deal.vendorFundingPct}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Movement</p>
                <p className="text-lg font-semibold text-card-foreground">
                  {deal.mvmt ? deal.mvmt.toLocaleString() : '0'}
                </p>
                <p className="text-xs text-muted-foreground">units/week</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Total Scan</p>
                <p className="text-lg font-semibold text-card-foreground">
                  {getTotalScan().toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ad: {deal.adScan || 0} | TPR: {deal.tprScan || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-card-foreground">Financial Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">Gross Profit ($)</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info size={10} className="cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Ad SRP - Net Unit Cost</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-lg font-semibold text-card-foreground">
                  {gpDollars !== null ? `$${gpDollars.toFixed(2)}` : 'N/A'}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">Gross Profit (%)</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info size={10} className="cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">(Ad SRP - Net Cost) / Ad SRP</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-lg font-semibold text-card-foreground">
                  {gpPercent.toFixed(1)}%
                </p>
              </div>
            </div>
            
            {reqSrp && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Required SRP for {deal.dept} margin floor</p>
                <p className="text-sm font-medium text-card-foreground">
                  ${reqSrp.toFixed(2)} <span className="text-xs text-muted-foreground">(current: ${deal.adSrp?.toFixed(2) || 'N/A'})</span>
                </p>
              </div>
            )}
          </div>

          {/* Score Breakdown */}
          {deal.score && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-card-foreground">Score Breakdown</h4>
                <Badge className={cn(
                  "text-xs font-semibold",
                  deal.score.total >= 85 ? "bg-green-500 hover:bg-green-600" :
                  deal.score.total >= 70 ? "bg-blue-500 hover:bg-blue-600" :
                  deal.score.total >= 55 ? "bg-yellow-500 hover:bg-yellow-600" :
                  "bg-red-500 hover:bg-red-600"
                )}>
                  Score: {deal.score.total}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {scoreComponents.map((component) => (
                  <div key={component.name} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-card-foreground">{component.name}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground cursor-help">
                            {component.value} × {component.weight}% = {(component.value * component.weight / 100).toFixed(1)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Weight: {component.weight}%</p>
                          <p className="text-xs">Contribution: {(component.value * component.weight / 100).toFixed(1)} points</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Progress 
                      value={component.value} 
                      className={cn("h-2", `bg-${component.color}/20`)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Explanation */}
          {deal.score && (() => {
            const reasons = (deal.score.reasons || []) as string[];
            return reasons.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain size={16} className="text-primary" />
                    <h4 className="text-base font-semibold text-card-foreground">AI Explanation</h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="refine-explanation"
                  >
                    Refine
                  </Button>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <ul className="space-y-2">
                    {reasons.map((reason, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-sm text-card-foreground">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}

          {/* Source Document */}
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-card-foreground">Source Document</h4>
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <FileText size={20} className="text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-card-foreground">vendor_deals_2024.xlsx</p>
                  <p className="text-xs text-muted-foreground">Page 3, Row 42</p>
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
    </TooltipProvider>
  );
}