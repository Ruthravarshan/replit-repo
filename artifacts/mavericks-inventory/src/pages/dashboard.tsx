import { useState } from "react";
import {
  useGetDashboardSummary, useGetInventoryInsight, useListAnomalies,
  useDismissAnomaly, useGetStockHealthScores, useGetRecentActivity,
  getListAnomaliesQueryKey, useListApprovals, useListDistributions,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, TrendingUp, Package, Activity, BrainCircuit, CheckCircle2,
  X, Link as LinkIcon, Clock, CheckSquare, FileBox, Send, XCircle, Zap, Plus, Upload,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useRole } from "@/contexts/role-context";

export default function Dashboard() {
  const { currentUser } = useRole();
  if (currentUser.role === "manager") return <ManagerDashboard />;
  if (currentUser.role === "executive") return <ExecutiveDashboard />;
  return <AdminDashboard />;
}

// ─── ADMIN DASHBOARD ────────────────────────────────────────────────────────
function AdminDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: insights, isLoading: isLoadingInsights } = useGetInventoryInsight();
  const { data: anomalies, isLoading: isLoadingAnomalies } = useListAnomalies();
  const { data: healthScores } = useGetStockHealthScores();
  const { data: allDistributions } = useListDistributions();
  const { data: allApprovals } = useListApprovals();
  const dismissAnomaly = useDismissAnomaly();
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const handleDismiss = (id: number) => {
    dismissAnomaly.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnomaliesQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      },
    });
  };

  const handleResolve = async () => {
    if (!resolveId || resolveNotes.length < 10) return;
    const res = await fetch(`/api/anomalies/${resolveId}/resolve`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: resolveNotes }),
    });
    if (res.ok) {
      toast({ title: "Anomaly resolved", description: "Resolution logged to audit trail." });
      queryClient.invalidateQueries({ queryKey: getListAnomaliesQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setResolveId(null);
      setResolveNotes("");
    }
  };

  const healthData = [
    { name: "Healthy", value: summary?.healthyCount || 0, color: "#22c55e" },
    { name: "Warning", value: summary?.warningCount || 0, color: "#f59e0b" },
    { name: "Critical", value: summary?.criticalCount || 0, color: "#ef4444" },
  ];

  // Top 10 Most Distributed Items (current month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const top10Data = (() => {
    const approved = (allDistributions ?? []).filter((d) =>
      d.status === "approved" && isAfter(new Date(d.createdAt), monthStart)
    );
    const countByItem: Record<string, { name: string; qty: number }> = {};
    approved.forEach((d) => {
      const key = d.stockCode ?? d.stockName;
      if (!countByItem[key]) countByItem[key] = { name: d.stockName, qty: 0 };
      countByItem[key].qty += d.quantityDistributed ?? 0;
    });
    return Object.values(countByItem)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((item) => ({ name: item.name.length > 16 ? item.name.slice(0, 16) + "…" : item.name, qty: item.qty }));
  })();

  // Approval Bottlenecks (pending > 48 hours)
  const bottlenecks = (allApprovals ?? []).filter((a) => {
    if (a.status !== "pending") return false;
    const hoursAgo = (new Date().getTime() - new Date(a.createdAt).getTime()) / 3600000;
    return hoursAgo > 48;
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Center</h1>
          <p className="text-muted-foreground mt-1">Real-time inventory overview and AI insights.</p>
        </div>
        {summary?.automationPercentage && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20">
            <BrainCircuit className="w-5 h-5" />
            <span className="font-semibold">{summary.automationPercentage}% Autonomous</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Stock Items" value={summary?.totalStockItems} icon={Package} isLoading={isLoadingSummary} />
        <StatCard title="Pending Approvals" value={summary?.pendingApprovals} icon={CheckCircle2} isLoading={isLoadingSummary} highlight={!!summary?.pendingApprovals && summary.pendingApprovals > 0} />
        <StatCard title="Active Anomalies" value={summary?.anomalyCount} icon={AlertTriangle} isLoading={isLoadingSummary} alert={!!summary?.anomalyCount && summary.anomalyCount > 0} />
        <StatCard title="Total Units" value={summary?.totalAvailableUnits} icon={Activity} isLoading={isLoadingSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <AnomalySection anomalies={anomalies} isLoading={isLoadingAnomalies} onDismiss={handleDismiss} onResolve={(id) => setResolveId(id)} />

          {/* Top 10 Most Distributed Items */}
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Top 10 Distributed Items
                </CardTitle>
                <CardDescription>Current month — approved distributions by quantity</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {top10Data.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No approved distributions this month</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top10Data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ fill: "hsl(var(--secondary))" }} contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} formatter={(v) => [v, "Units"]} />
                      <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Inventory Health */}
          <section>
            <Card>
              <CardHeader><CardTitle>Inventory Health</CardTitle><CardDescription>Stock levels across critical thresholds</CardDescription></CardHeader>
              <CardContent className="h-48 flex items-center">
                {isLoadingSummary ? <Skeleton className="w-full h-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={healthData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {healthData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Approval Bottlenecks */}
          {bottlenecks.length > 0 && (
            <section>
              <h2 className="text-base font-semibold flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                Approval Bottlenecks — Pending &gt; 48 Hours ({bottlenecks.length})
              </h2>
              <div className="space-y-2">
                {bottlenecks.slice(0, 5).map((a) => {
                  const hoursAgo = Math.round((new Date().getTime() - new Date(a.createdAt).getTime()) / 3600000);
                  return (
                    <Link key={a.id} href="/approvals">
                      <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer">
                        <div>
                          <p className="text-sm font-medium">{a.distribution?.stockName ?? "Unknown Item"}</p>
                          <p className="text-xs text-muted-foreground">{a.distribution?.recipient ?? "—"} · {a.distribution?.quantityDistributed ?? "?"} units</p>
                        </div>
                        <Badge className="text-xs border bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                          {hoursAgo}h pending
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <AiSynthesisPanel insights={insights} isLoading={isLoadingInsights} />

          {/* System Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "API Server", status: "Operational" },
                { label: "Database", status: "Operational" },
                { label: "AI Engine", status: "Operational" },
                { label: "Anomaly Monitor", status: "Active" },
              ].map(({ label, status }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    {status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={resolveId !== null} onOpenChange={(o) => !o && setResolveId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve Anomaly</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Provide resolution notes explaining what action was taken. Minimum 10 characters.</p>
            <Textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} placeholder="Describe the corrective action taken..." rows={3} className="resize-none" />
            <p className="text-xs text-right text-muted-foreground">{resolveNotes.length} chars (min 10)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveId(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={resolveNotes.length < 10} className="bg-emerald-600 hover:bg-emerald-700 text-white">Mark Resolved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MANAGER DASHBOARD ───────────────────────────────────────────────────────
function ManagerDashboard() {
  const queryClient = useQueryClient();
  const { data: summary } = useGetDashboardSummary();
  const { data: approvals } = useListApprovals({ status: "pending" }, { query: { queryKey: ["/api/approvals", { status: "pending" }] } });
  const { data: anomalies, isLoading: isLoadingAnomalies } = useListAnomalies();
  const { data: activity } = useGetRecentActivity();
  const dismissAnomaly = useDismissAnomaly();
  const { data: allApprovals } = useListApprovals();

  const handleDismiss = (id: number) => {
    dismissAnomaly.mutate({ id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAnomaliesQueryKey() }); } });
  };

  const highRisk = approvals?.filter((a) => a.aiRecommendation?.riskLevel === "high") ?? [];
  const today = new Date().toDateString();
  const todayActions = allApprovals?.filter((a) => a.approvedAt && new Date(a.approvedAt).toDateString() === today) ?? [];

  const approvalVelocity = (() => {
    const processed = allApprovals?.filter((a) => a.approvedAt && a.createdAt) ?? [];
    if (!processed.length) return null;
    const totalMs = processed.reduce((sum, a) => sum + (new Date(a.approvedAt!).getTime() - new Date(a.createdAt).getTime()), 0);
    return Math.round(totalMs / processed.length / 3600000 * 10) / 10;
  })();

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
        <p className="text-muted-foreground mt-1">Approval queue and inventory oversight.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/approvals">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Approvals</p>
                <CheckSquare className="w-4 h-4 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary">{approvals?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
            </CardContent>
          </Card>
        </Link>
        <Card className={highRisk.length > 0 ? "border-red-200 dark:border-red-800" : ""}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">High Risk</p>
              <AlertTriangle className={`w-4 h-4 ${highRisk.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </div>
            <p className={`text-3xl font-bold ${highRisk.length > 0 ? "text-red-500" : ""}`}>{highRisk.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Flagged for review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Today's Actions</p>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold">{todayActions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Decisions made</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Turnaround</p>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold">{approvalVelocity != null ? `${approvalVelocity}h` : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Approval velocity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <AnomalySection anomalies={anomalies} isLoading={isLoadingAnomalies} onDismiss={handleDismiss} compact />
        </div>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {activity?.slice(0, 8).map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  {a.type.includes("approved") ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> :
                    a.type.includes("rejected") ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
                    <Activity className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{a.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EXECUTIVE DASHBOARD ─────────────────────────────────────────────────────
function ExecutiveDashboard() {
  const { data: distributions } = useListDistributions();
  const { data: anomalies } = useListAnomalies();
  const { data: stocks } = useGetStockHealthScores();
  const { data: activity } = useGetRecentActivity();

  const myDists = distributions ?? [];
  const counts = {
    draft: myDists.filter((d) => d.status === "draft").length,
    submitted: myDists.filter((d) => d.status === "submitted").length,
    approved: myDists.filter((d) => d.status === "approved").length,
    rejected: myDists.filter((d) => d.status === "rejected").length,
  };

  const rejectedPending = myDists.filter((d) => d.status === "rejected");
  const criticalStocks = stocks?.filter((s) => s.healthStatus === "Critical") ?? [];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your transactions and stock overview.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/distributions/new"><Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Distribution</Button></Link>
          <Button size="sm" variant="outline"><Upload className="w-4 h-4 mr-1.5" />Upload Excel</Button>
        </div>
      </div>

      {/* My Transactions */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">My Transactions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Draft", count: counts.draft, icon: FileBox, color: "text-muted-foreground", bg: "" },
            { label: "Submitted", count: counts.submitted, icon: Send, color: "text-blue-600", bg: "border-blue-200 dark:border-blue-800" },
            { label: "Approved", count: counts.approved, icon: CheckCircle2, color: "text-emerald-600", bg: "border-emerald-200 dark:border-emerald-800" },
            { label: "Rejected", count: counts.rejected, icon: XCircle, color: "text-red-500", bg: counts.rejected > 0 ? "border-red-200 dark:border-red-800" : "" },
          ].map(({ label, count, icon: Icon, color, bg }) => (
            <Link key={label} href="/distributions">
              <Card className={`cursor-pointer hover:shadow-md transition-shadow ${bg}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className={`text-3xl font-bold ${color}`}>{count}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Rejected Pending Resubmission */}
          {rejectedPending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Pending Actions — Resubmission Required
              </h2>
              <div className="space-y-2">
                {rejectedPending.map((d) => (
                  <div key={d.id} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{d.stockName} <span className="text-muted-foreground font-mono text-xs">({d.stockCode})</span></p>
                      <p className="text-xs text-muted-foreground">{d.quantityDistributed} units — {d.recipient}</p>
                      {d.remarks && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Rejection reason: {d.remarks}</p>}
                    </div>
                    <Link href="/distributions">
                      <Button size="sm" variant="outline" className="border-red-300 text-red-600">
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Resubmit
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Anomaly Alerts */}
          {anomalies && anomalies.filter((a) => !a.dismissed).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-primary" /> AI Anomaly Alerts
              </h2>
              <div className="space-y-2">
                {anomalies.filter((a) => !a.dismissed).slice(0, 2).map((a) => (
                  <div key={a.id} className={`rounded-lg p-3 border-l-4 ${a.severity === "critical" ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/40" : "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40"}`}>
                    <p className="text-sm font-medium">{a.stockName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Critical Stock */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Critical Stock Levels</h2>
            {criticalStocks.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-primary opacity-50" />
                All stock levels healthy
              </div>
            ) : (
              <div className="space-y-2">
                {criticalStocks.slice(0, 4).map((s) => (
                  <div key={s.stockId} className="bg-card border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.stockName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.stockCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-500">{s.availableQuantity}</p>
                      <p className="text-xs text-muted-foreground">remaining</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Recent Activity</h2>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {activity?.slice(0, 5).map((a) => (
                <div key={a.id} className="px-3 py-2.5 flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-foreground/80 leading-relaxed">{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function AnomalySection({ anomalies, isLoading, onDismiss, onResolve, compact }: {
  anomalies: any[] | undefined; isLoading: boolean;
  onDismiss: (id: number) => void; onResolve?: (id: number) => void; compact?: boolean;
}) {
  return (
    <section>
      <h2 className={`${compact ? "text-base" : "text-xl"} font-semibold mb-3 flex items-center gap-2`}>
        <AlertTriangle className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-destructive`} />
        Detected Anomalies
      </h2>
      <div className="space-y-3">
        {isLoading ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />) : (
          <AnimatePresence initial={false}>
            {anomalies?.filter((a) => !a.dismissed).length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-primary opacity-50" />
                <p className="text-sm">No active anomalies detected.</p>
              </motion.div>
            ) : (
              anomalies?.filter((a) => !a.dismissed).map((anomaly, idx) => {
                const isCritical = anomaly.severity?.toLowerCase() === "critical";
                const isHigh = anomaly.severity?.toLowerCase() === "high";
                return (
                  <motion.div key={anomaly.id} initial={{ opacity: 0, x: -32, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0, x: 32, height: 0 }} transition={{ duration: 0.3, delay: idx * 0.06 }}
                    className={`relative bg-card rounded-r-lg p-4 shadow-sm flex items-start gap-4 overflow-hidden border-t border-r border-b ${isCritical ? "border-l-4 border-l-red-500 border-red-200 dark:border-red-900/40" : isHigh ? "border-l-4 border-l-amber-500 border-amber-200 dark:border-amber-900/40" : "border-l-4 border-l-yellow-400 border-yellow-200 dark:border-yellow-900/40"}`}
                  >
                    <div className={`absolute inset-0 pointer-events-none opacity-[0.03] ${isCritical ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-yellow-400"}`} />
                    <div className="flex-1 relative z-10">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{anomaly.stockName}</span>
                        <Badge variant="outline" className="text-xs font-mono">{anomaly.stockCode}</Badge>
                        <Badge className={`text-xs border ${isCritical ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800" : isHigh ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800" : "bg-yellow-100 text-yellow-700 border-yellow-200"}`}>{anomaly.severity}</Badge>
                      </div>
                      <p className="text-sm text-foreground">{anomaly.description}</p>
                      {!compact && anomaly.explanation && (
                        <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 p-2 rounded border border-border/60">
                          <span className="font-semibold text-primary mr-1">AI Context:</span>{anomaly.explanation}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">Detected: {format(new Date(anomaly.detectedAt), "MMM d, HH:mm")}</p>
                    </div>
                    <div className="flex flex-col gap-1 relative z-10 shrink-0">
                      {onResolve && (
                        <Button variant="outline" size="sm" className="h-7 text-xs border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400" onClick={() => onResolve(anomaly.id)}>
                          Resolve
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onDismiss(anomaly.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

function AiSynthesisPanel({ insights, isLoading }: { insights: any; isLoading: boolean }) {
  return (
    <div className="glassmorphism-primary rounded-xl p-6 sticky top-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-2 rounded-lg"><BrainCircuit className="w-6 h-6 text-primary" /></div>
        <h2 className="text-xl font-bold">AI Synthesis</h2>
      </div>
      {isLoading ? (
        <div className="space-y-4">{[1, 5 / 6, 4 / 6].map((w, i) => <Skeleton key={i} className="h-4 bg-primary/10" style={{ width: `${w * 100}%` }} />)}</div>
      ) : insights ? (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed font-medium text-foreground/80">{insights.summary}</p>
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Observations</h3>
            <ul className="space-y-2">
              {insights.keyObservations?.map((obs: string, i: number) => (
                <li key={i} className="text-sm flex items-start gap-2 bg-secondary/50 p-3 rounded-lg border border-border/60">
                  <span className="text-primary mt-0.5 shrink-0">•</span>
                  <span className="text-foreground/80">{obs}</span>
                </li>
              ))}
            </ul>
          </div>
          {insights.recommendedActions?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recommended Actions</h3>
              <div className="space-y-2">
                {insights.recommendedActions.map((action: string, i: number) => (
                  <div key={i} className="text-sm flex items-center gap-2 bg-primary/10 p-3 rounded-lg border border-primary/20 font-medium text-foreground/80">
                    <TrendingUp className="w-4 h-4 text-primary shrink-0" />{action}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="pt-4 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
            <span>Overall Health</span>
            <span className="font-bold text-primary">{insights.healthPercentage}%</span>
          </div>
        </div>
      ) : <div className="text-sm text-muted-foreground opacity-70">No insights available.</div>}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isLoading, highlight, alert }: { title: string; value?: number; icon: React.ElementType; isLoading: boolean; highlight?: boolean; alert?: boolean }) {
  return (
    <Card className={`relative overflow-hidden ${highlight ? "border-primary/40 shadow-[0_0_18px_rgba(0,180,180,0.12)]" : ""} ${alert ? "border-destructive/40 shadow-[0_0_18px_rgba(239,68,68,0.10)]" : ""}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? <Skeleton className="h-8 w-16 mt-2" /> : (
              <p className={`text-3xl font-bold mt-2 ${alert ? "text-destructive" : ""} ${highlight ? "text-primary" : ""}`}>{value?.toLocaleString() ?? "0"}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${alert ? "bg-destructive/10 text-destructive" : highlight ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
