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

// Mock data - replace with real API calls
const mockDocuments = [
  {
    id: '1',
    filename: 'Hernando_Ad_Planner_W26.xlsx',
    kind: 'ad-planner',
    vendor: 'Hernando',
    byteSize: 2048576,
    parsedRows: 847,
    totalRows: 888,
    status: 'parsed',
    detectedType: 'Ad Planner',
    errors: [],
  },
  {
    id: '2',
    filename: 'Meat_Planner_Jun25.xlsx',
    kind: 'meat-planner',
    vendor: 'Meat Dept',
    byteSize: 1024000,
    parsedRows: 156,
    totalRows: 160,
    status: 'parsed',
    detectedType: 'Meat Planner',
    errors: ['4 rows missing cost data'],
  },
  {
    id: '3',
    filename: 'Alliance_Group_Buy_Summer.pdf',
    kind: 'group-buy-pdf',
    vendor: 'Alliance',
    byteSize: 8192000,
    parsedRows: 0,
    totalRows: 0,
    status: 'ai_required',
    detectedType: 'Group Buy PDF',
    errors: ['PDF parsing requires AI service'],
  },
];

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'parsed': return 'bg-green-500/20 text-green-400';
      case 'parsing': return 'bg-yellow-500/20 text-yellow-400';
      case 'error': return 'bg-red-500/20 text-red-400';
      case 'ai_required': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const totalParsedRows = mockDocuments.reduce((sum, doc) => sum + doc.parsedRows, 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress Stepper */}
      <ProgressStepper 
        steps={stepperSteps}
        progress={75}
        statusText={`Ready to score ${totalParsedRows} deals`}
      />

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
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
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="score-all-deals">
              <FileText size={16} className="mr-2" />
              Score All Deals
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
                // TODO: Refetch documents
              }}
            />
          )}
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          {mockDocuments.map((doc) => (
            <Card key={doc.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileText size={20} className="text-muted-foreground" />
                      <h3 className="font-medium text-card-foreground">{doc.filename}</h3>
                      <Badge className={cn("text-xs", getStatusColor(doc.status))}>
                        {doc.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-6 text-sm text-muted-foreground mb-3">
                      <span>Type: {doc.detectedType}</span>
                      <span>Size: {formatFileSize(doc.byteSize)}</span>
                      {doc.vendor && <span>Vendor: {doc.vendor}</span>}
                    </div>

                    {doc.status === 'parsed' && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-card-foreground">Parsing Progress</span>
                          <span className="text-muted-foreground">
                            {doc.parsedRows} / {doc.totalRows} rows
                          </span>
                        </div>
                        <Progress 
                          value={(doc.parsedRows / doc.totalRows) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}

                    {doc.errors.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-yellow-400 mb-1">Warnings:</p>
                        <ul className="list-disc list-inside text-xs text-muted-foreground">
                          {doc.errors.map((error, index) => (
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
                      data-testid={`open-original-${doc.id}`}
                    >
                      <ExternalLink size={16} />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      title="Map Columns"
                      data-testid={`map-columns-${doc.id}`}
                    >
                      <Settings size={16} />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      title="Reprocess"
                      data-testid={`reprocess-${doc.id}`}
                    >
                      <RefreshCw size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {mockDocuments.length === 0 && (
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
