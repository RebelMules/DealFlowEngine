import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  ExternalLink, 
  Lock,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Deal {
  id: string;
  itemCode: string;
  description: string;
  dept: string;
  cost?: number;
  adSrp?: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const dealsPerPage = 20;

  const totalPages = Math.ceil(deals.length / dealsPerPage);
  const startIndex = (currentPage - 1) * dealsPerPage;
  const endIndex = startIndex + dealsPerPage;
  const currentDeals = deals.slice(startIndex, endIndex);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDeals(new Set(currentDeals.map(d => d.id)));
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
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                <Checkbox
                  checked={selectedDeals.size === currentDeals.length && currentDeals.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="select-all-checkbox"
                />
              </th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Item Code</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Description</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Dept</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Cost</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Ad SRP</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Score</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Components</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {currentDeals.map((deal) => {
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
                  <td className="py-3 px-4 text-sm text-card-foreground max-w-xs truncate">
                    {deal.description}
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={cn("score-chip", getDeptChipClass(deal.dept))}>
                      {deal.dept}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-card-foreground">
                    {deal.cost ? `$${deal.cost.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-card-foreground">
                    {deal.adSrp ? `$${deal.adSrp.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-3 px-4">
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
                      <div className="flex flex-wrap gap-1">
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
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
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

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between p-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(endIndex, deals.length)} of {deals.length} deals
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            data-testid="previous-page"
          >
            <ChevronLeft size={16} className="mr-1" />
            Previous
          </Button>
          
          {/* Page numbers */}
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages, currentPage - 2 + i));
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  data-testid={`page-${pageNum}`}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            data-testid="next-page"
          >
            Next
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
