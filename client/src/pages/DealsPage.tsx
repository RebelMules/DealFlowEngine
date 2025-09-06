import { useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DealsTable } from "@/components/DealsTable";
import { DealDetailsDrawer } from "@/components/DealDetailsDrawer";
import { WeightsModal } from "@/components/WeightsModal";
import { ProgressStepper } from "@/components/ProgressStepper";
import { useDeals } from "@/hooks/useDeals";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator,
  Sliders,
  Filter,
  AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const stepperSteps = [
  { key: 'ingest', label: 'Ingest', completed: true, active: false },
  { key: 'map', label: 'Map', completed: true, active: false },
  { key: 'validate', label: 'Validate', completed: true, active: false },
  { key: 'score', label: 'Score', completed: false, active: true },
  { key: 'review', label: 'Review', completed: false, active: false },
  { key: 'export', label: 'Export', completed: false, active: false },
];

export default function DealsPage() {
  const { id: weekId } = useParams<{ id: string }>();
  const { data: deals, isLoading } = useDeals(weekId!);
  const { toast } = useToast();
  
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [weightsModalOpen, setWeightsModalOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [isScoring, setIsScoring] = useState(false);

  const handleFilters = () => {
    toast({
      title: "Filters",
      description: "Advanced filters panel coming soon...",
    });
  };

  // Calculate statistics
  const totalDeals = deals?.length || 0;
  const scoredDeals = deals?.filter(d => d.score) || [];
  const averageScore = scoredDeals.length > 0 
    ? scoredDeals.reduce((sum, d) => sum + (d.score?.total || 0), 0) / scoredDeals.length 
    : 0;

  // Filter deals
  const filteredDeals = deals?.filter(deal => {
    if (deptFilter !== "all" && deal.dept !== deptFilter) return false;
    if (scoreFilter !== "all") {
      const score = deal.score?.total || 0;
      switch (scoreFilter) {
        case "must-include":
          return score >= 85;
        case "recommended":
          return score >= 70 && score < 85;
        case "consider":
          return score >= 55 && score < 70;
        case "skip":
          return score < 40;
        default:
          return true;
      }
    }
    return true;
  }) || [];

  // Get unique departments
  const departments = Array.from(new Set(deals?.map(d => d.dept) || []));

  const handleScoreAllDeals = async () => {
    if (!weekId) return;
    
    setIsScoring(true);
    try {
      await apiRequest('POST', `/api/weeks/${weekId}/score`, {});
      
      // Invalidate and refetch deals
      queryClient.invalidateQueries({ queryKey: ['/api/weeks', weekId, 'deals'] });
      
      toast({
        title: "Scoring Complete",
        description: `Successfully scored ${totalDeals} deals`,
      });
    } catch (error) {
      toast({
        title: "Scoring Failed",
        description: error instanceof Error ? error.message : "Failed to score deals",
        variant: "destructive",
      });
    } finally {
      setIsScoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading deals...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress Stepper */}
      <ProgressStepper 
        steps={stepperSteps}
        progress={scoredDeals.length > 0 ? 85 : 75}
        statusText={scoredDeals.length > 0 
          ? `Scored ${scoredDeals.length} deals • Average score: ${averageScore.toFixed(1)}`
          : `Ready to score ${totalDeals} deals`
        }
      />

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Quality Gate Banner */}
          {scoredDeals.length === 0 && (
            <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="text-primary" size={20} />
                  <div>
                    <h3 className="font-medium text-card-foreground">Quality Gate: Ready to Score</h3>
                    <p className="text-sm text-muted-foreground">
                      All validation checks passed. {totalDeals} deals ready for scoring.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleScoreAllDeals}
                  disabled={isScoring}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="score-all-deals-button"
                >
                  <Calculator size={16} className="mr-2" />
                  {isScoring ? "Scoring..." : "Score All Deals"}
                </Button>
              </div>
            </div>
          )}

          {/* Filters and Actions */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-card-foreground">Department:</label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-48" data-testid="department-filter">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-card-foreground">Score Range:</label>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-48" data-testid="score-filter">
                    <SelectValue placeholder="All Scores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scores</SelectItem>
                    <SelectItem value="must-include">≥85 Must Include</SelectItem>
                    <SelectItem value="recommended">70-84 Recommended</SelectItem>
                    <SelectItem value="consider">55-69 Consider</SelectItem>
                    <SelectItem value="skip">&lt;40 Skip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setWeightsModalOpen(true)}
                data-testid="weights-button"
              >
                <Sliders size={16} className="mr-2" />
                Weights
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleFilters}
                data-testid="filters-button"
              >
                <Filter size={16} className="mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {/* Deals Table */}
          <DealsTable 
            deals={filteredDeals}
            onSelectDeal={setSelectedDeal}
            selectedDealId={selectedDeal}
          />
        </div>

        {/* Deal Details Drawer */}
        <DealDetailsDrawer 
          dealId={selectedDeal}
          deals={deals || []}
          onClose={() => setSelectedDeal(null)}
        />
      </div>

      {/* Weights Modal */}
      <WeightsModal 
        open={weightsModalOpen}
        onOpenChange={setWeightsModalOpen}
        weekId={weekId!}
      />
    </div>
  );
}
