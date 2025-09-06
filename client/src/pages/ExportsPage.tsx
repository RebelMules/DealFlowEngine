import { useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressStepper } from "@/components/ProgressStepper";
import { useToast } from "@/hooks/use-toast";
import { 
  Download,
  FileText,
  Calendar,
  ExternalLink,
  Trash2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

const stepperSteps = [
  { key: 'ingest', label: 'Ingest', completed: true, active: false },
  { key: 'map', label: 'Map', completed: true, active: false },
  { key: 'validate', label: 'Validate', completed: true, active: false },
  { key: 'score', label: 'Score', completed: true, active: false },
  { key: 'review', label: 'Review', completed: true, active: false },
  { key: 'export', label: 'Export', completed: true, active: true },
];

export default function ExportsPage() {
  const { id: weekId } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['csv', 'txt', 'json']);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch export history
  const { data: exports, isLoading } = useQuery({
    queryKey: ['/api/weeks', weekId, 'exports'],
    enabled: !!weekId,
  });

  const exportTypes = [
    {
      id: 'csv',
      label: 'Pick List CSV',
      description: 'Ranked deal list with pricing strategies for buyers',
      icon: FileText,
    },
    {
      id: 'txt',
      label: 'Buyer Report TXT',
      description: 'Departmental summary with action items and alerts',
      icon: FileText,
    },
    {
      id: 'json',
      label: 'Designer JSON',
      description: 'Structured data for ad layout and design systems',
      icon: FileText,
    },
  ];

  const handleExportTypeChange = (typeId: string, checked: boolean) => {
    if (checked) {
      setSelectedTypes(prev => [...prev, typeId]);
    } else {
      setSelectedTypes(prev => prev.filter(id => id !== typeId));
    }
  };

  const handleGenerateExports = async () => {
    if (!weekId || selectedTypes.length === 0) {
      toast({
        title: "No Export Types Selected",
        description: "Please select at least one export type to generate",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      await apiRequest('POST', `/api/weeks/${weekId}/export`, {
        types: selectedTypes,
      });

      // Invalidate and refetch exports
      queryClient.invalidateQueries({ queryKey: ['/api/weeks', weekId, 'exports'] });

      toast({
        title: "Exports Generated",
        description: `Successfully generated ${selectedTypes.length} export files`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to generate exports",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      csv: 'Pick List CSV',
      txt: 'Buyer Report TXT',
      json: 'Designer JSON',
    };
    return typeMap[type] || type.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading exports...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress Stepper */}
      <ProgressStepper 
        steps={stepperSteps}
        progress={100}
        statusText={`${exports?.length || 0} export files generated`}
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Export Generator */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download size={20} />
              <span>Generate New Exports</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select the export formats you need and generate files from the current deal bank.
              </p>
              
              {/* Export Type Selection */}
              <div className="grid gap-4 md:grid-cols-3">
                {exportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div key={type.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={type.id}
                        checked={selectedTypes.includes(type.id)}
                        onCheckedChange={(checked) => 
                          handleExportTypeChange(type.id, checked as boolean)
                        }
                        data-testid={`export-type-${type.id}`}
                      />
                      <div className="flex-1">
                        <label htmlFor={type.id} className="flex items-center space-x-2 cursor-pointer">
                          <Icon size={16} className="text-muted-foreground" />
                          <span className="font-medium text-card-foreground">{type.label}</span>
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {type.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button 
                onClick={handleGenerateExports}
                disabled={isExporting || selectedTypes.length === 0}
                className="w-full"
                data-testid="generate-exports-button"
              >
                <Download size={16} className="mr-2" />
                {isExporting ? "Generating..." : "Generate Exports"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export History */}
        <div>
          <h2 className="text-lg font-semibold text-card-foreground mb-4">Export History</h2>
          
          {exports && exports.length > 0 ? (
            <div className="space-y-3">
              {exports.map((exportItem: any) => (
                <Card key={exportItem.id} className="hover:bg-accent/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <FileText size={20} className="text-muted-foreground" />
                        <div>
                          <h3 className="font-medium text-card-foreground">
                            {getTypeLabel(exportItem.artifactType)}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span className="flex items-center space-x-1">
                              <Calendar size={14} />
                              <span>{formatDate(exportItem.createdAt)}</span>
                            </span>
                            <span>Created by: {exportItem.createdBy}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {exportItem.artifactType.toUpperCase()}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid={`download-${exportItem.id}`}
                        >
                          <Download size={14} className="mr-1" />
                          Download
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          title="View Details"
                          data-testid={`view-${exportItem.id}`}
                        >
                          <ExternalLink size={14} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 bg-muted/20 rounded-lg border-2 border-dashed border-muted">
              <FileText size={48} className="text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-card-foreground mb-2">
                No exports generated yet
              </h3>
              <p className="text-muted-foreground text-center">
                Generate your first export files to see them listed here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
