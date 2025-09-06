import { useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileUpload } from "@/components/FileUpload";
import { ProgressStepper } from "@/components/ProgressStepper";
import { 
  Upload, 
  FileText, 
  ExternalLink, 
  Settings,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SourceDoc } from "@shared/schema";

// Extended type for documents with parsing info stored in meta field
interface DocumentWithMeta extends SourceDoc {
  meta: {
    parsedRows?: number;
    totalRows?: number;
    errors?: string[];
    detectedType?: string;
    status?: string;
  } | null;
}

const stepperSteps = [
  { key: 'ingest', label: 'Ingest', completed: true, active: false },
  { key: 'map', label: 'Map', completed: true, active: false },
  { key: 'validate', label: 'Validate', completed: true, active: false },
  { key: 'score', label: 'Score', completed: false, active: true },
  { key: 'review', label: 'Review', completed: false, active: false },
  { key: 'export', label: 'Export', completed: false, active: false },
];

export default function InboxPage() {
  const { id: weekId } = useParams<{ id: string }>();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch documents for this week
  const { data: documents = [], isLoading, refetch } = useQuery<DocumentWithMeta[]>({
    queryKey: ['/api/weeks', weekId, 'documents'],
    enabled: !!weekId,
  });

  // Mutation for reprocessing a document
  const reprocessDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      const response = await fetch(`/api/documents/${docId}/reparse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reprocess document');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Document Reprocessed",
        description: `Successfully reprocessed ${data.file}. Parsed ${data.reparsed} of ${data.total} rows.`,
      });
      refetch(); // Refresh documents list
    },
    onError: (error: Error) => {
      toast({
        title: "Reprocess Failed",
        description: error.message || "Failed to reprocess document",
        variant: "destructive",
      });
    },
  });

  const scoreAllDealsMutation = useMutation({
    mutationFn: async () => {
      try {
        const response = await fetch(`/api/weeks/${weekId}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw data; // Throw the error data to be caught in onError
        }
        
        return data;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Scoring Complete",
        description: `Successfully scored ${data.scored} deals with average score ${data.averageScore.toFixed(1)}`,
      });
    },
    onError: (error: any) => {
      // Get the actual error message from the error object
      let errorMessage = "Failed to score deals. Please try again.";
      
      if (error?.message) {
        errorMessage = error.message;
      }
      
      if (error?.issues && error.issues.length > 0) {
        errorMessage = `Quality check failed:\n${error.issues.join('\n')}`;
      }
      
      toast({
        title: "Scoring Failed",
        description: errorMessage,
        variant: "destructive",
      });
      console.error('Error scoring deals:', error);
    },
  });

  const handleScoreAllDeals = () => {
    scoreAllDealsMutation.mutate();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'parsed': return 'bg-green-500/20 text-green-400';
      case 'parsing': return 'bg-yellow-500/20 text-yellow-400';
      case 'error': return 'bg-red-500/20 text-red-400';
      case 'ai_required': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Calculate total parsed rows from documents
  const totalParsedRows = documents.reduce((sum, doc) => sum + (doc.meta?.parsedRows || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress Stepper */}
      <ProgressStepper 
        steps={stepperSteps}
        progress={75}
        statusText={`Ready to score ${totalParsedRows} deals`}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Quality Gate Banner */}
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="text-primary" size={20} />
              <div>
                <h3 className="font-medium text-card-foreground">Quality Gate: Ready to Score</h3>
                <p className="text-sm text-muted-foreground">
                  All validation checks passed. {totalParsedRows} deals ready for scoring.
                </p>
              </div>
            </div>
            <Button 
              onClick={handleScoreAllDeals}
              disabled={scoreAllDealsMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90" 
              data-testid="score-all-deals"
            >
              <FileText size={16} className="mr-2" />
              {scoreAllDealsMutation.isPending ? "Scoring..." : "Score All Deals"}
            </Button>
          </div>
        </div>

        {/* Upload Area */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-card-foreground">Source Documents</h2>
            <Button onClick={() => setUploadModalOpen(true)} data-testid="upload-files-button">
              <Upload size={16} className="mr-2" />
              Upload Files
            </Button>
          </div>

          {/* Upload Modal */}
          {uploadModalOpen && (
            <FileUpload
              weekId={weekId!}
              onClose={() => setUploadModalOpen(false)}
              onUploadComplete={() => {
                setUploadModalOpen(false);
                refetch(); // Refetch documents after upload
              }}
            />
          )}
        </div>

        {/* Documents List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="animate-spin text-muted-foreground" size={24} />
            <span className="ml-2 text-muted-foreground">Loading documents...</span>
          </div>
        ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:bg-accent hover:bg-opacity-30 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileText size={20} className="text-muted-foreground" />
                      <h3 className="font-medium text-card-foreground">{doc.filename}</h3>
                      {doc.meta?.status && (
                        <Badge className={cn("text-xs", getStatusColor(doc.meta.status))}>
                          {doc.meta.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center space-x-6 text-sm text-muted-foreground mb-3">
                      <span>Type: {doc.meta?.detectedType || doc.kind}</span>
                      <span>Size: {formatFileSize(doc.byteSize)}</span>
                      {doc.vendor && <span>Vendor: {doc.vendor}</span>}
                    </div>

                    {doc.meta?.status === 'parsed' && doc.meta?.totalRows && doc.meta.totalRows > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-card-foreground">Parsing Progress</span>
                          <span className="text-muted-foreground">
                            {doc.meta.parsedRows} / {doc.meta.totalRows} rows
                          </span>
                        </div>
                        <Progress 
                          value={(doc.meta.parsedRows! / doc.meta.totalRows) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}

                    {doc.meta?.errors && doc.meta.errors.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-yellow-400 mb-1">Warnings:</p>
                        <ul className="list-disc list-inside text-xs text-muted-foreground">
                          {doc.meta.errors.map((error: string, index: number) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      title="Open Original"
                      onClick={() => {
                        // Open the original file in a new tab
                        window.open(`/api/documents/${doc.id}/download`, '_blank');
                      }}
                      data-testid={`open-original-${doc.id}`}
                    >
                      <ExternalLink size={16} />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      title="Map Columns"
                      onClick={() => {
                        toast({
                          title: "Column Mapping",
                          description: "Column mapping configuration coming soon. The system automatically detects standard columns for now.",
                        });
                      }}
                      data-testid={`map-columns-${doc.id}`}
                    >
                      <Settings size={16} />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      title="Reprocess"
                      onClick={() => reprocessDocumentMutation.mutate(doc.id)}
                      disabled={reprocessDocumentMutation.isPending}
                      data-testid={`reprocess-${doc.id}`}
                    >
                      <RefreshCw size={16} className={reprocessDocumentMutation.isPending ? "animate-spin" : ""} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}

        {!isLoading && documents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg border-2 border-dashed border-muted">
            <Upload size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-card-foreground mb-2">
              No documents uploaded
            </h3>
            <p className="text-muted-foreground mb-4">
              Upload CSV, XLSX, PDF, or PPTX files to start processing deals
            </p>
            <Button onClick={() => setUploadModalOpen(true)} data-testid="upload-first-files">
              <Upload size={16} className="mr-2" />
              Upload Files
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
