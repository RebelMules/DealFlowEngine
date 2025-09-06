import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  X, 
  FileText, 
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  weekId: string;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  result?: {
    parsed: number;
    total: number;
    detectedType: string;
    errors: string[];
  };
}

export function FileUpload({ weekId, onClose, onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const uploadFiles = newFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
      progress: 0,
    }));

    setFiles(prev => [...prev, ...uploadFiles]);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    
    files.forEach(fileData => {
      formData.append('files', fileData.file);
    });

    try {
      // Update all files to uploading status
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const, progress: 0 })));

      const response = await fetch(`/api/weeks/${weekId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update files with results
      setFiles(prev => prev.map(fileData => {
        const fileResult = result.results.find((r: any) => r.file === fileData.file.name);
        if (fileResult) {
          return {
            ...fileData,
            status: fileResult.error ? 'error' as const : 'success' as const,
            progress: 100,
            error: fileResult.error,
            result: fileResult.error ? undefined : {
              parsed: fileResult.parsed,
              total: fileResult.total,
              detectedType: fileResult.detectedType,
              errors: fileResult.errors || [],
            },
          };
        }
        return fileData;
      }));

      const successCount = result.results.filter((r: any) => !r.error).length;
      const errorCount = result.results.filter((r: any) => r.error).length;

      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `Successfully processed ${successCount} file${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        });
        
        setTimeout(() => {
          onUploadComplete();
        }, 2000);
      } else {
        toast({
          title: "Upload Failed",
          description: "No files were processed successfully",
          variant: "destructive",
        });
      }

    } catch (error) {
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as const, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      })));
      
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-400" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      default:
        return <FileText size={16} className="text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Deal Files</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Upload Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-muted",
              "hover:border-primary/50"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-card-foreground mb-2">
              Upload Files
            </h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop files here, or click to select files
            </p>
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              data-testid="select-files-button"
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.pdf,.pptx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Supports CSV, XLSX, PDF, and PPTX files
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-card-foreground">Selected Files</h4>
              <div className="space-y-2 max-h-64 overflow-auto">
                {files.map((fileData) => (
                  <div key={fileData.id} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(fileData.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {fileData.file.name}
                        </p>
                        {fileData.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(fileData.id)}
                            data-testid={`remove-file-${fileData.id}`}
                          >
                            <X size={14} />
                          </Button>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileData.file.size)}
                      </p>

                      {fileData.status === 'uploading' && (
                        <Progress value={fileData.progress} className="mt-2 h-2" />
                      )}

                      {fileData.result && (
                        <div className="mt-2">
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>Type: {fileData.result.detectedType}</span>
                            <span>Parsed: {fileData.result.parsed}/{fileData.result.total}</span>
                          </div>
                          {fileData.result.errors.length > 0 && (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-xs text-yellow-400">
                                {fileData.result.errors.length} warning(s)
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}

                      {fileData.error && (
                        <p className="text-xs text-red-400 mt-1">{fileData.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} data-testid="cancel-upload">
            Cancel
          </Button>
          <Button 
            onClick={uploadFiles}
            disabled={files.length === 0 || isUploading}
            data-testid="upload-files-button"
          >
            {isUploading ? "Uploading..." : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
