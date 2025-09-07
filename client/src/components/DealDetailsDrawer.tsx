import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
    const targetMargin = marginFloors[deal.dept] || 0.15;
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
    <aside className="w-80 bg-card border-l border-border overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-card-foreground">Deal Details</h3>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="close-drawer">
            <X size={16} />
          </Button>
        </div>

        {/* Deal Details */}
        <div>
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Item Code:</span>
              <span className="font-mono text-sm text-card-foreground">{deal.itemCode}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Cost:</span>
              <span className="text-sm text-card-foreground">
                {deal.cost ? `$${deal.cost.toFixed(2)}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Net Unit Cost:</span>
              <span className="text-sm font-medium text-card-foreground">
                {deal.netUnitCost ? `$${deal.netUnitCost.toFixed(2)}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Ad SRP:</span>
              <span className="text-sm font-medium text-card-foreground">
                {deal.adSrp ? `$${deal.adSrp.toFixed(2)}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Margin:</span>
              <span className="text-sm text-chart-2 font-medium">
                {getMarginPercent().toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Required SRP:</span>
              <span className="text-sm text-card-foreground">
                {getRequiredSRP() ? `$${getRequiredSRP()!.toFixed(2)}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Scan:</span>
              <span className="text-sm text-card-foreground">
                {getTotalScan().toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Ad Scan:</span>
              <span className="text-xs text-muted-foreground">
                {deal.adScan ? deal.adScan.toFixed(0) : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">TPR Scan:</span>
              <span className="text-xs text-muted-foreground">
                {deal.tprScan ? deal.tprScan.toFixed(0) : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">EDLC Scan:</span>
              <span className="text-xs text-muted-foreground">
                {deal.edlcScan ? deal.edlcScan.toFixed(0) : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Expected Movement:</span>
              <span className="text-sm text-card-foreground">
                {deal.mvmt ? `${deal.mvmt.toFixed(1)}x` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        {deal.score && (
          <div>
            <h3 className="text-lg font-semibold text-card-foreground mb-4">Score Breakdown</h3>
            <div className="space-y-3">
              {scoreComponents.map((component) => (
                <div key={component.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={cn("w-3 h-3 rounded", `bg-${component.color}`)} />
                    <span className="text-sm text-card-foreground">{component.name}</span>
                    <span className="text-xs text-muted-foreground">({component.weight}%)</span>
                  </div>
                  <span className="text-sm font-medium text-card-foreground">
                    {component.value.toFixed(0)}
                  </span>
                </div>
              ))}
              
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-card-foreground">Total Score</span>
                  <span className="text-lg font-bold text-primary">
                    {deal.score.total.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Explanation */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-card-foreground">Explanation</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs bg-muted text-muted-foreground hover:bg-accent"
              data-testid="ai-refine-button"
            >
              <Brain size={12} className="mr-1" />
              AI Refine
            </Button>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-card-foreground leading-relaxed">
              {deal.score?.reasons.join(' ') || 'No explanation available for this deal.'}
            </p>
            
            {/* Score-based tags */}
            <div className="mt-3 flex flex-wrap gap-2">
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
        <div>
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Source Document</h3>
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <FileText className="text-chart-2" size={20} />
              <div>
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
        <div>
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Department Mix</h3>
          <div className="space-y-3">
            {departmentMixData.map((dept) => (
              <div key={dept.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-card-foreground">{dept.name}</span>
                  <span className="text-muted-foreground">
                    {dept.current}/{dept.target} (target)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className={cn("h-2 rounded-full", `bg-${dept.color}`)}
                    style={{ width: `${Math.min(100, dept.progress)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </aside>
  );
}
