import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  X, 
  ExternalLink, 
  Brain,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Deal {
  id: string;
  itemCode: string;
  description: string;
  dept: string;
  cost?: number | null;
  netUnitCost?: number | null;
  srp?: number | null;
  adSrp?: number | null;
  mvmt?: number | null;
  adScan?: number | null;
  tprScan?: number | null;
  edlcScan?: number | null;
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

export function DealDetailsDrawer({ dealId, deals, onClose }: DealDetailsDrawerProps) {
  const deal = dealId ? deals.find(d => d.id === dealId) : null;

  if (!deal) {
    return null;
  }

  const getMarginPercent = () => {
    if (!deal.netUnitCost || !deal.adSrp) return 0;
    return ((deal.adSrp - deal.netUnitCost) / deal.adSrp) * 100;
  };

  const getRequiredSRP = () => {
    if (!deal.netUnitCost) return null;
    const marginFloors: Record<string, number> = {
      Meat: 0.18,
      Grocery: 0.22,
      Produce: 0.25,
      Bakery: 0.30,
    };
    const targetMargin = marginFloors[deal.dept] || 0.30; // Default to 30% if dept not found
    return deal.netUnitCost / (1 - targetMargin);
  };

  const getTotalScan = () => {
    return (deal.adScan || 0) + (deal.tprScan || 0) + (deal.edlcScan || 0);
  };

  const scoreComponents = [
    { name: 'Margin', value: deal.score?.components.margin || 0, weight: 25, color: 'chart-2' },
    { name: 'Velocity', value: deal.score?.components.velocity || 0, weight: 25, color: 'chart-3' },
    { name: 'Funding', value: deal.score?.components.funding || 0, weight: 20, color: 'chart-4' },
    { name: 'Theme', value: deal.score?.components.theme || 0, weight: 15, color: 'chart-5' },
    { name: 'Timing', value: deal.score?.components.timing || 0, weight: 10, color: 'chart-1' },
    { name: 'Competitive', value: deal.score?.components.competitive || 0, weight: 5, color: 'secondary' },
  ];

  const departmentMixData = [
    { name: 'Meat', current: 18, target: 19, color: 'destructive', progress: 95 },
    { name: 'Grocery', current: 20, target: 19, color: 'chart-1', progress: 105 },
    { name: 'Produce', current: 12, target: 13, color: 'chart-4', progress: 92 },
    { name: 'Bakery', current: 15, target: 13, color: 'chart-3', progress: 115 },
  ];

  return (
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
                <p className="text-sm text-muted-foreground">Item Code: <span className="font-mono">{deal.itemCode}</span></p>
              </div>
              
              {/* Pricing Information */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {deal.cost ? `$${deal.cost.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Unit Cost</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {deal.netUnitCost ? `$${deal.netUnitCost.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Ad SRP</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {deal.adSrp ? `$${deal.adSrp.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margin</p>
                    <p className="text-sm font-medium text-chart-2">
                      {getMarginPercent().toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Required SRP @30%</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {getRequiredSRP() ? `$${getRequiredSRP()!.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expected Movement</p>
                    <p className="text-sm font-medium text-card-foreground">
                      {deal.mvmt ? `${deal.mvmt.toFixed(1)}x` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Scan Data */}
            <div className="bg-muted rounded-lg p-4">
              <h5 className="text-sm font-medium text-card-foreground mb-3">Scan Performance</h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total Scan</span>
                  <span className="text-sm font-medium text-card-foreground">
                    {getTotalScan().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Ad Scan</span>
                  <span className="text-xs text-muted-foreground">
                    {deal.adScan ? deal.adScan.toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">TPR Scan</span>
                  <span className="text-xs text-muted-foreground">
                    {deal.tprScan ? deal.tprScan.toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">EDLC Scan</span>
                  <span className="text-xs text-muted-foreground">
                    {deal.edlcScan ? deal.edlcScan.toFixed(2) : '0.00'}
                  </span>
                </div>
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
                        <span className="text-xs text-muted-foreground">({component.weight}%)</span>
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
                {getMarginPercent() >= 25 && (
                  <Badge className="score-chip bg-chart-2/20 text-chart-2">Good Margin</Badge>
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
  );
}