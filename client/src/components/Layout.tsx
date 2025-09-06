import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Inbox, 
  Coins, 
  Download, 
  ChartLine,
  Settings as SettingsIcon,
  Plus,
  Menu,
  X
} from "lucide-react";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useWeeks } from "@/hooks/useWeeks";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "@/components/Settings";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: weeks } = useWeeks();
  const { toast } = useToast();
  
  const currentWeek = weeks?.[0]; // Most recent week

  const handleSettings = () => {
    setSettingsOpen(true);
  };
  
  // Keyboard shortcuts
  useKeyboard({
    'g w': () => navigate('/weeks'),
    'g i': () => currentWeek && navigate(`/weeks/${currentWeek.id}/inbox`),
    'g d': () => currentWeek && navigate(`/weeks/${currentWeek.id}/deals`),
    'g e': () => currentWeek && navigate(`/weeks/${currentWeek.id}/exports`),
    '?': () => {
      // TODO: Show keyboard shortcuts modal
      console.log('Keyboard shortcuts help');
    }
  });

  const navigationItems = [
    {
      key: 'weeks',
      icon: Calendar,
      label: 'Current Week',
      href: '/weeks',
      active: location === '/' || location === '/weeks',
    },
    {
      key: 'inbox',
      icon: Inbox,
      label: 'Weekly Inbox',
      href: currentWeek ? `/weeks/${currentWeek.id}/inbox` : '/weeks',
      active: location.includes('/inbox'),
      disabled: !currentWeek,
    },
    {
      key: 'deals',
      icon: Coins,
      label: 'Deal Scoring',
      href: currentWeek ? `/weeks/${currentWeek.id}/deals` : '/weeks',
      active: location.includes('/deals'),
      disabled: !currentWeek,
    },
    {
      key: 'exports',
      icon: Download,
      label: 'Exports',
      href: currentWeek ? `/weeks/${currentWeek.id}/exports` : '/weeks',
      active: location.includes('/exports'),
      disabled: !currentWeek,
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ChartLine className="text-primary-foreground" size={16} />
            </div>
            {sidebarOpen && (
              <h1 className="text-lg font-semibold text-sidebar-foreground">
                Deal Optimizer
              </h1>
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  item.active && "bg-sidebar-accent text-sidebar-accent-foreground",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
                data-testid={`nav-${item.key}`}
              >
                <Icon size={16} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        
        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          {sidebarOpen ? (
            <>
              <div className="text-xs text-muted-foreground">
                Week {currentWeek?.week} • {currentWeek?.year}
              </div>
              <div className="text-sm font-medium text-sidebar-foreground">
                {currentWeek?.label}
              </div>
            </>
          ) : (
            <div className="text-xs text-center text-muted-foreground">
              W{currentWeek?.week}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                data-testid="sidebar-toggle"
              >
                <Menu size={16} />
              </Button>
              <div>
                <h2 className="text-xl font-semibold text-card-foreground">
                  {currentWeek ? `Weekly Deal Bank - Week ${currentWeek.week}` : 'Deal Optimizer'}
                </h2>
                {currentWeek && (
                  <p className="text-sm text-muted-foreground">
                    {new Date(currentWeek.start).toLocaleDateString()} - {new Date(currentWeek.end).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleSettings}
                data-testid="settings-button"
              >
                <SettingsIcon size={16} className="mr-2" />
                Settings
              </Button>
              <Button 
                size="sm" 
                onClick={() => navigate('/weeks')}
                data-testid="new-week-button"
              >
                <Plus size={16} className="mr-2" />
                Add Week
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>

      {/* Settings Dialog */}
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
