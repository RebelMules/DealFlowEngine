import { useState } from "react";
import { useWeeks } from "@/hooks/useWeeks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Calendar,
  Plus,
  FileText,
  TrendingUp,
  Download,
  AlertCircle,
  Trash2,
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WeekSelectorModal } from "@/components/WeekSelectorModal";
import type { InsertAdWeek } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function WeeksPage() {
  const { data: weeks, isLoading } = useWeeks();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekSelectorOpen, setWeekSelectorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [weekToDelete, setWeekToDelete] = useState<{id: string, week: number} | null>(null);

  const createWeekMutation = useMutation({
    mutationFn: async (weekData: InsertAdWeek) => {
      const response = await apiRequest('POST', '/api/weeks', weekData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weeks'] });
      toast({
        title: "Week Created",
        description: "New ad week has been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create new week",
        variant: "destructive",
      });
      console.error('Error creating week:', error);
    },
  });

  // Helper function to generate week data for a specific week
  const generateWeekData = (year: number, weekNumber: number) => {
    // Calculate start and end dates for the week
    const getDateOfISOWeek = (year: number, week: number) => {
      const simple = new Date(year, 0, 1 + (week - 1) * 7);
      const dow = simple.getDay();
      const ISOweekStart = simple;
      if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
      } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
      }
      return ISOweekStart;
    };

    const weekStart = getDateOfISOWeek(year, weekNumber);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return {
      year,
      week: weekNumber,
      label: `${year}-W${weekNumber.toString().padStart(2, '0')}`,
      start: weekStart,
      end: weekEnd,
      status: "Inbox" as const,
    };
  };

  const handleSelectWeek = (weekNumber: number, year: number) => {
    const weekData = generateWeekData(year, weekNumber);
    createWeekMutation.mutate(weekData);
  };

  const deleteWeekMutation = useMutation({
    mutationFn: async (weekId: string) => {
      const response = await apiRequest('DELETE', `/api/weeks/${weekId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Week deleted",
        description: "The week and all associated data have been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/weeks'] });
      setDeleteDialogOpen(false);
      setWeekToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete the week. Please try again.",
        variant: "destructive",
      });
      console.error('Error deleting week:', error);
    },
  });

  const handleDeleteClick = (week: {id: string, week: number}) => {
    setWeekToDelete(week);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (weekToDelete) {
      deleteWeekMutation.mutate(weekToDelete.id);
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading weeks...</div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Inbox': return 'bg-blue-500/20 text-blue-400';
      case 'Parsing': return 'bg-yellow-500/20 text-yellow-400';
      case 'Issues': return 'bg-red-500/20 text-red-400';
      case 'Scored': return 'bg-green-500/20 text-green-400';
      case 'Exported': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Inbox': return <FileText size={16} />;
      case 'Parsing': return <TrendingUp size={16} />;
      case 'Issues': return <AlertCircle size={16} />;
      case 'Scored': return <TrendingUp size={16} />;
      case 'Exported': return <Download size={16} />;
      default: return <Calendar size={16} />;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">Ad Weeks</h1>
          <p className="text-muted-foreground">
            Manage weekly deal optimization cycles
          </p>
        </div>
        <Button 
          onClick={() => setWeekSelectorOpen(true)}
          disabled={createWeekMutation.isPending}
          data-testid="create-week-button"
        >
          <Plus size={16} className="mr-2" />
          {createWeekMutation.isPending ? "Creating..." : "Add Week"}
        </Button>
      </div>

      {/* Weeks Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {weeks?.map((week) => (
          <Card key={week.id} className="hover:bg-accent hover:bg-opacity-50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-card-foreground mb-1">
                    {week.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Week {week.week} • {week.year}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={cn("flex items-center space-x-1", getStatusColor(week.status))}>
                    {getStatusIcon(week.status)}
                    <span>{week.status}</span>
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleDeleteClick(week)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete Week
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="text-sm text-muted-foreground mb-4">
                {new Date(week.start).toLocaleDateString()} - {new Date(week.end).toLocaleDateString()}
              </div>

              <div className="flex space-x-2">
                <Link href={`/weeks/${week.id}/inbox`}>
                  <Button variant="outline" size="sm" className="flex-1" data-testid={`week-${week.id}-inbox`}>
                    Inbox
                  </Button>
                </Link>
                <Link href={`/weeks/${week.id}/deals`}>
                  <Button variant="outline" size="sm" className="flex-1" data-testid={`week-${week.id}-deals`}>
                    Deals
                  </Button>
                </Link>
                <Link href={`/weeks/${week.id}/exports`}>
                  <Button variant="outline" size="sm" className="flex-1" data-testid={`week-${week.id}-exports`}>
                    Exports
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!weeks || weeks.length === 0) && !isLoading && (
        <div className="flex flex-col items-center justify-center h-64">
          <Calendar size={48} className="text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-card-foreground mb-2">
            No weeks found
          </h3>
          <p className="text-muted-foreground mb-4">
            Create your first ad week to start optimizing deals
          </p>
          <Button 
            onClick={() => setWeekSelectorOpen(true)}
            disabled={createWeekMutation.isPending}
            data-testid="create-first-week-button"
          >
            <Plus size={16} className="mr-2" />
            {createWeekMutation.isPending ? "Creating..." : "Add First Week"}
          </Button>
        </div>
      )}
      
      {/* Week Selector Modal */}
      <WeekSelectorModal
        open={weekSelectorOpen}
        onOpenChange={setWeekSelectorOpen}
        onSelectWeek={handleSelectWeek}
        existingWeeks={weeks?.map(w => ({ week: w.week, year: w.year, status: w.status })) || []}
      />

      {/* Delete Week Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Week {weekToDelete?.week}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>This action will permanently delete this week and all associated data including:</span>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>All uploaded documents</li>
                <li>All parsed deals</li>
                <li>All calculated scores</li>
                <li>All export history</li>
              </ul>
              <span className="font-semibold text-destructive block">
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWeekToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteWeekMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWeekMutation.isPending ? "Deleting..." : "Delete Week"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
