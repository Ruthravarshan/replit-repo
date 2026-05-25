import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import { RoleProvider } from "@/contexts/role-context";

import { AppLayout } from "@/components/app-layout";
import Dashboard from "@/pages/dashboard";
import Approvals from "@/pages/approvals";
import Stocks from "@/pages/stocks";
import Distributions from "@/pages/distributions";
import NewDistribution from "@/pages/new-distribution";
import AuditLog from "@/pages/audit-log";
import Reports from "@/pages/reports";
import InsightsPage from "@/pages/insights";
import AdminPanel from "@/pages/admin";
import AnomaliesPage from "@/pages/anomalies";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/approvals" component={Approvals} />
        <Route path="/stocks" component={Stocks} />
        <Route path="/distributions" component={Distributions} />
        <Route path="/distributions/new" component={NewDistribution} />
        <Route path="/audit-log" component={AuditLog} />
        <Route path="/reports" component={Reports} />
        <Route path="/insights" component={InsightsPage} />
        <Route path="/anomalies" component={AnomaliesPage} />
        <Route path="/admin" component={AdminPanel} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <RoleProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}

export default App;
