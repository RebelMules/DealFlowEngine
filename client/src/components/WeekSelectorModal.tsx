import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeekSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWeek: (weekNumber: number, year: number) => void;
  existingWeeks: { week: number; year: number; status: string }[];
}

export function WeekSelectorModal({ 
  open, 
  onOpenChange, 
  onSelectWeek, 
  existingWeeks = [] 
}: WeekSelectorModalProps) {
  const [selectedYear] = useState(2025);
  
  // Generate all 52 weeks of the year
  const getWeekDates = (year: number, weekNumber: number) => {
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = new Date(simple);
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    
    const weekEnd = new Date(ISOweekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    return {
      start: ISOweekStart,
      end: weekEnd
    };
  };
  
  const weeks = Array.from({ length: 52 }, (_, i) => {
    const weekNumber = i + 1;
    const { start, end } = getWeekDates(selectedYear, weekNumber);
    const existing = existingWeeks.find(w => w.week === weekNumber && w.year === selectedYear);
    
    return {
      number: weekNumber,
      year: selectedYear,
      label: `Week ${weekNumber}`,
      dateRange: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      month: start.toLocaleDateString('en-US', { month: 'long' }),
      status: existing?.status,
      exists: !!existing
    };
  });
  
  // Group weeks by month
  const weeksByMonth = weeks.reduce((acc, week) => {
    if (!acc[week.month]) {
      acc[week.month] = [];
    }
    acc[week.month].push(week);
    return acc;
  }, {} as Record<string, typeof weeks>);
  
  const getStatusColor = (status?: string) => {
    if (!status) return '';
    switch (status) {
      case 'Inbox': return 'bg-blue-500/20 text-blue-400';
      case 'Parsing': return 'bg-yellow-500/20 text-yellow-400';
      case 'Issues': return 'bg-red-500/20 text-red-400';
      case 'Scored': return 'bg-green-500/20 text-green-400';
      case 'Exported': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  
  const handleSelectWeek = (weekNumber: number) => {
    onSelectWeek(weekNumber, selectedYear);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar size={20} />
            <span>Select Week - {selectedYear}</span>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {Object.entries(weeksByMonth).map(([month, monthWeeks]) => (
              <div key={month}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-background py-2">
                  {month}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {monthWeeks.map((week) => (
                    <Button
                      key={week.number}
                      variant={week.exists ? "secondary" : "outline"}
                      className={cn(
                        "h-auto p-3 flex flex-col items-start space-y-1",
                        week.exists && "border-primary/50"
                      )}
                      onClick={() => handleSelectWeek(week.number)}
                      data-testid={`select-week-${week.number}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold">{week.label}</span>
                        {week.status && (
                          <Badge className={cn("text-xs", getStatusColor(week.status))}>
                            {week.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-muted-foreground">
                          {week.dateRange}
                        </span>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}