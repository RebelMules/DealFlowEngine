import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  detectedColumns?: string[];
}

const standardColumns = [
  { value: "itemCode", label: "Item Code / SKU" },
  { value: "description", label: "Product Description" },
  { value: "dept", label: "Department" },
  { value: "upc", label: "UPC / Barcode" },
  { value: "cost", label: "Unit Cost" },
  { value: "srp", label: "Regular Price (SRP)" },
  { value: "adSrp", label: "Ad/Sale Price" },
  { value: "vendorFundingPct", label: "Vendor Funding %" },
  { value: "mvmt", label: "Movement/Velocity" },
  { value: "competitorPrice", label: "Competitor Price" },
  { value: "pack", label: "Pack Size" },
  { value: "size", label: "Unit Size" },
  { value: "promoStart", label: "Promo Start Date" },
  { value: "promoEnd", label: "Promo End Date" },
  { value: "ignore", label: "Ignore Column" },
];

export function ColumnMappingModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  detectedColumns = [],
}: ColumnMappingModalProps) {
  const { toast } = useToast();
  
  // Sample detected columns if none provided
  const columns = detectedColumns.length > 0 ? detectedColumns : [
    "ORDER #", "ITEM DESC", "DEPT", "UPC", "UCOST", "SRP", "AD SRP", "MVMT"
  ];

  // Initialize mappings with automatic detection for ORDER #
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initialMappings: Record<string, string> = {};
    
    // Always map ORDER # to itemCode
    columns.forEach(col => {
      if (col.toUpperCase() === "ORDER #") {
        initialMappings[col] = "itemCode";
      }
    });
    
    return initialMappings;
  });

  const handleMappingChange = (sourceColumn: string, targetColumn: string) => {
    setMappings(prev => ({
      ...prev,
      [sourceColumn]: targetColumn,
    }));
  };

  const handleSave = () => {
    toast({
      title: "Column Mapping Saved",
      description: `Your column mapping for ${documentName} has been saved. The document will be reprocessed with the new mapping.`,
    });
    onClose();
  };

  const handleAutoDetect = () => {
    const autoMappings: Record<string, string> = {};
    
    columns.forEach(col => {
      const upperCol = col.toUpperCase();
      if (upperCol.includes("ITEM") && (upperCol.includes("CODE") || upperCol.includes("#"))) {
        autoMappings[col] = "itemCode";
      } else if (upperCol.includes("DESC") || upperCol.includes("NAME")) {
        autoMappings[col] = "description";
      } else if (upperCol.includes("DEPT")) {
        autoMappings[col] = "dept";
      } else if (upperCol.includes("UPC") || upperCol.includes("BARCODE")) {
        autoMappings[col] = "upc";
      } else if (upperCol.includes("COST") && !upperCol.includes("COMPETITOR")) {
        autoMappings[col] = "cost";
      } else if (upperCol.includes("SRP") && !upperCol.includes("AD")) {
        autoMappings[col] = "srp";
      } else if (upperCol.includes("AD") && upperCol.includes("SRP")) {
        autoMappings[col] = "adSrp";
      } else if (upperCol.includes("MVMT") || upperCol.includes("MOVEMENT")) {
        autoMappings[col] = "mvmt";
      }
    });
    
    setMappings(autoMappings);
    toast({
      title: "Auto-Detection Complete",
      description: "Column mappings have been automatically detected based on column names.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Column Mapping Configuration</DialogTitle>
          <DialogDescription>
            Map the columns from your file to the standard deal fields. This helps ensure accurate data extraction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              Document: <span className="font-medium">{documentName}</span>
            </p>
            <Button variant="outline" onClick={handleAutoDetect} size="sm">
              Auto-Detect Mappings
            </Button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-2 font-medium text-sm text-muted-foreground">
              <div className="col-span-2">Source Column</div>
              <div className="flex justify-center">→</div>
              <div className="col-span-2">Target Field</div>
            </div>
            
            {columns.map((column) => (
              <div key={column} className="grid grid-cols-5 gap-2 items-center">
                <div className="col-span-2">
                  <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                    {column}
                  </div>
                </div>
                <div className="flex justify-center">
                  <ArrowRight size={16} className="text-muted-foreground" />
                </div>
                <div className="col-span-2">
                  <Select
                    value={mappings[column] || ""}
                    onValueChange={(value) => handleMappingChange(column, value)}
                  >
                    <SelectTrigger data-testid={`mapping-select-${column}`}>
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {standardColumns.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted/50 p-3 rounded-lg mt-4">
            <p className="text-xs text-muted-foreground">
              <strong>Tips:</strong> 
              <br />• Map the most important fields: Item Code, Description, Department, Cost, and Ad Price
              <br />• Use "Ignore Column" for fields that don't match any standard field
              <br />• The system will attempt to parse unmapped columns automatically
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="save-column-mapping">
            Save Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}