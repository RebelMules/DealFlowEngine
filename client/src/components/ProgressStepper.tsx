import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
  completed: boolean;
  active: boolean;
}

interface ProgressStepperProps {
  steps: Step[];
  progress: number;
  statusText: string;
}

export function ProgressStepper({ steps, progress, statusText }: ProgressStepperProps) {
  return (
    <div className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between max-w-4xl">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className="flex items-center space-x-1">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm",
                step.completed 
                  ? "bg-primary text-primary-foreground"
                  : step.active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              )}>
                {step.completed ? <Check size={16} /> : index + 1}
              </div>
              <span className={cn(
                "text-sm font-medium ml-2",
                step.completed || step.active 
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-px mx-4",
                step.completed ? "bg-primary" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-2 text-xs text-muted-foreground">
        Progress: {progress}% complete • {statusText}
      </div>
    </div>
  );
}
