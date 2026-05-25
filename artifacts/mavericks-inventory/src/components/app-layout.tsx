import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, CheckSquare, Package, Truck, Moon, Sun, AlertTriangle,
  ShieldCheck, BarChart2, BrainCircuit, ChevronDown, Settings, ShieldAlert,
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useGetDashboardSummary, useListAnomalies } from "@workspace/api-client-react";
import { useRole, ROLE_USERS, type UserRole } from "@/contexts/role-context";
import { NotificationBell } from "@/components/notification-bell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-violet-500", executive: "bg-sky-500", manager: "bg-emerald-500",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { currentUser, setRole, canAdmin } = useRole();
  const { data: summary } = useGetDashboardSummary();
  const { data: anomalies } = useListAnomalies();

  const activeAnomalies = anomalies?.filter((a) => a.status === "active").length ?? 0;

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/approvals", icon: CheckSquare, label: "Approvals", badge: summary?.pendingApprovals },
    { href: "/stocks", icon: Package, label: "Stock Master" },
    { href: "/distributions", icon: Truck, label: "Distributions" },
    { href: "/anomalies", icon: ShieldAlert, label: "Anomalies", badge: activeAnomalies || undefined, badgeVariant: "destructive" as const },
    { href: "/insights", icon: BrainCircuit, label: "AI Insights" },
    { href: "/reports", icon: BarChart2, label: "Reports" },
    { href: "/audit-log", icon: ShieldCheck, label: "Audit Log" },
    ...(canAdmin ? [{ href: "/admin", icon: Settings, label: "Administration" }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-tight">
            <div className="bg-primary/10 p-1.5 rounded-md text-primary"><AlertTriangle className="w-5 h-5" /></div>
            Mavericks AI
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="block">
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-md transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}>
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <Badge
                      variant={isActive ? "secondary" : (item.badgeVariant ?? "default")}
                      className={`ml-auto text-xs ${isActive ? "text-primary" : item.badgeVariant === "destructive" ? "bg-red-500 text-white border-0" : ""}`}
                    >
                      {item.badge}
                    </Badge>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary/50 transition-colors group text-left">
                <div className={`w-8 h-8 rounded-full ${ROLE_COLORS[currentUser.role]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {currentUser.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentUser.title}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">Switch Role</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ROLE_USERS.map((user) => (
                <DropdownMenuItem key={user.role} onClick={() => setRole(user.role)} className="cursor-pointer">
                  <div className="flex items-center gap-3 w-full">
                    <div className={`w-7 h-7 rounded-full ${ROLE_COLORS[user.role]} flex items-center justify-center text-white text-xs font-bold`}>{user.avatar}</div>
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.title}</p>
                    </div>
                    {currentUser.role === user.role && <span className="ml-auto text-primary text-xs font-medium">Active</span>}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">{theme === "dark" ? "Dark mode" : "Light mode"}</span>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="text-muted-foreground hover:text-foreground h-8 w-8">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header bar */}
        <header className="h-14 shrink-0 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${currentUser.role === "admin" ? "border-violet-300 text-violet-600 bg-violet-50 dark:bg-violet-950/20" : currentUser.role === "manager" ? "border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" : "border-sky-300 text-sky-600 bg-sky-50 dark:bg-sky-950/20"}`}>
              {currentUser.title}
            </Badge>
            {summary?.pendingApprovals ? (
              <span className="text-xs text-muted-foreground">{summary.pendingApprovals} pending approval{summary.pendingApprovals > 1 ? "s" : ""}</span>
            ) : null}
            {activeAnomalies > 0 && (
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">{activeAnomalies} active anomal{activeAnomalies !== 1 ? "ies" : "y"}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
