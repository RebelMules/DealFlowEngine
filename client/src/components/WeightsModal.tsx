import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface WeightsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekId: string;
}

interface ScoringWeights {
  margin: number;
  velocity: number;
  funding: number;
  theme: number;
  timing: number;
  competitive: number;
}

const defaultWeights: ScoringWeights = {
  margin: 25,
  velocity: 25,
  funding: 20,
  theme: 15,
  timing: 10,
  competitive: 5,
};

export function WeightsModal({ open, onOpenChange, weekId }: WeightsModalProps) {
  const [weights, setWeights] = useState<ScoringWeights>(defaultWeights);
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();

  // Calculate total to ensure it equals 100%
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  const handleWeightChange = (component: keyof ScoringWeights, value: number[]) => {
    setWeights(prev => ({
      ...prev,
      [component]: value[0],
    }));
  };

  const handleReset = () => {
    setWeights(defaultWeights);
  };

  const handleApply = async () => {
    if (Math.abs(total - 100) > 0.1) {
      toast({
        title: "Invalid Weights",
        description: "Total weights must equal 100%",
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);
    try {
      // Convert percentages to decimals
      const normalizedWeights = {
        margin: weights.margin / 100,
        velocity: weights.velocity / 100,
        funding: weights.funding / 100,
        theme: weights.theme / 100,
        timing: weights.timing / 100,
        competitive: weights.competitive / 100,
      };

      await apiRequest('POST', `/api/weeks/${weekId}/score`, {
        weights: normalizedWeights,
      });

      // Invalidate deals query to refetch with new scores
      queryClient.invalidateQueries({ queryKey: ['/api/weeks', weekId, 'deals'] });

      toast({
        title: "Weights Applied",
        description: "Deal scores have been recalculated with new weights",
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to Apply Weights",
        description: error instanceof Error ? error.message : "Failed to apply new weights",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const weightComponents = [
    {
      key: 'margin' as const,
      label: 'Margin',
      description: 'Profit margin percentage and floor compliance',
      color: 'chart-2',
    },
    {
      key: 'velocity' as const,
      label: 'Velocity',
      description: 'Expected sales volume multiplier',
      color: 'chart-3',
    },
    {
      key: 'funding' as const,
      label: 'Funding',
      description: 'Vendor funding and promotional support',
      color: 'chart-4',
    },
    {
      key: 'theme' as const,
      label: 'Theme',
      description: 'Seasonal alignment and marketing themes',
      color: 'chart-5',
    },
    {
      key: 'timing' as const,
      label: 'Timing',
      description: 'Promotional timing alignment',
      color: 'chart-1',
    },
    {
      key: 'competitive' as const,
      label: 'Competitive',
      description: 'Competitive pricing advantage',
      color: 'secondary',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Scoring Weights</span>
            <span className={`text-sm ${Math.abs(total - 100) < 0.1 ? 'text-green-400' : 'text-red-400'}`}>
              Total: {total.toFixed(1)}%
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {weightComponents.map((component) => (
            <div key={component.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 bg-${component.color} rounded`} />
                  <Label className="font-medium text-card-foreground">
                    {component.label}
                  </Label>
                </div>
                <span className="text-sm font-medium text-card-foreground">
                  {weights[component.key]}%
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {component.description}
              </p>
              
              <Slider
                value={[weights[component.key]]}
                onValueChange={(value) => handleWeightChange(component.key, value)}
                max={50}
                min={0}
                step={1}
                className="w-full"
                data-testid={`weight-slider-${component.key}`}
              />
            </div>
          ))}

          {Math.abs(total - 100) > 0.1 && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">
                Weights must total 100%. Current total: {total.toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between space-x-3 pt-4 border-t border-border">
          <Button 
            variant="secondary" 
            onClick={handleReset}
            data-testid="reset-weights-button"
          >
            Reset Defaults
          </Button>
          <Button 
            onClick={handleApply}
            disabled={isApplying || Math.abs(total - 100) > 0.1}
            data-testid="apply-weights-button"
          >
            {isApplying ? "Applying..." : "Apply & Re-score"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
