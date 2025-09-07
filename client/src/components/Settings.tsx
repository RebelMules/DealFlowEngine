import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Brain, 
  Settings as SettingsIcon,
  FileText,
  Zap,
  Info,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Settings({ open, onOpenChange }: SettingsProps) {
  // AI is automatically enabled when API keys are present
  const [aiEnabled, setAiEnabled] = useState(true); // Always on when keys are present
  const [autoApplyAI, setAutoApplyAI] = useState(true);
  const [scoringWeights, setScoringWeights] = useState({
    margin: 30,
    velocity: 25,
    funding: 20,
    theme: 10,
    timing: 10,
    competitive: 5,
  });
  const { toast } = useToast();

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('dealOptimizerSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setAiEnabled(settings.aiEnabled ?? true);
      setAutoApplyAI(settings.autoApplyAI ?? true);
      if (settings.scoringWeights) {
        setScoringWeights(settings.scoringWeights);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    const settings = {
      aiEnabled,
      autoApplyAI,
      scoringWeights,
    };
    localStorage.setItem('dealOptimizerSettings', JSON.stringify(settings));
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
    onOpenChange(false);
  };

  const [activeTab, setActiveTab] = useState("ai");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your Deal Optimizer preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai" data-testid="settings-tab-ai">AI Assistant</TabsTrigger>
            <TabsTrigger value="scoring" data-testid="settings-tab-scoring">Scoring</TabsTrigger>
            <TabsTrigger value="general" data-testid="settings-tab-general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Document Processing
                </CardTitle>
                <CardDescription>
                  Configure how AI assists with document parsing and analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="ai-enabled" className="text-base">
                      AI Assistant
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Enable AI for advanced document parsing
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                    <Switch
                      id="ai-enabled"
                      checked={true}
                      onCheckedChange={() => {}}
                      disabled={true} // Always on when API keys are configured
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-apply" className="text-base">
                      Auto-Apply AI
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically use AI when standard parsing fails
                    </p>
                  </div>
                  <Switch
                    id="auto-apply"
                    checked={autoApplyAI}
                    onCheckedChange={setAutoApplyAI}
                  />
                </div>

                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="font-medium">AI Processing Status: <span className="text-green-600">Active</span></p>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                        <li>Standard spreadsheets (.xlsx, .csv) parse instantly</li>
                        <li>Complex PDFs and PowerPoints use AI extraction automatically</li>
                        <li>AI serves as failover when standard parsing fails</li>
                        <li>All extracted data is validated before scoring</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Supported Document Types</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: 'Excel Planners', status: 'Standard', icon: FileText },
                      { type: 'CSV Files', status: 'Standard', icon: FileText },
                      { type: 'PDF Group Buys', status: 'AI Required', icon: Brain },
                      { type: 'PowerPoint Decks', status: 'AI Required', icon: Brain },
                    ].map((doc) => (
                      <div key={doc.type} className="flex items-center gap-2 p-2 rounded-md border">
                        <doc.icon className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{doc.type}</p>
                          <Badge variant="outline" className="text-xs">
                            {doc.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scoring Weights</CardTitle>
                <CardDescription>
                  Adjust the importance of each scoring component (must total 100%)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(scoringWeights).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`weight-${key}`} className="capitalize">
                        {key}
                      </Label>
                      <span className="text-sm text-muted-foreground">{value}%</span>
                    </div>
                    <input
                      id={`weight-${key}`}
                      type="range"
                      min="0"
                      max="50"
                      value={value}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value);
                        setScoringWeights(prev => ({ ...prev, [key]: newValue }));
                      }}
                      className="w-full"
                    />
                  </div>
                ))}
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total</span>
                    <span className={`text-sm font-bold ${
                      Object.values(scoringWeights).reduce((a, b) => a + b, 0) === 100
                        ? 'text-green-500'
                        : 'text-red-500'
                    }`}>
                      {Object.values(scoringWeights).reduce((a, b) => a + b, 0)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Preferences</CardTitle>
                <CardDescription>
                  Configure general application settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Auto-save drafts</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically save your work as you go
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Show tooltips</Label>
                    <p className="text-sm text-muted-foreground">
                      Display helpful hints throughout the app
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Compact view</Label>
                    <p className="text-sm text-muted-foreground">
                      Show more deals per page in tables
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveSettings}>
            <Check className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}