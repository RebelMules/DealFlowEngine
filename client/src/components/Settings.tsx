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
  const [compactView, setCompactView] = useState(true); // Default to compact view ON
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
      setCompactView(settings.compactView ?? true); // Default to true if not saved
      if (settings.scoringWeights) {
        setScoringWeights(settings.scoringWeights);
      }
      
      // Apply compact view immediately on load
      if (settings.compactView !== false) {
        document.documentElement.classList.add('compact-view');
      } else {
        document.documentElement.classList.remove('compact-view');
      }
    } else {
      // Default compact view to true when no settings exist
      document.documentElement.classList.add('compact-view');
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    const settings = {
      aiEnabled,
      autoApplyAI,
      compactView,
      scoringWeights,
    };
    localStorage.setItem('dealOptimizerSettings', JSON.stringify(settings));
    
    // Apply compact view immediately to document
    if (compactView) {
      document.documentElement.classList.add('compact-view');
    } else {
      document.documentElement.classList.remove('compact-view');
    }
    
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
            {/* Scoring Metrics Explanation */}
            <Card>
              <CardHeader>
                <CardTitle>Scoring Metrics & Calculations</CardTitle>
                <CardDescription>
                  Understanding how each component is calculated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {/* Margin Component */}
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                        <span className="text-chart-2 font-bold">M</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium text-sm">Margin Score (0-100)</h4>
                        <p className="text-xs text-muted-foreground">
                          Calculated from gross profit percentage (GP%)
                        </p>
                        <div className="bg-background rounded-md p-2 space-y-1">
                          <code className="text-xs block">GP$ = Ad SRP - Net Unit Cost</code>
                          <code className="text-xs block">GP% = GP$ / Ad SRP × 100</code>
                        </div>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p>• Below dept floor (18-30%) = 0 points</p>
                          <p>• At dept floor = 50 points</p>
                          <p>• 30%+ margin = 100 points</p>
                          <p>• Linear scale between floor and 30%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Velocity Component */}
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-chart-3/20 flex items-center justify-center">
                        <span className="text-chart-3 font-bold">V</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium text-sm">Velocity Score (0-100)</h4>
                        <p className="text-xs text-muted-foreground">
                          Based on movement multiplier (mvmt)
                        </p>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p>• 0-1x movement = 0 points</p>
                          <p>• 1-2x movement = 20 points</p>
                          <p>• 2-3x movement = 40 points</p>
                          <p>• 3-5x movement = 60 points</p>
                          <p>• 5-10x movement = 80 points</p>
                          <p>• 10x+ movement = 100 points</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Funding Component */}
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-chart-4/20 flex items-center justify-center">
                        <span className="text-chart-4 font-bold">F</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium text-sm">Funding Score (0-100)</h4>
                        <p className="text-xs text-muted-foreground">
                          Vendor funding percentage contribution
                        </p>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p>• No funding = 0 points</p>
                          <p>• 0-5% funding = 20 points</p>
                          <p>• 5-10% funding = 40 points</p>
                          <p>• 10-15% funding = 70 points</p>
                          <p>• 15-20% funding = 85 points</p>
                          <p>• 20%+ funding = 100 points</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Theme Component */}
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-chart-5/20 flex items-center justify-center">
                        <span className="text-chart-5 font-bold">T</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium text-sm">Theme Score (0-100)</h4>
                        <p className="text-xs text-muted-foreground">
                          Seasonal relevance and trends
                        </p>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p>• Base score = 50 points</p>
                          <p>• +15 pts for seasonal match (summer, winter, etc)</p>
                          <p>• +20 pts for holiday relevance</p>
                          <p>• +15 pts for health trends (organic, keto, etc)</p>
                          <p>• Max combined = 100 points</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timing Component */}
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-chart-1/20 flex items-center justify-center">
                        <span className="text-chart-1 font-bold">Ti</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium text-sm">Timing Score (0-100)</h4>
                        <p className="text-xs text-muted-foreground">
                          Promotion start date proximity
                        </p>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p>• Within 3 days = 100 points</p>
                          <p>• Within 7 days = 80 points</p>
                          <p>• Within 14 days = 60 points</p>
                          <p>• Beyond 14 days = 40 points</p>
                          <p>• No timing info = 60 points (default)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Competitive Component */}
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                        <span className="text-secondary font-bold">C</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium text-sm">Competitive Score (0-100)</h4>
                        <p className="text-xs text-muted-foreground">
                          Price advantage vs competitors
                        </p>
                        <div className="bg-background rounded-md p-2 space-y-1">
                          <code className="text-xs block">Advantage = (Competitor Price - Ad SRP) / Competitor Price</code>
                        </div>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p>• 15%+ cheaper = 100 points</p>
                          <p>• 10-15% cheaper = 80 points</p>
                          <p>• 5-10% cheaper = 60 points</p>
                          <p>• Less than 5% = 20 points</p>
                          <p>• No competitor data = 50 points (default)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Metrics */}
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Additional Calculations</h4>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="p-2 rounded-md bg-muted">
                      <p className="font-medium text-foreground mb-1">Required SRP</p>
                      <code className="block">Required SRP = Net Unit Cost / (1 - Target Margin %)</code>
                      <p className="mt-1">Shows the SRP needed to achieve department target margin</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted">
                      <p className="font-medium text-foreground mb-1">Effective BOGO Price</p>
                      <code className="block">Effective Price = Regular SRP / 2</code>
                      <p className="mt-1">Applied when deal includes Buy One Get One promotions</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted">
                      <p className="font-medium text-foreground mb-1">Total Scan</p>
                      <code className="block">Total = Ad Scan + TPR Scan + EDLC Scan</code>
                      <p className="mt-1">Combined scan performance across all channels</p>
                    </div>
                  </div>
                </div>

                {/* Department Margin Floors */}
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Department Margin Floors</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { dept: 'Meat', floor: '18%' },
                      { dept: 'Grocery', floor: '22%' },
                      { dept: 'Produce', floor: '25%' },
                      { dept: 'Bakery', floor: '30%' },
                      { dept: 'Deli', floor: '28%' },
                      { dept: 'Default', floor: '30%' },
                    ].map((item) => (
                      <div key={item.dept} className="flex items-center justify-between p-2 rounded-md bg-muted text-xs">
                        <span className="font-medium">{item.dept}:</span>
                        <span className="text-muted-foreground">{item.floor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scoring Weights Configuration */}
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
                  <Switch 
                    checked={compactView}
                    onCheckedChange={setCompactView}
                    defaultChecked
                  />
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