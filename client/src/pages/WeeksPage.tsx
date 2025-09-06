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
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function WeeksPage() {
  const { data: weeks, isLoading } = useWeeks();
  
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
        <Button data-testid="create-week-button">
          <Plus size={16} className="mr-2" />
          Create New Week
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
                <Badge className={cn("flex items-center space-x-1", getStatusColor(week.status))}>
                  {getStatusIcon(week.status)}
                  <span>{week.status}</span>
                </Badge>
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
          <Button data-testid="create-first-week-button">
            <Plus size={16} className="mr-2" />
            Create First Week
          </Button>
        </div>
      )}
    </div>
  );
}
