import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import WeeksPage from "@/pages/WeeksPage";
import InboxPage from "@/pages/InboxPage";
import DealsPage from "@/pages/DealsPage";
import ExportsPage from "@/pages/ExportsPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={WeeksPage} />
      <Route path="/weeks" component={WeeksPage} />
      <Route path="/weeks/:id/inbox" component={InboxPage} />
      <Route path="/weeks/:id/deals" component={DealsPage} />
      <Route path="/weeks/:id/exports" component={ExportsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Layout>
            <Router />
          </Layout>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
