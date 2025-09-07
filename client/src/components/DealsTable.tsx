import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  ExternalLink, 
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Deal {
  id: string;
  itemCode: string;
  description: string;
  dept: string;
  cost?: number | null;
  adSrp?: number | null;
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

export function DealsTable({ deals, onSelectDeal, selectedDealId }: DealsTableProps) {
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());

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

  const getDeptChipClass = (dept: string) => {
    switch (dept.toLowerCase()) {
      case 'grocery': return 'dept-chip-grocery';
      case 'meat': return 'dept-chip-meat';
      case 'produce': return 'dept-chip-produce';
      case 'bakery': return 'dept-chip-bakery';
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
    <div className="bg-card rounded-lg border border-border overflow-hidden h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full relative">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">
                <Checkbox
                  checked={selectedDeals.size === deals.length && deals.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="select-all-checkbox"
                />
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Item Code</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Description</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Dept</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Cost</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Ad SRP</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Score</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Components</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {deals.map((deal) => {
            const interpretation = deal.score ? getScoreInterpretation(deal.score.total) : null;
            
            return (
              <tr 
                key={deal.id} 
                className={cn(
                  "table-row-hover transition-colors cursor-pointer",
                  selectedDealId === deal.id && "bg-accent/50"
                )}
                onClick={() => onSelectDeal(deal.id)}
                data-testid={`deal-row-${deal.id}`}
              >
                <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedDeals.has(deal.id)}
                    onCheckedChange={(checked) => handleSelectDeal(deal.id, checked as boolean)}
                    data-testid={`select-deal-${deal.id}`}
                  />
                </td>
                <td className="py-3 px-4 font-mono text-sm text-card-foreground whitespace-nowrap">
                  {deal.itemCode}
                </td>
                <td className="py-3 px-4 text-sm text-card-foreground max-w-xs truncate">
                  <div className="truncate" title={deal.description}>
                    {deal.description}
                  </div>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <Badge className={cn("score-chip px-2 py-1", getDeptChipClass(deal.dept))}>
                    {getDeptEmoji(deal.dept)}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-sm text-card-foreground whitespace-nowrap">
                  {deal.cost ? `$${deal.cost.toFixed(2)}` : '-'}
                </td>
                <td className="py-3 px-4 text-sm font-medium text-card-foreground whitespace-nowrap">
                  {deal.adSrp ? `$${deal.adSrp.toFixed(2)}` : '-'}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {deal.score ? (
                    <div className="flex items-center space-x-2">
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
                    <div className="flex flex-wrap gap-1 min-w-[200px]">
                      <Badge className="score-chip score-chip-margin">
                        Margin: {deal.score.components.margin.toFixed(0)}
                      </Badge>
                      <Badge className="score-chip score-chip-velocity">
                        Velocity: {deal.score.components.velocity.toFixed(0)}
                      </Badge>
                      <Badge className="score-chip score-chip-funding">
                        Funding: {deal.score.components.funding.toFixed(0)}
                      </Badge>
                    </div>
                  ) : null}
                </td>
                <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onSelectDeal(deal.id)}
                      title="View Details"
                      data-testid={`view-deal-${deal.id}`}
                    >
                      <Eye size={16} className="text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      title="Open Original"
                      data-testid={`open-original-${deal.id}`}
                    >
                      <ExternalLink size={16} className="text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
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
      <div className="flex items-center justify-between p-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          Total: {deals.length} deals
        </div>
        <div className="text-sm text-muted-foreground">
          {selectedDeals.size > 0 && `${selectedDeals.size} selected`}
        </div>
      </div>
    </div>
  );
}