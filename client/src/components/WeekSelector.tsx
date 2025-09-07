import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdWeek } from "@shared/schema";

interface WeekSelectorProps {
  weeks: AdWeek[];
  currentWeek: AdWeek | undefined;
  onWeekChange: (week: AdWeek) => void;
  pageType: 'inbox' | 'deals' | 'exports' | 'other';
}

export function WeekSelector({ weeks, currentWeek, onWeekChange, pageType }: WeekSelectorProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  const getPageTitle = () => {
    if (location.includes('/inbox')) return 'Weekly Inbox';
    if (location.includes('/deals')) return 'Weekly Deal Bank';
    if (location.includes('/exports')) return 'Weekly Exports';
    return 'Deal Optimizer';
  };

  const formatWeekDisplay = (week: AdWeek) => {
    const startDate = new Date(week.start).toLocaleDateString();
    const endDate = new Date(week.end).toLocaleDateString();
    return `Week ${week.week} (${startDate} - ${endDate})`;
  };

  const formatWeekSearchable = (week: AdWeek) => {
    const startDate = new Date(week.start).toLocaleDateString();
    const endDate = new Date(week.end).toLocaleDateString();
    return `Week ${week.week} ${week.year} ${startDate} ${endDate}`;
  };

  return (
    <div>
      <div className="flex items-center space-x-2">
        <h2 className="text-lg font-semibold text-card-foreground">
          {getPageTitle()}
        </h2>
        {currentWeek && (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>
      
      {currentWeek && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              className="justify-between text-xs text-muted-foreground hover:text-foreground p-0 h-auto font-normal"
              data-testid="week-selector"
            >
              {formatWeekDisplay(currentWeek)}
              <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search weeks..." 
                className="h-9"
              />
              <CommandList>
                <CommandEmpty>No weeks found.</CommandEmpty>
                <CommandGroup>
                  {weeks.map((week) => (
                    <CommandItem
                      key={week.id}
                      value={formatWeekSearchable(week)}
                      onSelect={() => {
                        onWeekChange(week);
                        setOpen(false);
                      }}
                      data-testid={`week-option-${week.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          currentWeek?.id === week.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div>
                        <div className="font-medium">Week {week.week} - {week.year}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(week.start).toLocaleDateString()} - {new Date(week.end).toLocaleDateString()}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}